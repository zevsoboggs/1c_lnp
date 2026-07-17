import type { Level, Section } from './authProvider'

export type AdminUser = {
  id: string
  username: string
  full_name: string | null
  role_id: string | null
  role_name: string | null
  role_is_system: boolean
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

export type Role = {
  id: string
  name: string
  description: string | null
  is_system: boolean
  permissions: Record<string, Level>
  users_count: number
  created_at: string
}

export type AuditEntry = {
  id: string
  username: string | null
  action: string
  entity: string | null
  entity_id: string | null
  details: any
  ip_address: string | null
  created_at: string
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) throw new Error(body?.error ?? `Ошибка ${res.status}`)
  return body as T
}

export const adminApi = {
  users: () => call<{ users: AdminUser[] }>('/users'),

  createUser: (v: { username: string; fullName?: string; password: string; roleId: string }) =>
    call<{ user: AdminUser }>('/users', { method: 'POST', body: JSON.stringify(v) }),

  updateUser: (
    id: string,
    v: { fullName?: string; roleId?: string; isActive?: boolean; password?: string },
  ) => call<{}>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(v) }),

  deleteUser: (id: string) => call<{}>(`/users/${id}`, { method: 'DELETE' }),

  kick: (id: string) => call<{ revoked: number }>(`/users/${id}/kick`, { method: 'POST' }),

  roles: () => call<{ roles: Role[]; sections: Section[] }>('/roles'),

  createRole: (v: { name: string; description?: string; permissions: Record<string, Level> }) =>
    call<{ role: Role }>('/roles', { method: 'POST', body: JSON.stringify(v) }),

  updateRole: (
    id: string,
    v: { name?: string; description?: string; permissions?: Record<string, Level> },
  ) => call<{}>(`/roles/${id}`, { method: 'PATCH', body: JSON.stringify(v) }),

  deleteRole: (id: string) => call<{}>(`/roles/${id}`, { method: 'DELETE' }),

  audit: () => call<{ entries: AuditEntry[] }>('/audit'),

  changePassword: (currentPassword: string, newPassword: string) =>
    fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    }).then(async (r) => {
      const b = await r.json().catch(() => null)
      if (!r.ok || !b?.success) throw new Error(b?.error ?? 'Не удалось сменить пароль')
      return b
    }),
}

export const LEVELS: Array<{ value: Level; label: string; color: string }> = [
  { value: 'none', label: 'Нет доступа', color: 'default' },
  { value: 'read', label: 'Только чтение', color: 'blue' },
  { value: 'write', label: 'Полный', color: 'green' },
]
