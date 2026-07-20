export type Employee = {
  id: string
  full_name: string
  position: string | null
  email: string | null
  phone: string | null
  telegram: string | null
  percent: number
  is_active: boolean
  comment: string | null
  created_at: string
  updated_at: string
}

export type EmployeeInput = {
  fullName: string
  position?: string
  email?: string
  phone?: string
  telegram?: string
  percent?: number
  isActive?: boolean
  comment?: string
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/employees${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) throw new Error(body?.error ?? `Ошибка ${res.status}`)
  return body as T
}

export const employeesApi = {
  list: () => call<{ employees: Employee[] }>('/'),

  create: (v: EmployeeInput) =>
    call<{ employee: Employee }>('/', { method: 'POST', body: JSON.stringify(v) }),

  update: (id: string, v: Partial<EmployeeInput>) =>
    call<{}>(`/${id}`, { method: 'PATCH', body: JSON.stringify(v) }),

  remove: (id: string) => call<{}>(`/${id}`, { method: 'DELETE' }),
}
