/** Клиент раздела «Карты»: HiCard через свой сервер, ключи наружу не уезжают. */

export type Owner = {
  userId: string
  telegramUserId: number | null
  username: string | null
  firstName: string | null
  last4: string | null
}

export type HiCard = {
  id: string
  status: 'ACTIVE' | 'FROZEN' | 'PENDING' | 'CANCELLED' | 'FAILED' | string
  hicardStatus: string | null
  statusTitle: string | null
  scheme: string | null
  form: string | null
  currency: string
  bin: string | null
  last4: string | null
  cardholderId: string | null
  country: string | null
  balance: number | null
  createdAt: string | null
  owner: Owner | null
}

export type CardTx = {
  id: string
  cardId: string | null
  type: string | null
  typeTitle: string | null
  status: string | null
  statusTitle: string | null
  amount: number | null
  currency: string | null
  billingAmount: number | null
  billingCurrency: string | null
  fee: number | null
  merchant: string | null
  mcc: string | null
  merchantCountry: string | null
  reason: string | null
  description: string | null
  occurredAt: string | null
  owner: Owner | null
}

export type Movement = {
  id: string
  type: string | null
  typeTitle: string | null
  currency: string | null
  amount: number
  before: number | null
  after: number | null
  description: string | null
  sourceType: string | null
  sourceId: string | null
  occurredAt: string | null
}

export type AppOperation = {
  id: string
  type: string
  status: string
  amount: number
  fee: number
  currency: string | null
  exchangeRate: string | null
  description: string | null
  merchantName: string | null
  mcc: string | null
  declineReason: string | null
  metadata: Record<string, any> | null
  createdAt: string
  user: { telegramUserId: number; username: string | null; firstName: string | null } | null
  card: { last4: string | null; hicardId: string | null } | null
}

export type Summary = {
  reserves: Array<{
    id: string
    type: string
    currency: string
    available: number
    holding: number
    pending: number
    frozen: number
  }>
  cards: { total: number; byStatus: Record<string, number> }
}

export type Revenue = {
  issued: { count: number; usd: number }
  topups: { count: number; grossUsd: number; creditedUsd: number; feeUsd: number }
  revenueUsd: number
  byProvider: Record<string, number>
}

const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/cards${path}`, init)
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) throw new Error(body?.error ?? `Ошибка ${res.status}`)
  return body as T
}

type Page<T> = { total: number; rows: T[] }

export const cardsApi = {
  summary: () => call<Summary>('/summary'),
  revenue: (q: { fromDate?: string; toDate?: string }) => call<Revenue>(`/revenue${qs(q)}`),
  list: (q: { limit: number; offset: number; status?: string }) => call<Page<HiCard>>(`/list${qs(q)}`),
  card: (id: string) => call<{ card: HiCard }>(`/card/${id}`),
  transactions: (q: { limit: number; offset: number; cardId?: string }) =>
    call<Page<CardTx>>(`/transactions${qs(q)}`),
  movements: (q: { limit: number; offset: number }) => call<Page<Movement>>(`/reserve/movements${qs(q)}`),
  operations: (q: {
    type: string
    page: number
    pageSize: number
    status?: string
    telegramUserId?: string
    fromDate?: string
    toDate?: string
  }) => call<Page<AppOperation> & { page: number; pageSize: number }>(`/operations${qs(q)}`),
  freeze: (id: string, reason?: string) =>
    call<{ card: HiCard }>(`/card/${id}/freeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }),
  unfreeze: (id: string, reason?: string) =>
    call<{ card: HiCard }>(`/card/${id}/unfreeze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    }),
}

export const CARD_STATUS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Активна', color: 'success' },
  FROZEN: { label: 'Заморожена', color: 'blue' },
  PENDING: { label: 'Выпускается', color: 'processing' },
  CANCELLED: { label: 'Закрыта', color: 'default' },
  FAILED: { label: 'Не выпущена', color: 'error' },
}

/** Виды операций у HiCard. Авторизация — попытка покупки, расчёт — списание. */
export const TX_TYPE: Record<string, string> = {
  AUTHORIZATION: 'Авторизация',
  SETTLEMENT: 'Списание',
  REFUND: 'Возврат',
  REVERSAL: 'Отмена',
  DEPOSIT: 'Пополнение',
  FEE: 'Комиссия',
  VERIFICATION: 'Проверка карты',
}

export const TX_STATUS: Record<string, { label: string; color: string }> = {
  SUCCESS: { label: 'Успешно', color: 'success' },
  PENDING: { label: 'В обработке', color: 'processing' },
  FAILED: { label: 'Отказ', color: 'error' },
  DECLINED: { label: 'Отклонено', color: 'error' },
  REVERSED: { label: 'Отменено', color: 'default' },
}

/** Движения резерва: так их видит сверка с HiCard (см. документацию по картам, п. 9). */
export const MOVEMENT_TYPE: Record<string, string> = {
  CARD_CREATION_FEE: 'Выпуск карты',
  CARD_DEPOSIT: 'Деньги на карту',
  CARD_DEPOSIT_FEE: 'Комиссия за пополнение',
  RESERVE_DEPOSIT: 'Пополнение резерва',
  DEPOSIT: 'Пополнение резерва',
}

export const APP_STATUS: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: 'Выполнен', color: 'success' },
  PENDING: { label: 'Ожидает', color: 'processing' },
  PROCESSING: { label: 'В обработке', color: 'blue' },
  FAILED: { label: 'Ошибка', color: 'error' },
  EXPIRED: { label: 'Истёк', color: 'default' },
  CANCELLED: { label: 'Отменён', color: 'default' },
}

export const APP_TYPES: Array<{ value: string; label: string }> = [
  { value: 'CARD_ACTIVATION', label: 'Выпуск карты' },
  { value: 'CARD_TOPUP', label: 'Пополнение (крипта / SberPay)' },
  { value: 'CARD_TOPUP_RUB', label: 'Пополнение с рублёвого счёта' },
  { value: 'CARD_PURCHASE', label: 'Покупки по карте' },
]

export const PAY_PROVIDER: Record<string, string> = {
  NPAY_SBER: 'SberPay',
  EVM_DIRECT: 'Перевод USDT',
  INTERNAL: 'Рублёвый счёт',
  WALLET: 'Кошелёк приложения',
  PROMO: 'Промокод',
}

export const usd = (v: number | null | undefined, cur = 'USD') =>
  v == null || !Number.isFinite(Number(v))
    ? '—'
    : `${new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v))} ${cur}`

export const ownerLabel = (o: { username?: string | null; firstName?: string | null } | null | undefined) =>
  o ? (o.username ? `@${o.username}` : o.firstName ?? '—') : '—'

/**
 * Statistic по умолчанию пишет «194,084.75» и отрезает лишние знаки вместо
 * округления (715.779 → 715.77). Для денег это неверно дважды.
 */
export const statMoney = (v: number | string | undefined) =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v ?? 0))
