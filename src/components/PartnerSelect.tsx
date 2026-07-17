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
  onChange: (value?: string) => void
  width?: number
}) {
  const { selectProps } = useSelect({
    resource: 'partners',
    optionLabel: 'name',
    optionValue: 'id',
    pagination: { pageSize: 200 },
  })

  return (
    <Select
      allowClear
      showSearch
      placeholder="Партнёр"
      style={{ width }}
      loading={selectProps.loading}
      options={selectProps.options as Array<{ label: string; value: string }>}
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
