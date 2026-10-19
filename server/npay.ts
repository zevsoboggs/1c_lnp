import { Router } from 'express'
import crypto from 'node:crypto'
import { miniappCall } from './miniapp.js'

/**
 * SberPay через NPay (Namba One, Киргизия).
 *
 * Клиент мини-аппа платит рублями через СберБанк или ВТБ по одноразовой
 * ссылке, NPay зачисляет нам сомы. Ссылку создаёт и вебхук принимает мини-апп,
 * поэтому операции живут у него в transactions с metadata.provider =
 * NPAY_SBER. Здесь их обзор и сверка с самим NPay: остаток мерчанта и статус
 * каждой ссылки по нашему id.
 *
 * Ничего не создаём и не зачисляем: деньги по SberPay двигает только вебхук
 * NPay в мини-аппе. Раздел только читает.
 */

const BASE = (process.env.NPAY_BASE_URL || '').replace(/\/$/, '')
const MERCHANT = process.env.NPAY_MERCHANT_GUID || ''
const API_KEY = process.env.NPAY_API_KEY || ''

type NpError = Error & { status?: number }

/**
 * Запрос к NPay. Подпись — base64(HMAC-SHA512(путь + тело + salt, ключ)),
 * путь без домена; соль — свежий UUID на каждый запрос.
 */
async function np<T = any>(path: string): Promise<T> {
  if (!BASE || !MERCHANT || !API_KEY) {
    throw Object.assign(new Error('Ключи NPay не заданы на сервере 1С'), { status: 500 }) as NpError
  }
  const salt = crypto.randomUUID()
  const signature = crypto.createHmac('sha512', API_KEY).update(path + salt).digest('base64')

  const res = await fetch(`${BASE}${path}`, {
    headers: { 'x-merchant-api-salt': salt, 'x-merchant-api-signature': signature },
    signal: AbortSignal.timeout(30_000),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.status === 'ERROR' || body?.error) {
    throw Object.assign(new Error(body?.error?.message ?? `NPay ответил ${res.status}`), {
      status: res.status >= 400 ? res.status : 502,
    }) as NpError
  }
  // Методы ссылок отвечают конвертом { status: "OK", data }, счёт мерчанта —
  // голым объектом. Снимаем конверт, если он есть.
  return (body?.status === 'OK' && body?.data !== undefined ? body.data : body) as T
}

/** Суммы у NPay — в тыйынах (1 сом = 100 тыйын), строкой. */
const som = (tyiyn: unknown) => {
  const n = Number(tyiyn)
  return Number.isFinite(n) ? Math.round(n) / 100 : null
}

/**
 * Какие заказы мини-аппа бывают через SberPay: пополнение рублёвого счёта,
 * выпуск карты и пополнение карты. Отбора по провайдеру у админки мини-аппа
 * нет — параметр она молча игнорирует, — поэтому читаем эти три вида целиком
 * и отбираем NPAY_SBER здесь. Их сотни, а не тысячи.
 */
const TYPES = ['WALLET_TOPUP', 'CARD_ACTIVATION', 'CARD_TOPUP'] as const

type Op = {
  id: string
  type: string
  status: string
  amount: number
  currency: string | null
  exchangeRate: string | null
  description: string | null
  rub: number | null
  som: number | null
  guid: string | null
  link: string | null
  paidAt: string | null
  createdAt: string
  updatedAt: string
  user: { userId: string; telegramUserId: number | null; username: string | null; firstName: string | null }
  metadata: Record<string, unknown>
}

const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

function toOp(t: any): Op {
  const m = (t.metadata ?? {}) as Record<string, any>
  const u = t.user ?? t.users ?? {}
  return {
    id: t.id,
    type: t.type,
    status: t.status,
    amount: Number(t.amount ?? 0),
    currency: t.currency ?? null,
    exchangeRate: t.exchangeRate ?? null,
    description: t.description ?? null,
    // Сколько рублей заплатил клиент. У пополнения кошелька это и есть amount,
    // у карт amount в USD — поэтому сначала metadata.rub.
    rub: num(m.rub) ?? (t.currency === 'RUB' ? num(t.amount) : null),
    som: num(m.som),
    guid: m.guid ?? null,
    link: m.link ?? null,
    paidAt: m.paidAt ?? null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    user: {
      userId: t.userId,
      telegramUserId: u.telegramUserId ?? null,
      username: u.username ?? null,
      firstName: u.firstName ?? null,
    },
    metadata: m,
  }
}

let cache: { at: number; ops: Op[] } | null = null
let loading: Promise<Op[]> | null = null

/**
 * Все SberPay-операции, минута в памяти. Апстрим мини-аппа медленный (сотни
 * записей — десятки секунд), а таблица, сводка и фильтры работают по одному
 * и тому же набору — нет смысла перечитывать его на каждый щелчок.
 */
async function sberOps(fresh = false): Promise<Op[]> {
  if (!fresh && cache && Date.now() - cache.at < 60_000) return cache.ops
  if (loading) return loading

  loading = (async () => {
    const ops: Op[] = []
    for (const type of TYPES) {
      for (let page = 1; page <= 50; page++) {
        const d = await miniappCall<{ data: any[] }>('/api/admin/transactions', { type, page, pageSize: 200 })
        for (const t of d.data ?? []) {
          if (t?.metadata?.provider === 'NPAY_SBER') ops.push(toOp(t))
        }
        if ((d.data ?? []).length < 200) break
      }
    }
    ops.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    cache = { at: Date.now(), ops }
    return ops
  })().finally(() => {
    loading = null
  })

  return loading
}

/**
 * Границы периода в поясе оператора. Даты приходят как ГГГГ-ММ-ДД, причём
 * toDate уже сдвинута на сутки вперёд (так отдаёт LogRangePicker): условие
 * «меньше toDate» берёт весь последний день.
 */
function window(q: Record<string, unknown>) {
  const tz = Math.min(Math.max(Number(q.tzOffset) || 0, 0), 6)
  const at = (d: unknown) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d ?? ''))
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) - tz * 3_600_000 : null
  }
  return { from: at(q.fromDate), to: at(q.toDate) }
}

function filter(ops: Op[], q: Record<string, unknown>): Op[] {
  const { from, to } = window(q)
  const status = q.status ? String(q.status) : null
  const type = q.type ? String(q.type) : null
  const search = String(q.search ?? '').trim().toLowerCase().replace(/^@/, '')

  return ops.filter((o) => {
    const t = Date.parse(o.createdAt)
    if (from != null && t < from) return false
    if (to != null && t >= to) return false
    if (status && o.status !== status) return false
    if (type && o.type !== type) return false
    if (search) {
      const hay = [o.id, o.guid, o.user.username, o.user.firstName, o.user.telegramUserId, o.user.userId]
        .filter((v) => v != null)
        .map((v) => String(v).toLowerCase())
      if (!hay.some((v) => v.includes(search))) return false
    }
    return true
  })
}

const round = (v: number) => Math.round(v * 100) / 100

const fail = (res: any, e: NpError) =>
  res.status(e.status && e.status >= 400 ? e.status : 502).json({ success: false, error: e.message })

export const sberpay = Router()

/**
 * Сводка за период: остаток мерчанта в NPay и итоги по нашим операциям.
 *
 * Деньгами считаются только COMPLETED — так же их считает мини-апп при
 * зачислении. Остальные статусы показываем количеством: по ним видно, сколько
 * ссылок бросили или они истекли.
 */
sberpay.get('/summary', async (req, res) => {
  try {
    // Остаток NPay и операции мини-аппа — из двух разных мест. Не ответило
    // одно — второе всё равно показываем: остаток мерчанта нужен и тогда,
    // когда мини-апп лежит.
    const [merchant, loaded] = await Promise.all([
      np<any>(`/public/merchant/payment/v1/${MERCHANT}`).catch((e: NpError) => ({ error: e.message })),
      sberOps(req.query.fresh === '1').then(
        (ops) => ({ ops, error: null as string | null }),
        (e: NpError) => ({ ops: [] as Op[], error: e.message }),
      ),
    ])
    const ops = filter(loaded.ops, { ...req.query, status: undefined })

    const byStatus: Record<string, number> = {}
    const byType: Record<string, { count: number; rub: number; som: number }> = {}
    let rub = 0
    let somTotal = 0
    let completed = 0

    for (const o of ops) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1
      if (o.status !== 'COMPLETED') continue
      completed++
      rub += o.rub ?? 0
      somTotal += o.som ?? 0
      const b = (byType[o.type] ??= { count: 0, rub: 0, som: 0 })
      b.count++
      b.rub += o.rub ?? 0
      b.som += o.som ?? 0
    }
    for (const b of Object.values(byType)) {
      b.rub = round(b.rub)
      b.som = round(b.som)
    }

    res.json({
      success: true,
      merchant: merchant?.error
        ? { error: merchant.error }
        : {
            status: merchant?.status ?? null,
            currency: merchant?.currency ?? 'KGS',
            balance: som(merchant?.balance),
            debitHold: som(merchant?.debitBalanceHold),
            creditHold: som(merchant?.creditBalanceHold),
          },
      total: ops.length,
      completed: { count: completed, rub: round(rub), som: round(somTotal) },
      byStatus,
      byType,
      operationsError: loaded.error,
      loadedAt: cache ? new Date(cache.at).toISOString() : null,
    })
  } catch (e: any) {
    fail(res, e)
  }
})

sberpay.get('/operations', async (req, res) => {
  try {
    const ops = filter(await sberOps(req.query.fresh === '1'), req.query)
    const pageSize = Math.min(Math.max(Number(req.query.pageSize) || 50, 1), 200)
    const page = Math.max(Number(req.query.page) || 1, 1)
    res.json({
      success: true,
      total: ops.length,
      page,
      pageSize,
      // Сырое тело вебхука NPay в списке не нужно — оно в карточке операции.
      rows: ops.slice((page - 1) * pageSize, page * pageSize).map(({ metadata, ...o }) => o),
    })
  } catch (e: any) {
    fail(res, e)
  }
})

sberpay.get('/operations/:id', async (req, res) => {
  try {
    const op = (await sberOps()).find((o) => o.id === req.params.id)
    if (!op) return res.status(404).json({ success: false, error: 'Операция не найдена' })
    res.json({ success: true, operation: op })
  } catch (e: any) {
    fail(res, e)
  }
})

/**
 * Статус ссылки у самого NPay — по нашему id (externalId = transactions.id).
 * Это и есть сверка: у нас «ожидает», а NPay говорит «оплачено» — значит,
 * не дошёл вебхук.
 */
sberpay.get('/operations/:id/provider', async (req, res) => {
  try {
    const id = String(req.params.id)
    if (!/^[0-9a-f-]{16,64}$/i.test(id)) return res.status(400).json({ success: false, error: 'Неверный id' })
    const data = await np<any>(`/public/merchant/payment/v1/${MERCHANT}/one-time/${id}`)
    res.json({
      success: true,
      provider: {
        guid: data?.guid ?? null,
        status: data?.status ?? null,
        amount: som(data?.amount),
        paymentAmount: som(data?.paymentAmount),
        currency: data?.currencyCode ?? data?.currency ?? 'KGS',
        expiresAt: data?.expiresAt ?? data?.expireAt ?? null,
        paidAt: data?.paidAt ?? data?.completedAt ?? null,
        raw: data,
      },
    })
  } catch (e: any) {
    // 404 — не поломка: у NPay нет ссылки с таким id, то есть операция шла
    // не через SberPay или ссылку так и не создали.
    if (e.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'У NPay нет ссылки с таким id — операция шла не через SberPay или ссылка не создавалась',
      })
    }
    fail(res, e)
  }
})
