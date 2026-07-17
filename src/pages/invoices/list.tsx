import { List, useTable } from '@refinedev/antd'
import { keepPreviousData } from '@tanstack/react-query'
import { Table, Select, Space, Card, Input, Typography } from 'antd'
import type { CrudFilters } from '@refinedev/core'
import { dt, money } from '../../lib/format'
import { INVOICE_STATUS, selectOptions } from '../../lib/enums'
import { StatusTag } from '../../components/StatusTag'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { SyncInvoiceButton, MarkRefundedButton, BulkSyncButton } from './Actions'
import { useRowMenu } from '../../components/useRowMenu'
import { useAutoRefresh, AutoRefreshSwitch } from '../../components/AutoRefresh'
import { InvoiceDetail } from './detail'
import { exportToExcel, rub } from '../../lib/export'
import { Button } from 'antd'
import { EyeOutlined, FileExcelOutlined } from '@ant-design/icons'
import { useState } from 'react'

const { Text } = Typography

const PERIODS = [
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'all', label: 'Всё время' },
]

export const InvoiceList = () => {
  const auto = useAutoRefresh(5000)
  const [detailId, setDetailId] = useState<string | null>(null)

  const { tableProps, filters, setFilters, tableQuery } = useTable({
    resource: 'invoices',
    syncWithLocation: true,
    pagination: { pageSize: 50 },
    filters: { initial: [{ field: 'period', operator: 'eq', value: 'week' }] },
    queryOptions: {
      refetchInterval: auto.refetchInterval,
      // В фоновой вкладке интервал не тикает — при возврате обновимся сразу.
      refetchOnWindowFocus: auto.enabled,
      // Держим прежние строки на экране, пока едут новые.
      placeholderData: keepPreviousData,
    },
  })

  const valueOf = (field: string) =>
    (filters as CrudFilters)?.find((f) => 'field' in f && f.field === field)?.value

  const apply = (field: string, value: unknown) =>
    setFilters([{ field, operator: 'eq', value }], 'merge')

  const { onRow, menu } = useRowMenu<any>((r) => [
    { key: 'open', label: 'Открыть детали', onClick: () => setDetailId(r.id) },
    { type: 'divider' },
    r.invoiceNumber && {
      key: 'num',
      label: 'Копировать номер счёта',
      onClick: () => navigator.clipboard.writeText(r.invoiceNumber),
    },
    r.partnerId && {
      key: 'partner',
      label: `Показать всё по «${r.partner?.name ?? 'партнёру'}»`,
      onClick: () => apply('partnerId', r.partnerId),
    },
    r.status && {
      key: 'status',
      label: `Отобрать по статусу «${r.status}»`,
      onClick: () => apply('status', r.status),
    },
    (r.customerEmail || r.customerPhone) && {
      key: 'client',
      label: 'Найти счета этого клиента',
      onClick: () => apply('search', r.customerEmail ?? r.customerPhone),
    },
  ])

  const exportRows = () =>
    exportToExcel(
      (tableQuery.data?.data ?? []) as any[],
      [
        { title: 'Создан', value: (r) => (r.createdAt ? dt(r.createdAt) : '') },
        { title: 'Номер', value: (r) => r.invoiceNumber ?? '' },
        { title: 'Статус', value: (r) => r.status },
        { title: 'Сумма, ₽', value: (r) => rub(r.amount) },
        { title: 'Валюта', value: (r) => r.currency ?? '' },
        { title: 'Партнёр', value: (r) => r.partner?.name ?? r.partnerId ?? '' },
        { title: 'Клиент', value: (r) => r.customerName ?? '' },
        { title: 'Email', value: (r) => r.customerEmail ?? '' },
        { title: 'Телефон', value: (r) => r.customerPhone ?? '' },
        { title: 'Оплачен', value: (r) => (r.paidAt ? dt(r.paidAt) : '') },
        { title: 'Описание', value: (r) => r.description ?? '' },
      ],
      'Инвойсы',
    )

  return (
    <List title="Инвойсы">
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap align="end" size={12}>
          <Field label="Поиск">
            <Input.Search
              allowClear
              placeholder="Номер, email, телефон…"
              style={{ width: 260 }}
              defaultValue={valueOf('search') as string}
              onSearch={(v) => apply('search', v || undefined)}
            />
          </Field>
          <Field label="Партнёр">
            <PartnerSelect
              value={valueOf('partnerId') as string}
              onChange={(v) => apply('partnerId', v)}
            />
          </Field>
          <Field label="Статус">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 170 }}
              options={selectOptions(INVOICE_STATUS)}
              value={valueOf('status') as string}
              onChange={(v) => apply('status', v)}
            />
          </Field>
          <Field label="Период">
            <Select
              style={{ width: 150 }}
              options={PERIODS}
              value={valueOf('period') as string}
              onChange={(v) => apply('period', v)}
            />
          </Field>
        </Space>
      </Card>

      <Toolbar
        total={tableQuery.data?.total}
        loading={tableQuery.isFetching}
        onRefresh={() => tableQuery.refetch()}
      >
        <BulkSyncButton onDone={() => tableQuery.refetch()} />
        <AutoRefreshSwitch
          enabled={auto.enabled}
          onChange={auto.setEnabled}
          isFetching={tableQuery.isFetching}
          updatedAt={tableQuery.dataUpdatedAt}
          intervalMs={auto.intervalMs}
        />
        <Button size="small" icon={<FileExcelOutlined />} onClick={exportRows}>
          В Excel
        </Button>
      </Toolbar>

      {menu}

      <Table
        {...tableProps}
        rowKey="id"
        size="small"
        scroll={{ x: 1100 }}
        onRow={onRow}
        // Спиннер только на первой загрузке — иначе таблица мигала бы
        // каждые пять секунд.
        loading={tableQuery.isLoading}
      >
        <Table.Column dataIndex="createdAt" title="Создан" width={150} render={(v: string) => dt(v)} />
        <Table.Column
          dataIndex="invoiceNumber"
          title="Номер"
          width={160}
          render={(v: string) => <Text copyable={!!v}>{v ?? '—'}</Text>}
        />
        <Table.Column
          dataIndex="status"
          title="Статус"
          width={130}
          render={(v: string) => <StatusTag list={INVOICE_STATUS} value={v} />}
        />
        <Table.Column
          dataIndex="amount"
          title="Сумма"
          width={130}
          align="right"
          render={(v: number, r: any) => <Text strong>{money(v, r.currency ?? 'RUB')}</Text>}
        />
        <Table.Column
          dataIndex={['partner', 'name']}
          title="Партнёр"
          width={200}
          render={(v: string, r: any) => v ?? r.partnerId ?? '—'}
        />
        <Table.Column
          dataIndex="customerName"
          title="Клиент"
          width={200}
          render={(v: string, r: any) => v ?? r.customerEmail ?? r.customerPhone ?? '—'}
        />
        <Table.Column dataIndex="paidAt" title="Оплачен" width={150} render={(v: string) => dt(v)} />
        <Table.Column dataIndex="description" title="Описание" ellipsis />
        <Table.Column
          title="Действия"
          width={130}
          fixed="right"
          render={(_: unknown, r: any) => (
            <Space size={4}>
              <Button
                size="small"
                icon={<EyeOutlined />}
                title="Детали"
                onClick={() => setDetailId(r.id)}
              />
              <SyncInvoiceButton invoice={r} onDone={() => tableQuery.refetch()} />
              <MarkRefundedButton invoice={r} onDone={() => tableQuery.refetch()} />
            </Space>
          )}
        />
      </Table>

      <InvoiceDetail id={detailId} onClose={() => setDetailId(null)} />
    </List>
  )
}
