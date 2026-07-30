import { useCustom } from '@refinedev/core'
import { useQuery } from '@tanstack/react-query'
import { action } from './actions'

export type PartnerLite = {
  id: string
  partnerId: string // человекочитаемый код (partner-…)
  name: string
  email: string | null
  parentPartnerId: string | null
  isActive: boolean
}

/**
 * Полный список партнёров с родителями — чтобы агрегаты (финансы, расчёты)
 * можно было показать по ВСЕМ партнёрам и подпартнёрам, а не только по тем,
 * у кого были счета за период. Партнёров ~150, влезают в одну страницу.
 */
export function useAllPartners() {
  const { result, query } = useCustom<{ partners: PartnerLite[] }>({
    url: '/partners',
    method: 'get',
    config: { query: { limit: 200 } },
  })
  const list = result.data?.partners ?? []
  const byId = new Map(list.map((p) => [p.id, p]))
  const nameOf = (id?: string | null) => (id ? (byId.get(id)?.name ?? null) : null)
  return { list, byId, nameOf, isFetching: query.isFetching }
}

export type UserLite = {
  id: string
  email: string | null
  name: string
  role: string
  partnerId: string | null
}

/**
 * Все пользователи — чтобы искать партнёра по почте любого его аккаунта, а не
 * только владельца. Грузится лениво (enabled), когда оператор реально ищет.
 */
export function useAllUsers(enabled: boolean) {
  const q = useQuery({
    queryKey: ['all-users'],
    enabled,
    staleTime: 300_000,
    queryFn: async () => {
      const out: UserLite[] = []
      for (let page = 1; page <= 6; page++) {
        const r = await action<{ users?: UserLite[]; pagination?: { pages?: number } }>(
          `/users?limit=200&page=${page}`,
          { method: 'GET' },
        )
        out.push(...(r.users ?? []))
        if (page >= (r.pagination?.pages ?? 1)) break
      }
      return out
    },
  })
  return { list: q.data ?? [], isFetching: q.isFetching }
}
