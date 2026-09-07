import { Select } from 'antd'
import { useAllUsers } from '../api/usePartners'

/**
 * Выбор аккаунта (пользователя партнёра). Нужен там, где оборот делает не сам
 * партнёр, а его сотрудник/агент: в фильтре по партнёрам такого «Suetolog» нет,
 * потому что это аккаунт под партнёром, а не отдельный партнёр.
 */
export function UserSelect({
  value,
  onChange,
  width = 300,
}: {
  value?: string
  onChange: (value?: string) => void
  width?: number
}) {
  const { list, isFetching } = useAllUsers(true)

  const options = list.map((u) => {
    const who = u.name || u.email || u.id
    const parts = [who, u.email && u.email !== who ? u.email : null, u.partnerName]
      .filter(Boolean)
      .join(' · ')
    return { value: u.id, label: parts }
  })

  return (
    <Select
      allowClear
      showSearch
      placeholder="Аккаунт"
      style={{ width }}
      loading={isFetching}
      options={options}
      filterOption={(input, option) =>
        String(option?.label ?? '')
          .toLowerCase()
          .includes(input.toLowerCase())
      }
      value={value}
      onChange={(v) => onChange(v ?? undefined)}
    />
  )
}
