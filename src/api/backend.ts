/** Клиент к своему бэкенду (server/): курс, расчёт и хранение листов. */

export type Sheet = {
  partner: { id: string; name: string; code: string }
  dateFrom: string
  dateTo: string
  percent: number
  invoicesPaid: number
  usdtMissing: number
  manualTurnover: boolean
  turnoverRub: number
  turnoverUsdt: number
  payoutRub: number
  payoutUsdt: number
  rate: number
  rateAt: string
  rateSource: string
  apiTurnoverRub: number
  apiTurnoverUsdt: number
}

export type SavedSheet = {
  id: string
  number: string
  partner_id: string
  partner_name: string
  partner_code: string | null
  date_from: string
  date_to: string
  percent: string
  invoices_paid: number
  turnover_rub: string
  rate_usdt_rub: string
  rate_at: string
  turnover_usdt: string
  payout_rub: string
  payout_usdt: string
  usdt_missing: number
  manual_turnover: boolean
  comment: string | null
  created_at: string
}

export type CalcInput = {
  partnerId?: string
  dateFrom: string
  dateTo: string
  percent: number
  manualTurnoverRub?: number | null
  comment?: string
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
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

export const api = {
  rate: () => call<{ rate: number; at: string }>('/api/rate'),

  preview: (input: CalcInput) =>
    call<{ sheet: Sheet }>('/api/sheets/preview', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.sheet),

  save: (input: CalcInput) =>
    call<{ sheet: SavedSheet }>('/api/sheets', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((r) => r.sheet),

  list: () =>
    call<{ sheets: SavedSheet[]; total: number }>('/api/sheets'),

  remove: (id: string) => call<{ id: string }>(`/api/sheets/${id}`, { method: 'DELETE' }),
}
