import { useCustom } from '@refinedev/core'

export type PartnerLite = {
  id: string
  partnerId: string // человекочитаемый код (partner-…)
  name: string
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
