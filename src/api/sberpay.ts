/** Клиент раздела SberPay (NPay). Только чтение: деньги двигает вебхук NPay в мини-аппе. */
import { timezoneOffset } from '../lib/timezone'

export type SberOperation = {
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
  metadata?: Record<string, any>
}

export type SberSummary = {
  merchant:
    | { status: string | null; currency: string; balance: number | null; debitHold: number | null; creditHold: number | null }
    | { error: string }
  total: number
  completed: { count: number; rub: number; som: number }
  byStatus: Record<string, number>
  byType: Record<string, { count: number; rub: number; som: number }>
  operationsError: string | null
  loadedAt: string | null
}

export type ProviderStatus = {
  guid: string | null
  status: string | null
  amount: number | null
  paymentAmount: number | null
  currency: string
  expiresAt: string | null
  paidAt: string | null
  raw: unknown
}

type Filters = {
  fromDate?: string
  toDate?: string
  status?: string
  type?: string
  search?: string
  fresh?: '1'
}

const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams()
  // Границы суток — в поясе оператора: «за 17-е» в Москве и по UTC разные.
  p.set('tzOffset', String(timezoneOffset()))
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  }
  return `?${p.toString()}`
}

async function call<T>(path: string): Promise<T> {
  const res = await fetch(`/api/sberpay${path}`)
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) throw new Error(body?.error ?? `Ошибка ${res.status}`)
  return body as T
}

export const sberpayApi = {
  summary: (q: Filters) => call<SberSummary>(`/summary${qs(q)}`),
  operations: (q: Filters & { page: number; pageSize: number }) =>
    call<{ total: number; page: number; pageSize: number; rows: SberOperation[] }>(`/operations${qs(q)}`),
  operation: (id: string) => call<{ operation: SberOperation }>(`/operations/${id}`),
  provider: (id: string) => call<{ provider: ProviderStatus }>(`/operations/${id}/provider`),
}

export const SBER_TYPE: Record<string, string> = {
  WALLET_TOPUP: 'Пополнение рублёвого счёта',
  CARD_ACTIVATION: 'Выпуск карты',
  CARD_TOPUP: 'Пополнение карты',
}

export const SBER_STATUS: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: 'Оплачено', color: 'success' },
  PENDING: { label: 'Ждёт оплаты', color: 'processing' },
  PROCESSING: { label: 'В обработке', color: 'blue' },
  FAILED: { label: 'Ошибка', color: 'error' },
  EXPIRED: { label: 'Истекла', color: 'default' },
  CANCELLED: { label: 'Отменена', color: 'default' },
  CANCELED: { label: 'Отменена', color: 'default' },
}

/** Статусы ссылки у самого NPay. */
export const NPAY_STATUS: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: 'Оплачена', color: 'success' },
  CREATED: { label: 'Создана', color: 'processing' },
  PENDING: { label: 'Ждёт оплаты', color: 'processing' },
  CANCELED: { label: 'Отменена', color: 'default' },
  FAILED: { label: 'Ошибка', color: 'error' },
  EXPIRED: { label: 'Истекла', color: 'default' },
}

const n2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const rub = (v: number | null | undefined) => (v == null ? '—' : `${n2.format(v)} ₽`)
export const som = (v: number | null | undefined) => (v == null ? '—' : `${n2.format(v)} сом`)
