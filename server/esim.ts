import { Router } from 'express'
import { requireAuth, requireSection } from './auth.js'

/**
 * eSIM (Yesim). Раздел вернулся из старого admin-api — там модуль отключили
 * (/v1/esim отдаёт 404), поэтому ходим к провайдеру напрямую.
 *
 * Два источника, потому что у Yesim нет одного API на всё:
 *  - Partner API (токен) — заказы и тарифы;
 *  - веб-кабинет CORE — остаток средств: публичного эндпоинта для баланса у
 *    них нет, поэтому логинимся формой и парсим HTML. Сессию и баланс кэшируем,
 *    чтобы не логиниться на каждый заход в раздел.
 */
const API_URL = (process.env.YESIM_API_URL || 'https://partners-api.yesim.biz').replace(/\/$/, '')
const API_TOKEN = (process.env.YESIM_API_TOKEN || '').trim()

const CORE_URL = (process.env.YESIM_CORE_URL || 'https://core.yesim.biz').replace(/\/$/, '')
const CORE_LOGIN = process.env.YESIM_CORE_LOGIN || ''
const CORE_PASSWORD = process.env.YESIM_CORE_PASSWORD || ''

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'

// PHP-сессия живёт 1–4 часа, берём с запасом; баланс меняется редко.
const SESSION_TTL_MS = 50 * 60_000
const BALANCE_TTL_MS = 5 * 60_000

let sessionCache: { cookie: string; expiresAt: number } | null = null
let balanceCache: { amount: number; currency: string; fetchedAt: number } | null = null

// ── Partner API ──────────────────────────────────────────────────────────────

async function yesim<T = any>(path: string, params: Record<string, string> = {}): Promise<T> {
  if (!API_TOKEN) throw Object.assign(new Error('YESIM_API_TOKEN не задан'), { status: 503 })
  const qs = new URLSearchParams({ token: API_TOKEN, ...params }).toString()
  const res = await fetch(`${API_URL}${path}?${qs}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(45_000),
  })
  const text = await res.text()
  let data: any
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const msg = typeof data === 'string' ? data : data?.description || data?.error || `HTTP ${res.status}`
    throw Object.assign(new Error(msg || 'Yesim API error'), { status: res.status })
  }
  return data as T
}

// ── Баланс из веб-кабинета ───────────────────────────────────────────────────

function jarFromHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  const list = (h as any).getSetCookie?.() as string[] | undefined
  const arr = list?.length ? list : h.get('set-cookie')?.split(/,(?=\s*\w+=)/) ?? []
  for (const raw of arr) {
    const first = raw.split(';')[0]
    const eq = first.indexOf('=')
    if (eq > 0) out[first.slice(0, eq).trim()] = first.slice(eq + 1).trim()
  }
  return out
}
const cookieHeader = (jar: Record<string, string>) =>
  Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')

async function coreLogin(): Promise<string> {
  if (!CORE_LOGIN || !CORE_PASSWORD) {
    throw Object.assign(new Error('YESIM_CORE_LOGIN / YESIM_CORE_PASSWORD не заданы'), { status: 503 })
  }
  const init = await fetch(`${CORE_URL}/?act=balance_payment`, {
    redirect: 'manual',
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(45_000),
  })
  const jar = jarFromHeaders(init.headers)
  if (!jar.PHPSESSID) throw new Error('Yesim CORE не выдал PHPSESSID')

  const loginRes = await fetch(`${CORE_URL}/index.php`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookieHeader(jar),
      'User-Agent': UA,
      Accept: 'text/html',
    },
    body: new URLSearchParams({ login: CORE_LOGIN, pass: CORE_PASSWORD, sub: 'Sign In' }).toString(),
    signal: AbortSignal.timeout(45_000),
  })
  Object.assign(jar, jarFromHeaders(loginRes.headers))

  const check = await fetch(`${CORE_URL}/?act=balance_payment`, {
    headers: { Cookie: cookieHeader(jar), 'User-Agent': UA, Accept: 'text/html' },
    signal: AbortSignal.timeout(45_000),
  })
  if ((await check.text()).includes('Sign in to CORE')) {
    throw new Error('Yesim CORE: вход не прошёл — логин/пароль или 2FA')
  }
  return cookieHeader(jar)
}

async function ensureSession(): Promise<string> {
  const now = Date.now()
  if (sessionCache && sessionCache.expiresAt > now) return sessionCache.cookie
  const cookie = await coreLogin()
  sessionCache = { cookie, expiresAt: now + SESSION_TTL_MS }
  return cookie
}

const BALANCE_PRIMARY = /<div\s+class="user-balance"\s*>\s*Balance:\s*([\d.,]+)\s*([A-Z]{3})\s*<\/div>/i
const BALANCE_FALLBACK = /<div\s+class="balance-text-h3"\s*>\s*([\d.,]+)\s*(?:&[a-z]+;)?\s*([A-Z]{3})\s*<\/div>/i

async function getBalance(force = false) {
  const now = Date.now()
  if (!force && balanceCache && now - balanceCache.fetchedAt < BALANCE_TTL_MS) {
    return {
      amount: balanceCache.amount,
      currency: balanceCache.currency,
      fetchedAt: new Date(balanceCache.fetchedAt).toISOString(),
      cached: true,
    }
  }

  const load = async (cookie: string) =>
    (
      await fetch(`${CORE_URL}/?act=balance_payment`, {
        headers: { Cookie: cookie, 'User-Agent': UA, Accept: 'text/html' },
        signal: AbortSignal.timeout(45_000),
      })
    ).text()

  let html = await load(await ensureSession())
  // Сессия могла протухнуть раньше нашего TTL — перелогиниваемся один раз.
  if (html.includes('Sign in to CORE')) {
    sessionCache = null
    html = await load(await ensureSession())
  }

  const m = html.match(BALANCE_PRIMARY) || html.match(BALANCE_FALLBACK)
  if (!m) throw new Error('Не удалось разобрать баланс на странице Yesim CORE')

  const amount = Number(m[1].replace(/\s/g, '').replace(',', '.'))
  const currency = m[2]
  balanceCache = { amount, currency, fetchedAt: now }
  return { amount, currency, fetchedAt: new Date(now).toISOString(), cached: false }
}

// ── Маршруты ─────────────────────────────────────────────────────────────────

export const esim = Router()
esim.use(requireAuth)

/** Обзор: остаток у провайдера + сколько всего заказов. */
esim.get('/', requireSection('esim'), async (req, res) => {
  try {
    const [balance, orders] = await Promise.all([
      getBalance(req.query.force === '1').catch(() => null),
      yesim<any[]>('/orders').catch(() => []),
    ])
    res.json({
      success: true,
      balance,
      ordersTotal: Array.isArray(orders) ? orders.length : 0,
    })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})

esim.get('/orders', requireSection('esim'), async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : ''
    const orders = await yesim<any[]>('/orders', search ? { search } : {})
    res.json({ success: true, orders: Array.isArray(orders) ? orders : [] })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})

/** Тарифы. Список большой (~1500) и limit не поддерживается — режем на клиенте. */
esim.get('/plans', requireSection('esim'), async (_req, res) => {
  try {
    const plans = await yesim<any>('/plans')
    res.json({ success: true, plans: Array.isArray(plans) ? plans : plans ? [plans] : [] })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})
