import crypto from 'node:crypto'

const BASE = (process.env.PAYSPACE_API_URL || 'https://app.pay.space').replace(/\/$/, '')
const KEY = process.env.PAYSPACE_API_KEY || ''
const SECRET = process.env.PAYSPACE_SECRET || ''

export type PsError = Error & { status?: number; code?: string }

/**
 * Подпись запроса к PAY.SPACE (HMAC-SHA256).
 *
 * Сообщение строго: METHOD\nPATH\nQUERY\nSHA256(body)\nTIMESTAMP\nNONCE.
 * Сервер отвергает запрос, если timestamp разошёлся больше чем на 5 минут
 * (`timestamp_skew_too_large`) или nonce повторился (`replay_detected`),
 * поэтому nonce генерируется на каждый вызов и никогда не переиспользуется.
 */
function signHeaders(method: string, path: string, query: string, body: string) {
  const ts = Math.floor(Date.now() / 1000).toString()
  const nonce = crypto.randomBytes(16).toString('hex')
  const bodyHash = crypto.createHash('sha256').update(body).digest('hex')
  const message = `${method}\n${path}\n${query}\n${bodyHash}\n${ts}\n${nonce}`
  const signature = crypto.createHmac('sha256', SECRET).update(message).digest('base64')
  return { 'X-Timestamp': ts, 'X-Nonce': nonce, 'X-Signature': signature }
}

export async function ps<T = any>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  opts?: { query?: Record<string, unknown>; body?: unknown },
): Promise<T> {
  if (!KEY) throw Object.assign(new Error('PAYSPACE_API_KEY не задан'), { status: 500 })

  // Канонический query — параметры отсортированы, пустые выброшены.
  const entries = Object.entries(opts?.query ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => [k, String(v)] as [string, string])
    .sort(([a], [b]) => a.localeCompare(b))
  const query = entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')

  const body = opts?.body ? JSON.stringify(opts.body) : ''
  const headers: Record<string, string> = {
    Authorization: `Bearer ${KEY}`,
    // Content-Type только когда есть тело. С ним на GET апстрим начинает
    // искать параметры в теле вместо query-строки и отвечает
    // «card_id_required», а фильтры молча перестают применяться.
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(SECRET ? signHeaders(method, path, query, body) : {}),
  }

  if (process.env.PAYSPACE_DEBUG) {
    console.log(`[payspace] ${method} ${path}${query ? `?${query}` : ''}`)
  }

  const res = await fetch(`${BASE}${path}${query ? `?${query}` : ''}`, {
    method,
    headers,
    body: body || undefined,
    signal: AbortSignal.timeout(30_000),
  })

  const json = await res.json().catch(() => null)
  if (!res.ok || json?.success === false) {
    const e: PsError = new Error(json?.error?.message ?? `PAY.SPACE ответил ${res.status}`)
    e.status = res.status
    e.code = json?.error?.code
    throw e
  }
  return (json?.data ?? json) as T
}

/**
 * Маскировка карточных данных.
 *
 * API отдаёт полный PAN и CVV открытым текстом. В списки они не попадают:
 * незачем держать их в памяти браузера и в истории вкладок у каждого,
 * кто просто смотрит таблицу. Полные данные — только по явному запросу
 * одной карты (reveal), это и в аудите видно отдельно.
 */
/**
 * Приводит карточку из /card/info/ к виду списка /cards/.
 *
 * Апстрим отдаёт один и тот же объект в двух стилях: список — snake_case
 * (card_no, exp_date), а детали — camelCase (cardNo, expDate). Сводим к
 * одному, чтобы выше по стеку об этом не думать.
 */
export function normalizeCard(raw: Record<string, any>): Record<string, any> {
  if (!raw) return raw
  const camel = raw.cardNo !== undefined || raw.cardId !== undefined
  if (!camel) return raw
  return {
    ...raw,
    card_id: raw.cardId,
    card_no: raw.cardNo,
    exp_date: raw.expDate,
    balance: raw.cardBal,
    used_amt: raw.usedAmt,
    total_amt: raw.totalAmt,
    created_at: raw.createTime,
    product_code: raw.productCode,
    email: raw.card_email,
  }
}

export function maskCard<T extends Record<string, any>>(card: T): T {
  const pan: string | undefined = card.card_no
  return {
    ...card,
    card_no: pan ? `${pan.slice(0, 6)}••••••${pan.slice(-4)}` : pan,
    cvv: undefined,
    masked: true,
  }
}
