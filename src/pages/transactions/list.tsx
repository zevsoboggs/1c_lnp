import { List, useTable } from '@refinedev/antd'
import { keepPreviousData } from '@tanstack/react-query'
import { Table, Select, Space, Card, Typography } from 'antd'
import type { CrudFilters } from '@refinedev/core'
import { dt, money } from '../../lib/format'
import { TRANSACTION_STATUS, selectOptions } from '../../lib/enums'
import { StatusTag } from '../../components/StatusTag'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { useRowMenu } from '../../components/useRowMenu'
import { useAutoRefresh, AutoRefreshSwitch } from '../../components/AutoRefresh'
import { TransactionDetail } from './detail'
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

export const TransactionList = () => {
  const auto = useAutoRefresh(5000)
  const [detailId, setDetailId] = useState<string | null>(null)

  const { tableProps, filters, setFilters, tableQuery } = useTable({
    resource: 'transactions',
    syncWithLocation: true,
    pagination: { pageSize: 50 },
    filters: { initial: [{ field: 'period', operator: 'eq', value: 'week' }] },
    queryOptions: {
      refetchInterval: auto.refetchInterval,
      // В фоновой вкладке интервал не тикает (поведение react-query по
      // умолчанию) — незачем дёргать API из десятка забытых вкладок.
      // Зато при возврате к вкладке данные подтягиваются сразу.
      refetchOnWindowFocus: auto.enabled,
      // Пока едут новые данные, показываем прежние — иначе таблица на миг
      // пустеет и прыгает каждые пять секунд.
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
    r.externalOrderId && {
      key: 'ext',
      label: 'Копировать внешний ID',
      onClick: () => navigator.clipboard.writeText(r.externalOrderId),
    },
  ])

  const exportRows = () =>
    exportToExcel(
      (tableQuery.data?.data ?? []) as any[],
      [
        { title: 'Дата', value: (r) => (r.createdAt ? dt(r.createdAt) : '') },
        { title: 'Статус', value: (r) => r.status },
        { title: 'Сумма, ₽', value: (r) => rub(r.amount) },
        { title: 'Валюта', value: (r) => r.orderCurrency ?? '' },
        { title: 'Партнёр', value: (r) => r.partner?.name ?? r.partnerId ?? '' },
        { title: 'Инвойс', value: (r) => r.invoice?.invoiceNumber ?? '' },
        { title: 'Провайдер', value: (r) => r.provider ?? '' },
        { title: 'Внешний ID', value: (r) => r.externalOrderId ?? '' },
        { title: 'Ошибка', value: (r) => r.errorMessage ?? '' },
      ],
      'Транзакции',
    )

  return (
    <List title="Транзакции">
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap align="end" size={12}>
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
              style={{ width: 180 }}
              options={selectOptions(TRANSACTION_STATUS)}
              value={valueOf('status') as string}
              onChange={(v) => apply('status', v)}
            />
          </Field>
          <Field label="Период">
            <Select
              style={{ width: 160 }}
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
        // Спиннер только на первой загрузке: при автообновлении данные уже
        // на экране, и мигать им незачем.
        loading={tableQuery.isLoading}
      >
        <Table.Column
          dataIndex="createdAt"
          title="Создана"
          width={150}
          render={(v: string) => dt(v)}
        />
        <Table.Column
          dataIndex="status"
          title="Статус"
          width={140}
          render={(v: string) => <StatusTag list={TRANSACTION_STATUS} value={v} />}
        />
        <Table.Column
          dataIndex="amount"
          title="Сумма"
          width={140}
          align="right"
          render={(v: number, r: any) => <Text strong>{money(v, r.orderCurrency ?? 'RUB')}</Text>}
        />
        <Table.Column
          dataIndex={['partner', 'name']}
          title="Партнёр"
          width={200}
          render={(v: string, r: any) => v ?? r.partnerId ?? '—'}
        />
        <Table.Column
          dataIndex={['invoice', 'invoiceNumber']}
          title="Инвойс"
          width={160}
          render={(v: string) => v ?? '—'}
        />
        <Table.Column dataIndex="provider" title="Провайдер" width={120} />
        <Table.Column
          dataIndex="externalOrderId"
          title="Внешний ID"
          width={220}
          render={(v: string) => <Text copyable={!!v}>{v ?? '—'}</Text>}
        />
        <Table.Column
          dataIndex="errorMessage"
          title="Ошибка"
          render={(v: string) => (v ? <Text type="danger">{v}</Text> : '—')}
        />
        <Table.Column
          title=""
          width={50}
          fixed="right"
          render={(_: unknown, r: any) => (
            <Button
              size="small"
              icon={<EyeOutlined />}
              title="Детали"
              onClick={() => setDetailId(r.id)}
            />
          )}
        />
      </Table>

      <TransactionDetail id={detailId} onClose={() => setDetailId(null)} />
    </List>
  )
}
