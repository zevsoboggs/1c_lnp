import { useState } from 'react'
import { useCustom } from '@refinedev/core'
import { Card, Table, Space, Statistic, Typography, DatePicker, Divider } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { usdt } from '../../lib/format'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

type Row = {
  partnerId: string
  partnerStringId: string
  name: string
  totalUsdt: number
  grossUsdt: number
  refundedUsdt: number
  markupPercent: number
  markupAmount: number
  amountOwed: number
  invoiceCount: number
}
type Stats = {
  totalUsdt: number
  totalMarkupProfit: number
  totalOwed: number
  partnersCount: number
}

export const SettlementsPage = () => {
  const [partnerId, setPartnerId] = useState<string>()
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(30, 'day'), dayjs()])

  const { query, result } = useCustom<{ partners: Row[]; stats: Stats }>({
    url: '/settlements',
    method: 'get',
    config: {
      query: {
        startDate: range[0].format('YYYY-MM-DD'),
        endDate: range[1].format('YYYY-MM-DD'),
        partner: partnerId,
      },
    },
  })

  const rows = result.data?.partners ?? []
  const s = result.data?.stats

  const { onRow, menu } = useRowMenu<Row>((r) => [
    { key: 'only', label: `Только «${r.name}»`, onClick: () => setPartnerId(r.partnerId) },
    r.partnerStringId && {
      key: 'code',
      label: 'Копировать код партнёра',
      onClick: () => navigator.clipboard.writeText(r.partnerStringId),
    },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}
      <Card title="Расчёты" size="small">
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

        {/* Суммы здесь уже в USDT — в отличие от «Финансов», где рубли в копейках. */}
        <Space size={32} wrap>
          <Statistic
            title="Оборот, USDT"
            value={s?.totalUsdt ?? 0}
            precision={2}
            suffix="USDT"
            loading={query.isFetching}
            valueStyle={{ fontWeight: 700 }}
          />
          <Statistic
            title="Прибыль с наценки"
            value={s?.totalMarkupProfit ?? 0}
            precision={2}
            suffix="USDT"
            valueStyle={{ color: '#0D5AA7' }}
          />
          <Statistic
            title="К перечислению"
            value={s?.totalOwed ?? 0}
            precision={2}
            suffix="USDT"
            valueStyle={{ fontWeight: 700 }}
          />
          <Statistic title="Партнёров" value={s?.partnersCount ?? 0} />
        </Space>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          Партнёры без счетов за период в список не попадают.
        </Text>
      </Card>

      <Card size="small">
        <Toolbar loading={query.isFetching} onRefresh={() => query.refetch()} total={rows.length} />
        <Table
          dataSource={rows}
          loading={query.isFetching}
          rowKey="partnerId"
          size="small"
          pagination={{ pageSize: 30 }}
          scroll={{ x: 950 }}
          onRow={onRow}
        >
          <Table.Column
            dataIndex="name"
            title="Партнёр"
            width={200}
            fixed="left"
            render={(v: string) => <Text strong>{v}</Text>}
          />
          <Table.Column
            dataIndex="grossUsdt"
            title="Оборот"
            width={140}
            align="right"
            defaultSortOrder="descend"
            sorter={(a: Row, b: Row) => a.grossUsdt - b.grossUsdt}
            render={(v: number) => usdt(v)}
          />
          <Table.Column
            dataIndex="refundedUsdt"
            title="Возвраты"
            width={120}
            align="right"
            render={(v: number) => (v ? <Text type="danger">{usdt(v)}</Text> : '—')}
          />
          <Table.Column
            dataIndex="markupPercent"
            title="Наценка"
            width={100}
            align="right"
            render={(v: number) => `${v}%`}
          />
          <Table.Column
            dataIndex="markupAmount"
            title="Прибыль с наценки"
            width={150}
            align="right"
            sorter={(a: Row, b: Row) => a.markupAmount - b.markupAmount}
            render={(v: number) => <Text style={{ color: '#0D5AA7' }}>{usdt(v)}</Text>}
          />
          <Table.Column
            dataIndex="amountOwed"
            title="К перечислению"
            width={150}
            align="right"
            sorter={(a: Row, b: Row) => a.amountOwed - b.amountOwed}
            render={(v: number) => <Text strong>{usdt(v)}</Text>}
          />
          <Table.Column
            dataIndex="invoiceCount"
            title="Счетов"
            width={90}
            align="right"
            sorter={(a: Row, b: Row) => a.invoiceCount - b.invoiceCount}
          />
        </Table>
      </Card>
    </Space>
  )
}
