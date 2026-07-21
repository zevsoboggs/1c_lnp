export type Rate = {
  id: string
  percent: number
  is_active: boolean
  partners_count: number
  created_at: string
}

export type Assignment = {
  partner_id: string
  partner_name: string
  rate_id: string | null
  employee_id: string | null
  percent: number | null
  employee_name: string | null
  employee_active: boolean | null
}

export type SheetLine = {
  partnerId: string
  partnerName: string
  percent: number
  turnoverRub: number
  accruedRub: number
}

export type PreviewSheet = {
  employee: { id: string; name: string }
  dateFrom: string
  dateTo: string
  lines: SheetLine[]
  totalRub: number
  partnersCount: number
}

export type SavedSheet = {
  id: string
  number: string
  employee_id: string | null
  employee_name: string
  date_from: string
  date_to: string
  total_rub: string
  partners_count: number
  comment: string | null
  created_at: string
}

export type SavedLine = {
  partner_id: string
  partner_name: string
  percent: number
  turnover_rub: string
  accrued_rub: string
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/salary${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) throw new Error(body?.error ?? `Ошибка ${res.status}`)
  return body as T
}

export const salaryApi = {
  rates: () => call<{ rates: Rate[] }>('/rates'),
  createRate: (percent: number) =>
    call<{ rate: Rate }>('/rates', { method: 'POST', body: JSON.stringify({ percent }) }),
  updateRate: (id: string, v: { percent?: number; isActive?: boolean }) =>
    call<{}>(`/rates/${id}`, { method: 'PATCH', body: JSON.stringify(v) }),
  deleteRate: (id: string) => call<{}>(`/rates/${id}`, { method: 'DELETE' }),

  assignments: () => call<{ assignments: Assignment[] }>('/assignments'),
  setAssignment: (
    partnerId: string,
    v: { partnerName: string; rateId?: string | null; employeeId?: string | null },
  ) => call<{}>(`/assignments/${partnerId}`, { method: 'PUT', body: JSON.stringify(v) }),

  preview: (v: { employeeId: string; dateFrom: string; dateTo: string }) =>
    call<{ sheet: PreviewSheet }>('/preview', { method: 'POST', body: JSON.stringify(v) }).then(
      (r) => r.sheet,
    ),
  save: (v: { employeeId: string; dateFrom: string; dateTo: string; comment?: string }) =>
    call<{ sheet: SavedSheet }>('/sheets', { method: 'POST', body: JSON.stringify(v) }).then(
      (r) => r.sheet,
    ),
  sheets: () => call<{ sheets: SavedSheet[] }>('/sheets'),
  sheet: (id: string) => call<{ sheet: SavedSheet; lines: SavedLine[] }>(`/sheets/${id}`),
  removeSheet: (id: string) => call<{}>(`/sheets/${id}`, { method: 'DELETE' }),
}
