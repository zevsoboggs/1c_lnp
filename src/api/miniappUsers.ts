export type MiniappUser = {
  id: string
  telegramUserId: number
  username: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  emailVerified: boolean | null
  phone: string | null
  photoUrl: string | null
  internalBalance: string
  referralCode: string | null
  kycStatus: string | null
  kycVerifiedAt: string | null
  kycSessionId: string | null
  cryptoWalletAddress: string | null
  paywaveUserId: string | null
  paywaveWalletId: string | null
  isDepositAutoTopupEnabled: boolean | null
  isVCardAutoTopupEnabled: boolean | null
  createdAt: string
  updatedAt: string
  /** Хеш пароля наружу не отдаётся — только факт, что пароль задан. */
  hasPassword: boolean
  hasKycData: boolean
}

export type Broadcast = {
  id: string
  status: 'running' | 'completed' | string
  sent: number
  blocked: number
  failed: number
  total: number
  message: string
  createdAt: string
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/miniapp${path}`, init)
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) throw new Error(body?.error ?? `Ошибка ${res.status}`)
  return body as T
}

export const AUDIENCES = [
  { value: 'all', label: 'Все пользователи' },
  { value: 'with_cards', label: 'У кого есть карты' },
  { value: 'with_esim', label: 'У кого есть eSIM' },
  { value: 'with_wallet', label: 'С деньгами на балансе' },
]

export const miniappUsers = {
  list: (q: { page?: number; pageSize?: number; search?: string }) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(q)) if (v) p.set(k, String(v))
    return call<{ data: MiniappUser[]; total: number; page: number; pageSize: number }>(
      `/users?${p}`,
    )
  },
}

export const broadcasts = {
  history: () => call<{ broadcasts: Broadcast[] }>('/broadcast/history'),

  status: (id: string) => call<Broadcast & { success: boolean }>(`/broadcast/${id}/status`),

  start: (input: { message: string; audience: string; photo?: File | null }) => {
    const form = new FormData()
    form.append('message', input.message)
    form.append('audience', input.audience)
    if (input.photo) form.append('photo', input.photo)
    // Content-Type не ставим: браузер сам добавит boundary для multipart.
    return call<{ broadcastId: string; total: number }>('/broadcast/start', {
      method: 'POST',
      body: form,
    })
  },
}
