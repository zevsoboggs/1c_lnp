/** Клиент к своему бэкенду для виртуальных карт PAY.SPACE. */

export type Card = {
  id: number
  card_id: string
  card_no: string
  exp_date: string
  cvv: string | null
  currency: string
  status: string
  status_display: string
  balance: number
  used_amt: number | null
  total_amt: number | null
  callback_url: string | null
  sub_id: string | null
  provider: string | null
  created_at: string
  updated_at: string
  masked?: boolean
}

export type CardTxn = {
  id: number
  txn_id: string
  card_id: string
  type: 'A' | 'R' | string
  type_display: string
  status: string
  status_display: string
  txn_currency: string
  txn_amount: number
  bill_currency: string
  bill_amount: number
  auth_code: string | null
  merchant_name: string | null
  merchant_country: string | null
  mcc: string | null
  decline_reason: string | null
  txn_time: string
  created_at: string
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/vcc${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    throw Object.assign(new Error(body?.error ?? `Ошибка ${res.status}`), {
      code: body?.code,
      status: res.status,
    })
  }
  return body as T
}

const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const vccApi = {
  balance: () => call<{ balance: string; pending: string; currency: string }>('/user/balance'),

  cards: (q: { card_id?: string; status?: string; limit?: number; offset?: number } = {}) =>
    call<{ cards: Card[]; total?: number }>(`/cards${qs(q)}`),

  transactions: (
    q: { card_id?: string; type?: string; date_from?: string; date_to?: string; limit?: number } = {},
  ) => call<{ transactions: CardTxn[]; total?: number }>(`/transactions${qs(q)}`),

  /** Полные реквизиты — только по явному запросу одной карты. */
  reveal: (card_id: string) =>
    call<{ card: { card_no: string; cvv: string; exp_date: string } }>(
      `/card/reveal${qs({ card_id })}`,
    ).then((r) => r.card),

  create: (body: { amount: string; expdate?: string; network?: string; callback_url?: string }) =>
    call<any>('/card/create', { method: 'POST', body: JSON.stringify(body) }),

  topup: (body: { card_id: string; amt: string }) =>
    call<any>('/card/topup', { method: 'POST', body: JSON.stringify(body) }),

  withdraw: (body: { card_id: string; amt: string }) =>
    call<any>('/card/withdraw', { method: 'POST', body: JSON.stringify(body) }),

  release: (card_id: string) =>
    call<any>('/card/release', { method: 'POST', body: JSON.stringify({ card_id }) }),

  updateEmail: (body: { card_id: string; email: string }) =>
    call<any>('/card/update_email', { method: 'POST', body: JSON.stringify(body) }),

  updatePhone: (body: { card_id: string; phone_number: string; zone_number: string }) =>
    call<any>('/card/update_phone', { method: 'POST', body: JSON.stringify(body) }),

  topupCheck: (card_id: string, request_id: string) =>
    call<any>(`/card/topup/check${qs({ card_id, request_id })}`),

  withdrawCheck: (card_id: string, request_id: string) =>
    call<any>(`/card/withdraw/check${qs({ card_id, request_id })}`),
}

/** Коды статусов карты из документации PAY.SPACE. */
export const CARD_STATUS: Record<string, { label: string; color: string }> = {
  '0': { label: 'Деактивирована', color: 'default' },
  '1': { label: 'Активна', color: 'success' },
  '2': { label: 'Заморожена', color: 'blue' },
  '3': { label: 'Истекла', color: 'default' },
  '4': { label: 'Заблокирована', color: 'error' },
  '9': { label: 'Не активирована', color: 'warning' },
}
