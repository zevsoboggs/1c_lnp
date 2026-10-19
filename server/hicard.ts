import { Router } from 'express'
import crypto from 'node:crypto'
import { writeAudit } from './auth.js'
import { miniappCall } from './miniapp.js'

/**
 * Карты HiCard (UQCard, Visa, виртуальные, в USD).
 *
 * Эмитент — HiCard: карты списываются с нашего резерва у него в USDT. Клиентов
 * и их заказы знает мини-апп, сами карты и операции по ним — HiCard. Раздел
 * сводит обе стороны: из HiCard берём карты, балансы, операции и резерв, из
 * мини-аппа — чья это карта и сколько клиент за неё заплатил.
 *
 * Что сюда намеренно не вынесено: выпуск карты, пополнение и полные реквизиты.
 * Выпуск и пополнение списывают деньги с резерва, а оплату за них принимает
 * мини-апп — оператор, нажавший кнопку здесь, пополнил бы карту бесплатно.
 * Реквизиты (номер, срок, CVV) HiCard на бою через API не отдаёт вовсе, и в 1С
 * им делать нечего.
 */

const BASE = (process.env.HICARD_BASE_URL || 'https://api.hicard.tech').replace(/\/$/, '')
const ACCESS_KEY = process.env.HICARD_ACCESS_KEY || ''
const ACCESS_SECRET = process.env.HICARD_ACCESS_SECRET || ''

/** Успешный ответ HiCard — только этот code; любой другой означает ошибку. */
const OK = '2000000'

/**
 * Число, которое уходит в JSON как есть, без кавычек.
 *
 * Идентификаторы HiCard 19-значные: в double они теряют разряды, поэтому у нас
 * они живут строками. Но в запросе HiCard ждёт число — оборачиваем, чтобы
 * сериализатор вывел цифры без кавычек.
 */
class Raw {
  constructor(readonly digits: string) {}
}

/** RFC 3986: encodeURIComponent плюс те знаки, которые он оставляет как есть. */
const rfc = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())

/**
 * Тело запроса: ключи по алфавиту на всех уровнях. Подписывается ровно эта
 * строка — та же, что уходит в сеть, иначе HiCard подпись не примет.
 */
function stableJson(v: unknown): string {
  if (v instanceof Raw) return v.digits
  if (Array.isArray(v)) return `[${v.map(stableJson).join(',')}]`
  if (v && typeof v === 'object') {
    const keys = Object.keys(v as object)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(v)
}

/**
 * Разбор ответа: длинные целые превращаем в строки до JSON.parse — иначе
 * card id 238004046668152832 приедет как 238004046668152830, и карта
 * не найдётся. Метки времени (13 знаков) и суммы остаются числами.
 */
function parseExact(text: string): any {
  return JSON.parse(text.replace(/([:[,]\s*)(-?\d{16,})(?=\s*[,\]}])/g, '$1"$2"'))
}

type HcError = Error & { status?: number; code?: string }

/**
 * Запрос к HiCard с подписью NPIv1.
 *
 *   canonical    = METHOD \n RFC3986(путь целиком) \n query по ключам \n hex(sha1(тело))
 *   stringToSign = AccessKey \n Timestamp \n Nonce \n hex(sha256(canonical))
 *   Signature    = base64(HMAC-SHA512(stringToSign, AccessSecret))
 *
 * Путь кодируется целиком, вместе с «/» — так и только так подпись сходится.
 */
export async function hc<T = any>(
  method: 'GET' | 'POST',
  path: string,
  opts: { query?: Record<string, unknown>; body?: unknown } = {},
): Promise<T> {
  if (!ACCESS_KEY || !ACCESS_SECRET) {
    throw Object.assign(new Error('Ключи HiCard не заданы на сервере 1С'), { status: 500 }) as HcError
  }

  const query = Object.entries(opts.query ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${rfc(k)}=${rfc(String(v))}`)
    .join('&')

  const body = opts.body === undefined ? '' : stableJson(opts.body)
  const canonical = [
    method,
    rfc(path),
    query,
    body ? crypto.createHash('sha1').update(body).digest('hex') : '',
  ].join('\n')

  const ts = String(Date.now())
  const nonce = crypto.randomBytes(16).toString('hex')
  const toSign = [ACCESS_KEY, ts, nonce, crypto.createHash('sha256').update(canonical).digest('hex')].join('\n')
  const signature = crypto.createHmac('sha512', ACCESS_SECRET).update(toSign).digest('base64')

  const res = await fetch(`${BASE}${path}${query ? `?${query}` : ''}`, {
    method,
    headers: {
      Authorization: `NPIv1 ${ACCESS_KEY}:${ts}:${nonce}:${signature}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body || undefined,
    signal: AbortSignal.timeout(30_000),
  })

  const text = await res.text()
  let json: any = null
  try {
    json = parseExact(text)
  } catch {
    /* ниже разберёмся по коду ответа */
  }

  if (!json || String(json.code) !== OK) {
    throw Object.assign(new Error(json?.message || `HiCard ответил ${res.status}`), {
      status: res.status >= 400 ? res.status : 502,
      code: json?.code ? String(json.code) : undefined,
    }) as HcError
  }
  return json.data as T
}

/** Метки времени HiCard — миллисекунды; наружу отдаём ISO, как во всей 1С. */
const iso = (ms: unknown) => (typeof ms === 'number' && ms > 0 ? new Date(ms).toISOString() : null)

/** Статусы HiCard сведены к пяти нашим — так же, как их видит мини-апп. */
export function cardState(status: string | undefined): string {
  switch (status) {
    case 'ACTIVE':
      return 'ACTIVE'
    case 'FROZEN':
      return 'FROZEN'
    case 'CANCELLED':
    case 'CANCELLING':
      return 'CANCELLED'
    case 'REJECTED':
    case 'FAILED':
      return 'FAILED'
    default:
      return 'PENDING'
  }
}

type Owner = {
  userId: string
  telegramUserId: number | null
  username: string | null
  firstName: string | null
  /** Последние цифры номера: HiCard маску не отдаёт, мини-апп её знает. */
  last4: string | null
}

/**
 * Чья карта: HiCard знает только держателя-заглушку, настоящего клиента знает
 * мини-апп. Связка — выпуск карты (CARD_ACTIVATION), у которого карта
 * указана как paywaveCardId = id карты в HiCard.
 *
 * Выпусков немного (сотни), а нужны они на каждый показ списка карт, поэтому
 * держим их минуту в памяти: апстрим мини-аппа медленный.
 */
let ownersCache: { at: number; map: Map<string, Owner> } | null = null
let ownersLoading: Promise<Map<string, Owner>> | null = null

async function owners(): Promise<Map<string, Owner>> {
  if (ownersCache && Date.now() - ownersCache.at < 60_000) return ownersCache.map
  if (ownersLoading) return ownersLoading

  ownersLoading = (async () => {
    const map = new Map<string, Owner>()
    for (let page = 1; page <= 20; page++) {
      const data = await miniappCall<{ data: any[]; total: number }>('/api/admin/transactions', {
        type: 'CARD_ACTIVATION',
        page,
        pageSize: 200,
      })
      for (const t of data.data ?? []) {
        const cardId = t?.metadata?.providerCardId ?? t?.card?.paywaveCardId ?? t?.cards?.paywaveCardId
        const u = t?.user ?? t?.users
        const pan: string | undefined = (t?.card ?? t?.cards)?.cardNumber
        if (cardId && !map.has(String(cardId))) {
          map.set(String(cardId), {
            userId: t.userId,
            telegramUserId: u?.telegramUserId ?? null,
            username: u?.username ?? null,
            firstName: u?.firstName ?? null,
            last4: pan ? pan.replace(/\D/g, '').slice(-4) || null : null,
          })
        }
      }
      if ((data.data ?? []).length < 200) break
    }
    ownersCache = { at: Date.now(), map }
    return map
  })().finally(() => {
    ownersLoading = null
  })

  return ownersLoading
}

/** Мини-апп недоступен — карты всё равно показываем, просто без владельца. */
async function ownersSafe(): Promise<Map<string, Owner>> {
  try {
    return await owners()
  } catch {
    return new Map()
  }
}

function cardPayload(c: any, owner?: Owner, balance?: number | null) {
  return {
    id: String(c.id),
    status: cardState(c.status),
    hicardStatus: c.status ?? null,
    statusTitle: c.status_title ?? null,
    scheme: c.scheme ?? null,
    form: c.form ?? null,
    currency: c.currency ?? 'USD',
    bin: c.bin ?? null,
    // Маску отдаём только последними цифрами: полный номер в 1С не нужен.
    last4: owner?.last4 ?? null,
    cardholderId: c.cardholder_id != null ? String(c.cardholder_id) : null,
    country: c.country ?? null,
    balance: balance ?? null,
    createdAt: iso(c.created_at),
    owner: owner ?? null,
  }
}

function txPayload(t: any, owner?: Owner) {
  return {
    id: String(t.id),
    cardId: t.card_id != null ? String(t.card_id) : null,
    type: t.type ?? null,
    typeTitle: t.type_title ?? null,
    status: t.status ?? null,
    statusTitle: t.status_title ?? null,
    amount: t.amount ?? null,
    currency: t.currency ?? null,
    billingAmount: t.billing_amount ?? null,
    billingCurrency: t.billing_currency ?? null,
    fee: t.billing_transaction_fee ?? null,
    merchant: t.merchant?.name ?? t.merchant?.merchant_name ?? null,
    mcc: t.merchant?.mcc ?? null,
    merchantCountry: t.merchant?.country ?? null,
    reason: t.reason ?? null,
    description: t.description ?? null,
    occurredAt: iso(t.occurred_at),
    owner: owner ?? null,
  }
}

const balanceOf = async (id: string): Promise<number | null> => {
  try {
    const b = await hc<any>('GET', `/v1/cards/balances/${id}`)
    const v = Number(b?.available ?? b?.rows?.[0]?.available)
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

const limitOf = (v: unknown, max = 100) => Math.min(Math.max(Number(v) || 50, 1), max)
const offsetOf = (v: unknown) => Math.max(Number(v) || 0, 0)

const fail = (res: any, e: HcError) =>
  res.status(e.status && e.status >= 400 ? e.status : 502).json({ success: false, error: e.message, code: e.code })

export const cards = Router()

// ── Обзор ────────────────────────────────────────────────────────────────────

/**
 * Все карты HiCard целиком. Их десятки; потолок в тысячу — защита от
 * неожиданного роста, а не лимит.
 */
async function allCards(): Promise<any[]> {
  const first = await hc<any>('GET', '/v1/cards', { query: { limit: 100, offset: 0 } })
  const rows: any[] = [...(first?.rows ?? [])]
  const total = Number(first?.total ?? rows.length)
  for (let offset = rows.length; offset < Math.min(total, 1000); offset += 100) {
    const next = await hc<any>('GET', '/v1/cards', { query: { limit: 100, offset } })
    rows.push(...(next?.rows ?? []))
    if ((next?.rows ?? []).length === 0) break
  }
  return rows
}

/** Все движения резерва — по ним HiCard говорит, сколько на самом деле ушло. */
async function allMovements(): Promise<any[]> {
  const rows: any[] = []
  for (let offset = 0; offset < 5000; offset += 100) {
    const d = await hc<any>('GET', '/v1/reserves/movements', { query: { limit: 100, offset } })
    rows.push(...(d?.rows ?? []))
    if ((d?.rows ?? []).length < 100) break
  }
  return rows
}

/** Резерв и картотека одним ответом — это то, что открывают первым. */
cards.get('/summary', async (_req, res) => {
  try {
    const [reserves, rows] = await Promise.all([hc<any>('GET', '/v1/reserves'), allCards()])

    const byStatus: Record<string, number> = {}
    for (const c of rows) {
      const s = cardState(c.status)
      byStatus[s] = (byStatus[s] ?? 0) + 1
    }

    res.json({
      success: true,
      reserves: (reserves?.rows ?? []).map((r: any) => ({
        id: String(r.id),
        type: r.type_title ?? r.type,
        currency: r.currency,
        available: Number(r.available ?? 0),
        holding: Number(r.holding ?? 0),
        pending: Number(r.pending ?? 0),
        frozen: Number(r.frozen ?? 0),
      })),
      cards: { total: rows.length, byStatus },
    })
  } catch (e: any) {
    fail(res, e)
  }
})

/** id карты HiCard, к которой относится заказ мини-аппа. */
const cardOf = (t: any): string | null => {
  const id = t?.metadata?.providerCardId ?? t?.card?.paywaveCardId ?? t?.cards?.paywaveCardId
  return id != null && id !== '' ? String(id) : null
}

/**
 * Выручка по картам HiCard за период.
 *
 * В заказах мини-аппа лежат и карты прежних провайдеров (PaySpace, Card
 * Program): их карты удалены, а заказы остались. Считать их сюда нельзя —
 * выходило 60 выпусков при 26 картах. Поэтому заказ попадает в выручку,
 * только если его карта есть у HiCard.
 *
 * Пополнение без поля credited (сколько ушло на карту) не додумываем: такая
 * операция не попадает в расчёт комиссии и показывается отдельным числом.
 * Иначе вся сумма пополнения считалась бы нашей комиссией.
 *
 * Рядом — то же по данным самого HiCard из движений резерва: сколько карт
 * выпущено, сколько денег ушло на карты и что эмитент удержал. Расхождение
 * заказов с резервом — повод разбираться.
 */
cards.get('/revenue', async (req, res) => {
  try {
    const period = { fromDate: req.query.fromDate, toDate: req.query.toDate }
    const all = async (type: string) => {
      const out: any[] = []
      for (let page = 1; page <= 50; page++) {
        const d = await miniappCall<{ data: any[] }>('/api/admin/transactions', {
          type,
          status: 'COMPLETED',
          page,
          pageSize: 200,
          ...period,
        })
        out.push(...(d.data ?? []))
        if ((d.data ?? []).length < 200) break
      }
      return out
    }

    const [cardRows, movements, activations, topups, topupsRub] = await Promise.all([
      allCards(),
      allMovements(),
      all('CARD_ACTIVATION'),
      all('CARD_TOPUP'),
      all('CARD_TOPUP_RUB'),
    ])

    const hicardIds = new Set(cardRows.map((c) => String(c.id)))
    const ours = (t: any) => {
      const id = cardOf(t)
      return id != null && hicardIds.has(id)
    }

    const num = (v: unknown): number | null =>
      v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v)
    const round = (v: number) => Math.round(v * 100) / 100

    // Прежние провайдеры карт отключены 15.10.2026 (документация по картам,
    // п. 1). Заказ после этой даты — эпоха HiCard, даже если связать его с
    // картой не удалось: прятать такой в «старые» нельзя, его надо показать.
    const HICARD_FROM = Date.UTC(2026, 9, 15)
    const hicardEra = (t: any) =>
      Date.parse(t.createdAt) >= HICARD_FROM || t.metadata?.programId === 'LNP_HICARD'

    /** Короткая строка заказа для списка «не сопоставлено» — человеку разбирать руками. */
    const brief = (t: any, why: string) => {
      const u = t.user ?? t.users
      return {
        id: t.id,
        type: t.type,
        createdAt: t.createdAt,
        amount: num(t.amount),
        currency: t.currency ?? null,
        user: u ? (u.username ? `@${u.username}` : u.firstName ?? String(u.telegramUserId ?? '')) : null,
        telegramUserId: u?.telegramUserId ?? null,
        cardId: cardOf(t),
        feeUsd: num(t.metadata?.feeUsd),
        credited: num(t.metadata?.credited),
        method: t.metadata?.provider ?? t.metadata?.paymentMethod ?? null,
        why,
      }
    }

    const unmatched: ReturnType<typeof brief>[] = []
    let legacy = 0

    // ── выпуск ──
    const issued: any[] = []
    for (const t of activations) {
      if (ours(t)) issued.push(t)
      else if (hicardEra(t)) {
        unmatched.push(brief(t, cardOf(t) ? 'карты с таким id у HiCard нет' : 'в заказе не указана карта'))
      } else legacy++
    }
    let issueUsd = 0
    let issueNoFee = 0
    for (const t of issued) {
      const fee = num(t.metadata?.feeUsd)
      // Без суммы выпуска не подставляем 35: это может быть промокод,
      // а может быть незаполненное поле. Считаем отдельно.
      if (fee == null || fee === 0) {
        issueNoFee++
        unmatched.push(brief(t, fee === 0 ? 'выпуск за 0 USD (промокод?)' : 'в заказе нет суммы выпуска (feeUsd)'))
      } else issueUsd += fee
    }

    // ── пополнения ──
    let gross = 0
    let credited = 0
    let counted = 0
    const topupsOurs: any[] = []
    for (const t of [...topups, ...topupsRub]) {
      if (ours(t)) topupsOurs.push(t)
      else if (hicardEra(t)) {
        unmatched.push(brief(t, cardOf(t) ? 'карты с таким id у HiCard нет' : 'в заказе не указана карта'))
      } else legacy++
    }
    let noCredited = 0
    for (const t of topupsOurs) {
      const g = t.type === 'CARD_TOPUP_RUB' ? num(t.metadata?.gross) : num(t.amount)
      const c = num(t.metadata?.credited)
      if (g == null || c == null) {
        noCredited++
        unmatched.push(brief(t, 'нет данных, сколько ушло на карту (credited)'))
        continue
      }
      gross += g
      credited += c
      counted++
    }

    const byMethod: Record<string, number> = {}
    for (const t of [...issued, ...topupsOurs]) {
      const p = t.metadata?.provider ?? t.metadata?.paymentMethod ?? 'INTERNAL'
      byMethod[p] = (byMethod[p] ?? 0) + 1
    }

    // ── по данным HiCard ──
    // Те же границы периода, что у заказов: даты в UTC, toDate — следующий день.
    const at = (d: unknown) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d ?? ''))
      return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null
    }
    const from = at(period.fromDate)
    const to = at(period.toDate)
    const inPeriod = (ms: unknown) =>
      typeof ms === 'number' && (from == null || ms >= from) && (to == null || ms < to)

    const reserve = { creations: 0, creationFees: 0, deposits: 0, deposited: 0, depositFees: 0, topUps: 0 }
    const depositRows: any[] = []
    for (const m of movements) {
      if (!inPeriod(m.occurred_at)) continue
      const amt = Number(m.amount ?? 0)
      if (m.type === 'CARD_CREATION_FEE') {
        reserve.creations++
        reserve.creationFees += amt
      } else if (m.type === 'CARD_DEPOSIT') {
        reserve.deposits++
        reserve.deposited += amt
        depositRows.push(m)
      } else if (m.type === 'CARD_DEPOSIT_FEE') {
        reserve.depositFees += amt
      } else if (m.to_party?.type === 'RESERVE') {
        reserve.topUps += amt
      }
    }

    // Пополнения у HiCard без заказа: на ту же карту и на ту же сумму
    // (credited ≈ сумма депозита) заказа не нашлось. Это деньги, которые
    // ушли с резерва на карту, а оплата за них в заказах не видна.
    const pool = topupsOurs
      .map((t) => ({ card: cardOf(t), credited: num(t.metadata?.credited) }))
      .filter((x) => x.credited != null)
    const orphanDeposits: Array<{ cardId: string | null; amount: number; occurredAt: string | null; owner: string | null }> = []
    const map = await ownersSafe()
    for (const m of depositRows) {
      const card = m.to_party?.card_id != null ? String(m.to_party.card_id) : null
      const i = pool.findIndex((x) => x.card === card && Math.abs((x.credited ?? 0) - Number(m.amount)) < 0.06)
      if (i >= 0) pool.splice(i, 1)
      else {
        const o = card ? map.get(card) : undefined
        orphanDeposits.push({
          cardId: card,
          amount: Number(m.amount),
          occurredAt: iso(m.occurred_at),
          owner: o ? (o.username ? `@${o.username}` : o.firstName ?? null) : null,
        })
      }
    }

    const fee = gross - credited
    const cost = reserve.creationFees + reserve.depositFees

    res.json({
      success: true,
      issued: { count: issued.length, paidCount: issued.length - issueNoFee, usd: round(issueUsd), noFee: issueNoFee },
      topups: {
        count: topupsOurs.length,
        counted,
        withoutCredited: noCredited,
        grossUsd: round(gross),
        creditedUsd: round(credited),
        feeUsd: round(fee),
      },
      revenueUsd: round(issueUsd + fee),
      hicard: {
        cardsIssued: reserve.creations,
        issueCostUsdt: round(reserve.creationFees),
        deposits: reserve.deposits,
        depositedUsdt: round(reserve.deposited),
        depositFeesUsdt: round(reserve.depositFees),
        reserveTopUpsUsdt: round(reserve.topUps),
      },
      costUsd: round(cost),
      marginUsd: round(issueUsd + fee - cost),
      unmatched,
      orphanDeposits,
      legacyExcluded: legacy,
      byMethod,
    })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})

// ── Резерв ───────────────────────────────────────────────────────────────────

/**
 * Движения резерва: выпуск (CARD_CREATION_FEE), деньги на карты
 * (CARD_DEPOSIT), комиссия эмитента (CARD_DEPOSIT_FEE), пополнения.
 * По ним сходится наш расход у HiCard.
 */
cards.get('/reserve/movements', async (req, res) => {
  try {
    const data = await hc<any>('GET', '/v1/reserves/movements', {
      query: { limit: limitOf(req.query.limit), offset: offsetOf(req.query.offset) },
    })
    res.json({
      success: true,
      total: Number(data?.total ?? 0),
      rows: (data?.rows ?? []).map((m: any) => ({
        id: String(m.id),
        type: m.type ?? null,
        typeTitle: m.type_title ?? null,
        currency: m.currency ?? null,
        amount: Number(m.amount ?? 0),
        before: m.available_before != null ? Number(m.available_before) : null,
        after: m.available_after != null ? Number(m.available_after) : null,
        description: m.description ?? null,
        sourceType: m.source_type ?? null,
        sourceId: m.source_id != null ? String(m.source_id) : null,
        occurredAt: iso(m.occurred_at),
      })),
    })
  } catch (e: any) {
    fail(res, e)
  }
})

// ── Карты ────────────────────────────────────────────────────────────────────

cards.get('/list', async (req, res) => {
  try {
    const limit = limitOf(req.query.limit)
    const [data, map] = await Promise.all([
      hc<any>('GET', '/v1/cards', {
        query: { limit, offset: offsetOf(req.query.offset), status: req.query.status },
      }),
      ownersSafe(),
    ])
    const rows: any[] = data?.rows ?? []
    // Баланс у HiCard — отдельный запрос на карту. На странице их десятки,
    // спрашиваем параллельно; не ответил — показываем прочерк, а не ошибку.
    const balances = await Promise.all(rows.map((c) => balanceOf(String(c.id))))
    res.json({
      success: true,
      total: Number(data?.total ?? rows.length),
      rows: rows.map((c, i) => cardPayload(c, map.get(String(c.id)), balances[i])),
    })
  } catch (e: any) {
    fail(res, e)
  }
})

cards.get('/card/:id', async (req, res) => {
  try {
    const id = String(req.params.id)
    if (!/^\d{6,25}$/.test(id)) return res.status(400).json({ success: false, error: 'Неверный id карты' })
    const [card, balance, map] = await Promise.all([hc<any>('GET', `/v1/cards/${id}`), balanceOf(id), ownersSafe()])
    res.json({ success: true, card: cardPayload(card, map.get(id), balance) })
  } catch (e: any) {
    fail(res, e)
  }
})

/** Операции по картам у эмитента: покупки, возвраты, отказы с причиной. */
cards.get('/transactions', async (req, res) => {
  try {
    const cardId = req.query.cardId ? String(req.query.cardId) : undefined
    if (cardId && !/^\d{6,25}$/.test(cardId)) {
      return res.status(400).json({ success: false, error: 'Неверный id карты' })
    }
    const [data, map] = await Promise.all([
      hc<any>('GET', '/v1/cards/transactions', {
        query: { card_id: cardId, limit: limitOf(req.query.limit), offset: offsetOf(req.query.offset) },
      }),
      ownersSafe(),
    ])
    res.json({
      success: true,
      total: Number(data?.total ?? 0),
      rows: (data?.rows ?? []).map((t: any) => txPayload(t, map.get(String(t.card_id)))),
    })
  } catch (e: any) {
    fail(res, e)
  }
})

/**
 * Заказы по картам в мини-аппе: выпуск, пополнения, покупки. Это денежная
 * сторона — сколько клиент заплатил и чем.
 */
const APP_TYPES = ['CARD_ACTIVATION', 'CARD_TOPUP', 'CARD_TOPUP_RUB', 'CARD_PURCHASE']

cards.get('/operations', async (req, res) => {
  try {
    const type = APP_TYPES.includes(String(req.query.type)) ? String(req.query.type) : undefined
    if (!type) {
      return res.status(400).json({ success: false, error: `type: ${APP_TYPES.join(', ')}` })
    }
    const data = await miniappCall<{ data: any[]; total: number; page: number; pageSize: number }>(
      '/api/admin/transactions',
      {
        type,
        page: req.query.page ?? 1,
        pageSize: Math.min(Number(req.query.pageSize) || 50, 200),
        status: req.query.status,
        telegramUserId: req.query.telegramUserId,
        fromDate: req.query.fromDate,
        toDate: req.query.toDate,
      },
    )
    res.json({
      success: true,
      total: data.total ?? 0,
      page: data.page,
      pageSize: data.pageSize,
      rows: (data.data ?? []).map((t) => {
        const u = t.user ?? t.users
        const c = t.card ?? t.cards
        const pan: string | undefined = c?.cardNumber
        return {
          id: t.id,
          type: t.type,
          status: t.status,
          amount: t.amount,
          fee: t.fee,
          currency: t.currency,
          exchangeRate: t.exchangeRate,
          description: t.description,
          merchantName: t.merchantName,
          mcc: t.mcc,
          declineReason: t.declineReason,
          metadata: t.metadata ?? null,
          createdAt: t.createdAt,
          user: u ? { telegramUserId: u.telegramUserId, username: u.username, firstName: u.firstName } : null,
          card: c ? { last4: pan ? pan.slice(-4) : null, hicardId: c.paywaveCardId ?? null } : null,
        }
      }),
    })
  } catch (e: any) {
    res.status(e.status ?? 502).json({ success: false, error: e.message })
  }
})

// ── Заморозка ────────────────────────────────────────────────────────────────

/**
 * Заморозить и разморозить — единственное, что раздел меняет у эмитента.
 * Нужно поддержке: клиент потерял телефон, видит чужие списания. Денег это не
 * двигает и обратимо. business_id у каждой операции свой — повтор с тем же
 * HiCard отбивает как конфликт, это его защита от двойного действия.
 */
async function alter(req: any, res: any, to: 'FREEZE' | 'UNFREEZE') {
  try {
    const id = String(req.params.id)
    if (!/^\d{6,25}$/.test(id)) return res.status(400).json({ success: false, error: 'Неверный id карты' })

    const businessId = `lnp1c-${to.toLowerCase()}-${crypto.randomBytes(8).toString('hex')}`
    await hc('POST', '/v1/cards/status', { body: { id: new Raw(id), alter: to, business_id: businessId } })
    await writeAudit(req, to === 'FREEZE' ? 'CARD_FREEZE' : 'CARD_UNFREEZE', 'hicard-card', id, {
      businessId,
      reason: req.body?.reason ?? null,
    })

    const card = await hc<any>('GET', `/v1/cards/${id}`)
    res.json({ success: true, card: cardPayload(card, (await ownersSafe()).get(id), await balanceOf(id)) })
  } catch (e: any) {
    fail(res, e)
  }
}

cards.post('/card/:id/freeze', (req, res) => alter(req, res, 'FREEZE'))
cards.post('/card/:id/unfreeze', (req, res) => alter(req, res, 'UNFREEZE'))
