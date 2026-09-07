import { Select } from 'antd'
import { useAllPartners, useAllUsers } from '../api/usePartners'

/**
 * Один выпадающий список на партнёров И аккаунты.
 *
 * Оператор не обязан знать, что «Suetolog» — это не партнёр, а аккаунт под
 * партнёром Yasmina. Поэтому ищем в обеих группах: выбор партнёра фильтрует по
 * partnerId, выбор аккаунта — по userId (создателю счёта).
 */
export function PartnerOrAccountSelect({
  partnerId,
  userId,
  onPick,
  width = 320,
}: {
  partnerId?: string
  userId?: string
  onPick: (partnerId?: string, userId?: string) => void
  width?: number
}) {
  const partners = useAllPartners()
  const users = useAllUsers(true)

  const options = [
    {
      label: 'Партнёры',
      options: partners.list.map((p) => ({ value: `p:${p.id}`, label: p.name })),
    },
    {
      label: 'Аккаунты (пользователи)',
      options: users.list.map((u) => {
        const who = u.name || u.email || u.id
        const tail = [u.email && u.email !== who ? u.email : null, u.partnerName]
          .filter(Boolean)
          .join(' · ')
        return { value: `u:${u.id}`, label: tail ? `${who} · ${tail}` : who }
      }),
    },
  ]

  const value = partnerId ? `p:${partnerId}` : userId ? `u:${userId}` : undefined

  return (
    <Select
      allowClear
      showSearch
      placeholder="Партнёр или аккаунт"
      style={{ width }}
      loading={partners.isFetching || users.isFetching}
      options={options}
      optionFilterProp="label"
      filterOption={(input, option) =>
        String(option?.label ?? '')
          .toLowerCase()
          .includes(input.toLowerCase())
      }
      value={value}
      onChange={(v?: string) => {
        if (!v) return onPick(undefined, undefined)
        if (v.startsWith('p:')) return onPick(v.slice(2), undefined)
        return onPick(undefined, v.slice(2))
      }}
    />
  )
}
