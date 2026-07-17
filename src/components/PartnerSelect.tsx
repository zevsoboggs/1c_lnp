import { useSelect } from '@refinedev/antd'
import { Select } from 'antd'

/**
 * Партнёров ~140 — грузятся одним запросом, поиск клиентский.
 * value — это Partner.id (UUID), именно его ждут фильтры ?partner= .
 */
export function PartnerSelect({
  value,
  onChange,
  width = 240,
}: {
  value?: string
  /** Второй аргумент — имя выбранного партнёра (для заголовков/отчётов). */
  onChange: (value?: string, label?: string) => void
  width?: number
}) {
  const { selectProps } = useSelect({
    resource: 'partners',
    optionLabel: 'name',
    optionValue: 'id',
    pagination: { pageSize: 200 },
  })

  const options = selectProps.options as Array<{ label: string; value: string }>

  return (
    <Select
      allowClear
      showSearch
      placeholder="Партнёр"
      style={{ width }}
      loading={selectProps.loading}
      options={options}
      filterOption={(input, option) =>
        String(option?.label ?? '')
          .toLowerCase()
          .includes(input.toLowerCase())
      }
      value={value}
      onChange={(v) => onChange(v ?? undefined, options?.find((o) => o.value === v)?.label)}
    />
  )
}
