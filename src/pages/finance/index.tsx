import { useState } from 'react'
import { useCustom } from '@refinedev/core'
import { Card, Table, Space, Statistic, Typography, DatePicker, Divider, Tag } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { money, usdt } from '../../lib/format'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

type Row = {
  partnerId: string
  partnerStringId: string
  name: string
  email: string
  totalInvoiceAmount: number
  grossInvoiceAmount: number
  refundedAmount: number
  refundCount: number
  totalInvoiceAmountUsdt: number
  platformCommissionPercent: number
  platformCommissionAmount: number
  partnerRevenue: number
  invoiceCount: number
  averageInvoice: number
  isActive: boolean
}
type Stats = {
  totalRevenue: number
  totalGrossRevenue: number
  totalRefunded: number
  totalRefundCount: number
  totalRevenueUsdt: number
  totalPlatformCommission: number
  totalPartnerRevenue: number
  totalInvoices: number
  activePartners: number
}

export const FinancePage = () => {
  const [partnerId, setPartnerId] = useState<string>()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])

  const { query, result } = useCustom<{ partners: Row[]; stats: Stats; note?: string }>({
    url: '/finance',
    method: 'get',
    config: {
      query: {
        // Тут именно startDate/endDate — в транзакциях те же фильтры зовутся dateFrom/dateTo.
        startDate: range[0].format('YYYY-MM-DD'),
        endDate: range[1].format('YYYY-MM-DD'),
        partner: partnerId,
      },
    },
  })

  const rows = result.data?.partners ?? []
  const s = result.data?.stats

  const { onRow, menu } = useRowMenu<Row>((r) => [
    {
      key: 'only',
      label: `Только «${r.name}»`,
      onClick: () => setPartnerId(r.partnerId),
    },
    { type: 'divider' },
    r.partnerStringId && {
      key: 'code',
      label: 'Копировать код партнёра',
      onClick: () => navigator.clipboard.writeText(r.partnerStringId),
    },
    r.email && {
      key: 'mail',
      label: 'Копировать email',
      onClick: () => navigator.clipboard.writeText(r.email),
    },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}
      <Card title="Финансы" size="small">
        <Space wrap align="end" size={12}>
          <Field label="Период">
            <DatePicker.RangePicker
              value={range}
              onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])}
              format="DD.MM.YYYY"
              allowClear={false}
              style={{ width: 250 }}
            />
          </Field>
          <Field label="Партнёр">
            <PartnerSelect value={partnerId} onChange={setPartnerId} />
          </Field>
        </Space>

        <Divider style={{ margin: '12px 0' }} />

        <Space size={32} wrap>
          <Statistic
            title="Оборот"
            value={(s?.totalRevenue ?? 0) / 100}
            precision={2}
            suffix="₽"
            loading={query.isFetching}
            valueStyle={{ fontWeight: 700 }}
          />
          <Statistic title="Оборот, USDT" value={s?.totalRevenueUsdt ?? 0} precision={2} suffix="USDT" />
          <Statistic
            title="Комиссия платформы"
            value={(s?.totalPlatformCommission ?? 0) / 100}
            precision={2}
            suffix="₽"
          />
          <Statistic
            title="Выручка партнёров"
            value={(s?.totalPartnerRevenue ?? 0) / 100}
            precision={2}
            suffix="₽"
          />
          <Statistic
            title="Возвраты"
            value={(s?.totalRefunded ?? 0) / 100}
            precision={2}
            suffix="₽"
            valueStyle={{ color: s?.totalRefunded ? '#cf1322' : undefined }}
          />
          <Statistic title="Счетов" value={s?.totalInvoices ?? 0} />
          <Statistic title="Активных партнёров" value={s?.activePartners ?? 0} />
        </Space>
      </Card>

      <Card size="small">
        <Toolbar loading={query.isFetching} onRefresh={() => query.refetch()} total={rows.length} />
        <Table
          dataSource={rows}
          loading={query.isFetching}
          // У строк нет id: это агрегаты, а не сущности Partner.
          rowKey="partnerId"
          size="small"
          pagination={{ pageSize: 30 }}
          scroll={{ x: 1150 }}
          onRow={onRow}
          summary={(data) => {
            const t = (data as Row[]).reduce(
              (a, r) => ({
                gross: a.gross + r.grossInvoiceAmount,
                refunded: a.refunded + r.refundedAmount,
                commission: a.commission + r.platformCommissionAmount,
                revenue: a.revenue + r.partnerRevenue,
                count: a.count + r.invoiceCount,
              }),
              { gross: 0, refunded: 0, commission: 0, revenue: 0, count: 0 },
            )
            return (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#FFFCE8', fontWeight: 600 }}>
                  <Table.Summary.Cell index={0}>Итого на странице</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="right">
                    {money(t.gross)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    {t.refunded ? money(t.refunded) : '—'}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">
                    {money(t.commission)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="right">
                    {money(t.revenue)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    {t.count}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} />
                </Table.Summary.Row>
              </Table.Summary>
            )
          }}
        >
          <Table.Column
            title="Партнёр"
            width={200}
            fixed="left"
            render={(_: unknown, r: Row) => (
              <Space size={4}>
                <Text strong>{r.name}</Text>
                {!r.isActive && <Tag>выкл</Tag>}
              </Space>
            )}
          />
          <Table.Column
            dataIndex="grossInvoiceAmount"
            title="Оборот"
            width={140}
            align="right"
            sorter={(a: Row, b: Row) => a.grossInvoiceAmount - b.grossInvoiceAmount}
            defaultSortOrder="descend"
            render={(v: number) => <Text strong>{money(v)}</Text>}
          />
          <Table.Column
            dataIndex="refundedAmount"
            title="Возвращено"
            width={130}
            align="right"
            render={(v: number, r: Row) =>
              v ? (
                <Space size={4}>
                  <Text type="danger">{money(v)}</Text>
                  <Tag>{r.refundCount}</Tag>
                </Space>
              ) : (
                '—'
              )
            }
          />
          <Table.Column
            dataIndex="platformCommissionAmount"
            title="Комиссия"
            width={130}
            align="right"
            render={(v: number, r: Row) => (
              <Space size={4}>
                <span>{money(v)}</span>
                {r.platformCommissionPercent > 0 && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {r.platformCommissionPercent}%
                  </Text>
                )}
              </Space>
            )}
          />
          <Table.Column
            dataIndex="partnerRevenue"
            title="Выручка партнёра"
            width={150}
            align="right"
            sorter={(a: Row, b: Row) => a.partnerRevenue - b.partnerRevenue}
            render={(v: number) => money(v)}
          />
          <Table.Column
            dataIndex="invoiceCount"
            title="Счетов"
            width={90}
            align="right"
            sorter={(a: Row, b: Row) => a.invoiceCount - b.invoiceCount}
          />
          <Table.Column
            dataIndex="totalInvoiceAmountUsdt"
            title="Оборот, USDT"
            width={130}
            align="right"
            render={(v: number) => usdt(v)}
          />
          <Table.Column
            dataIndex="averageInvoice"
            title="Средний счёт"
            width={130}
            align="right"
            render={(v: number) => money(v)}
          />
          {/* partnerStringId — человекочитаемый код; partnerId в этом ответе UUID. */}
          <Table.Column
            dataIndex="partnerStringId"
            title="Код"
            width={150}
            render={(v: string) => <Text copyable={!!v}>{v}</Text>}
          />
        </Table>
      </Card>
    </Space>
  )
}
