import type { AuthProvider } from '@refinedev/core'

export type Level = 'none' | 'read' | 'write'
export type Section = { key: string; label: string; group: string }

export type Me = {
  id: string
  username: string
  full_name: string | null
  role_id: string | null
  role_name: string | null
  is_system: boolean
  permissions: Record<string, Level>
}

/**
 * Сессия живёт в httpOnly-cookie: JS до неё не дотягивается, поэтому здесь
 * нет ни токенов, ни localStorage — только запросы к своему бэкенду.
 */
let cached: Me | null = null

export const getMe = () => cached

async function fetchMe(): Promise<Me | null> {
  const r = await fetch('/api/auth/me')
  if (!r.ok) return null
  const b = await r.json()
  cached = b.user ?? null
  return cached
}

export const authProvider: AuthProvider = {
  login: async ({ username, password }) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const b = await r.json().catch(() => null)
    if (!r.ok || !b?.success) {
      return {
        success: false,
        error: { name: 'Вход не выполнен', message: b?.error ?? 'Неверный логин или пароль' },
      }
    }
    cached = b.user
    return { success: true, redirectTo: '/' }
  },

  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    cached = null
    return { success: true, redirectTo: '/login' }
  },

  check: async () => {
    const me = await fetchMe()
    return me ? { authenticated: true } : { authenticated: false, redirectTo: '/login' }
  },

  onError: async (error) => {
    // 401 — сессия кончилась; 403 — прав нет, но выкидывать не нужно.
    if (error?.statusCode === 401 || error?.code === 'NO_AUTH') {
      cached = null
      return { logout: true, redirectTo: '/login' }
    }
    return {}
  },

  getIdentity: async () => {
    const me = cached ?? (await fetchMe())
    if (!me) return null
    return { id: me.id, name: me.full_name || me.username, role: me.role_name }
  },

  getPermissions: async () => (cached ?? (await fetchMe()))?.permissions ?? {},
}
