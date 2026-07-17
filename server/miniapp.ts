import { Router } from 'express'
import multer from 'multer'
import { writeAudit } from './auth.js'

const BASE = (process.env.MINIAPP_API_URL || 'https://lnpapp.rest').replace(/\/$/, '')
const KEY = process.env.MINIAPP_ADMIN_KEY || ''

export const miniapp = Router()

// Фото рассылки держим в памяти и сразу пересылаем — на диск класть незачем.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

/**
 * Запрос в админский API мини-аппа. Ключ уходит заголовком X-API-Key
 * и живёт только здесь: у того API он же принимается через ?key=,
 * но так он светился бы в логах и в истории браузера.
 */
async function call<T = any>(path: string, query: Record<string, unknown> = {}): Promise<T> {
  if (!KEY) throw Object.assign(new Error('MINIAPP_ADMIN_KEY не задан'), { status: 500 })

  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  }
  const qs = p.toString()

  const res = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, {
    headers: { 'X-API-Key': KEY },
    signal: AbortSignal.timeout(60_000),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw Object.assign(new Error(body?.error ?? `Мини-апп ответил ${res.status}`), {
      status: res.status,
    })
  }
  return body as T
}

/** Номер карты приходит целиком — наружу отдаём только хвост. */
function maskOrder(o: any) {
  const pan: string | undefined = o?.card?.cardNumber ?? o?.cards?.cardNumber
  const masked = pan ? `${pan.slice(0, 6)}••••••${pan.slice(-4)}` : undefined
  const out = { ...o }
  // Ответ дублирует связи: users/user и cards/card — одно и то же.
  // Оставляем по одному, чтобы наружу не уезжали две копии PAN.
  delete out.users
  delete out.cards
  if (out.card) out.card = { ...out.card, cardNumber: masked }
  return out
}

miniapp.get('/orders', async (req, res) => {
  try {
    const data = await call<{ data: any[]; total: number; page: number; pageSize: number }>(
      '/api/admin/transactions',
      {
        page: req.query.page ?? 1,
        // pageSize у апстрима не ограничен сверху: 1857 записей — это 5 МБ и
        // около минуты. Держим потолок здесь.
        pageSize: Math.min(Number(req.query.pageSize) || 50, 200),
        status: req.query.status,
        type: req.query.type,
        category: req.query.category,
        telegramUserId: req.query.telegramUserId,
        userId: req.query.userId,
        cardId: req.query.cardId,
        fromDate: req.query.fromDate,
        toDate: req.query.toDate,
      },
    )
    res.json({ success: true, ...data, data: (data.data ?? []).map(maskOrder) })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})

miniapp.get('/stats', async (_req, res) => {
  try {
    res.json({ success: true, ...(await call('/api/admin/stats')) })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})

// ── Режим техработ ───────────────────────────────────────────────────────────

type Notice = { active: boolean; title: string; message: string; buttonText: string }

// Права проверяет miniappGate в index.ts до входа в роутер — здесь не дублируем.
miniapp.get('/maintenance', async (_req, res) => {
  try {
    res.json({ success: true, notice: await call<Notice>('/api/admin/announcement/maintenance') })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})

miniapp.post('/maintenance', async (req, res) => {
  try {
    if (!KEY) throw Object.assign(new Error('MINIAPP_ADMIN_KEY не задан'), { status: 500 })

    const r = await fetch(`${BASE}/api/admin/announcement/maintenance`, {
      method: 'POST',
      headers: { 'X-API-Key': KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(30_000),
    })
    const body = await r.json().catch(() => null)
    if (!r.ok) {
      return res.status(r.status).json({ success: false, error: body?.error ?? `Ошибка ${r.status}` })
    }
    // Включение/выключение техработ видят все клиенты — фиксируем, кто это сделал.
    await writeAudit(req, 'MAINTENANCE_SET', 'miniapp', undefined, req.body)
    res.json({ success: true, ...body })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})

/** Агрегаты реферальной программы. Детализации в апстриме нет. */
miniapp.get('/referrals', async (_req, res) => {
  try {
    res.json({ success: true, ...(await call('/api/admin/dashboard/referrals')) })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})

miniapp.get('/overview', async (_req, res) => {
  try {
    res.json({ success: true, ...(await call('/api/admin/dashboard/overview')) })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})

/**
 * Пользователи мини-аппа.
 *
 * Апстрим отдаёт строку из БД целиком, включая `passwordHash` — bcrypt-хеш
 * пароля. Ему нечего делать в браузере: вырезаем здесь вместе с сырыми
 * KYC-данными, оставляя только флаг, что верификация есть.
 */
function sanitizeUser(u: any) {
  const { passwordHash, kycData, ...rest } = u ?? {}
  return {
    ...rest,
    hasPassword: Boolean(passwordHash),
    hasKycData: Boolean(kycData),
  }
}

miniapp.get('/users', async (req, res) => {
  try {
    const data = await call<{ data: any[]; total: number; page: number; pageSize: number }>(
      '/api/admin/users',
      {
        page: req.query.page ?? 1,
        pageSize: Math.min(Number(req.query.pageSize) || 50, 200),
        search: req.query.search,
      },
    )
    res.json({ success: true, ...data, data: (data.data ?? []).map(sanitizeUser) })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})

// ── Рассылки ─────────────────────────────────────────────────────────────────

miniapp.get('/broadcast/history', async (_req, res) => {
  try {
    res.json({ success: true, ...(await call('/api/admin/broadcast/history')) })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})

miniapp.get('/broadcast/:id/status', async (req, res) => {
  try {
    res.json({ success: true, ...(await call(`/api/admin/broadcast/${req.params.id}/status`)) })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})

/**
 * Запуск рассылки. Апстрим ждёт multipart (message, audience, type + photo),
 * поэтому пересобираем FormData, а не пересылаем JSON.
 */
miniapp.post('/broadcast/start', upload.single('photo'), async (req, res) => {
  try {
    if (!KEY) throw Object.assign(new Error('MINIAPP_ADMIN_KEY не задан'), { status: 500 })

    const message = String(req.body?.message ?? '').trim()
    if (!message) return res.status(400).json({ success: false, error: 'Текст обязателен' })

    const form = new FormData()
    form.append('message', message)
    form.append('audience', String(req.body?.audience ?? 'all'))
    form.append('type', req.file ? 'photo' : 'text')
    if (req.file) {
      form.append(
        'photo',
        new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype }),
        req.file.originalname,
      )
    }

    const r = await fetch(`${BASE}/api/admin/broadcast/start`, {
      method: 'POST',
      headers: { 'X-API-Key': KEY },
      body: form,
      signal: AbortSignal.timeout(120_000),
    })
    const body = await r.json().catch(() => null)
    if (!r.ok) {
      return res.status(r.status).json({ success: false, error: body?.error ?? `Ошибка ${r.status}` })
    }
    res.json({ success: true, ...body })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})
