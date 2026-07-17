import { List, useTable } from '@refinedev/antd'
import { Table, Select, Space, Card, Typography } from 'antd'
import type { CrudFilters } from '@refinedev/core'
import { dt, money } from '../../lib/format'
import { PAYOUT_STATUS, selectOptions } from '../../lib/enums'
import { StatusTag } from '../../components/StatusTag'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

export const PayoutList = () => {
  const { tableProps, filters, setFilters, tableQuery } = useTable({
    resource: 'payouts',
    syncWithLocation: true,
    pagination: { pageSize: 50 },
  })

  const valueOf = (field: string) =>
    (filters as CrudFilters)?.find((f) => 'field' in f && f.field === field)?.value

  const { onRow, menu } = useRowMenu<any>((r) => [
    r.status && {
      key: 'st',
      label: `Отобрать по статусу «${r.status}»`,
      onClick: () => setFilters([{ field: 'status', operator: 'eq', value: r.status }], 'merge'),
    },
    r.merchantOrderId && {
      key: 'ord',
      label: 'Копировать номер заказа',
      onClick: () => navigator.clipboard.writeText(r.merchantOrderId),
    },
    r.cardLast4 && {
      key: 'card',
      label: `Карта ····${r.cardLast4}`,
      disabled: true,
    },
  ])

  return (
    <List title="Выплаты">
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap align="end" size={12}>
          <Field label="Статус">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 180 }}
              options={selectOptions(PAYOUT_STATUS)}
              value={valueOf('status') as string}
              onChange={(v) => setFilters([{ field: 'status', operator: 'eq', value: v }], 'merge')}
            />
          </Field>
        </Space>
      </Card>

      <Toolbar
        total={tableQuery.data?.total}
        loading={tableQuery.isFetching}
        onRefresh={() => tableQuery.refetch()}
      />

      {menu}

      <Table {...tableProps} rowKey="id" size="small" scroll={{ x: 1000 }} onRow={onRow}>
        <Table.Column dataIndex="createdAt" title="Создана" width={150} render={(v: string) => dt(v)} />
        <Table.Column
          dataIndex="status"
          title="Статус"
          width={140}
          render={(v: string) => <StatusTag list={PAYOUT_STATUS} value={v} />}
        />
        <Table.Column
          dataIndex="amount"
          title="Сумма"
          width={140}
          align="right"
          render={(v: number, r: any) => <Text strong>{money(v, r.currency ?? 'RUB')}</Text>}
        />
        <Table.Column
          dataIndex="recipientName"
          title="Получатель"
          width={200}
          render={(v: string, r: any) => v ?? r.cardHolder ?? '—'}
        />
        <Table.Column
          title="Карта"
          width={150}
          render={(_: unknown, r: any) =>
            r.cardLast4 ? `${r.cardBrand ?? ''} ····${r.cardLast4}`.trim() : '—'
          }
        />
        <Table.Column
          dataIndex="merchantOrderId"
          title="Заказ"
          width={200}
          render={(v: string) => <Text copyable={!!v}>{v ?? '—'}</Text>}
        />
        <Table.Column dataIndex="completedAt" title="Завершена" width={150} render={(v: string) => dt(v)} />
        <Table.Column
          dataIndex="errorMessage"
          title="Ошибка"
          render={(v: string) => (v ? <Text type="danger">{v}</Text> : '—')}
        />
      </Table>
    </List>
  )
}
