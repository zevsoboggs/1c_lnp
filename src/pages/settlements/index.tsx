import { useMemo, useState } from 'react'
import { useCustom } from '@refinedev/core'
import { Card, Table, Space, Statistic, Typography, DatePicker, Divider, Tag, Segmented, Input } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { usdt } from '../../lib/format'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { useRowMenu } from '../../components/useRowMenu'
import { useAllPartners, useAllUsers } from '../../api/usePartners'
import { PartnerTurnoverByUser } from '../../components/PartnerTurnoverByUser'

const { Text } = Typography

type Row = {
  partnerId: string
  partnerStringId: string
  name: string
  email?: string | null
  totalUsdt: number
  grossUsdt: number
  refundedUsdt: number
  markupPercent: number
  markupAmount: number
  amountOwed: number
  invoiceCount: number
  isActive?: boolean
  parentPartnerId?: string | null
  parentName?: string | null
}

const RANGE_PRESETS: { label: string; value: [Dayjs, Dayjs] }[] = [
  { label: 'Сегодня', value: [dayjs().startOf('day'), dayjs()] },
  { label: 'Вчера', value: [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')] },
  { label: 'Последние 7 дней', value: [dayjs().subtract(6, 'day').startOf('day'), dayjs()] },
  { label: 'Этот месяц', value: [dayjs().startOf('month'), dayjs()] },
  {
    label: 'Прошлый месяц',
    value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
  },
]

const ZERO = {
  totalUsdt: 0,
  grossUsdt: 0,
  refundedUsdt: 0,
  markupPercent: 0,
  markupAmount: 0,
  amountOwed: 0,
  invoiceCount: 0,
}
type Stats = {
  totalUsdt: number
  totalMarkupProfit: number
  totalOwed: number
  partnersCount: number
}

export const SettlementsPage = () => {
  const [partnerId, setPartnerId] = useState<string>()
  const [scope, setScope] = useState<'all' | 'root' | 'sub'>('all')
  const [emailSearch, setEmailSearch] = useState('')
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

  const allPartners = useAllPartners()
  const allUsers = useAllUsers(!!emailSearch.trim())
  const s = result.data?.stats
  const from = range[0].format('YYYY-MM-DD')
  const to = range[1].format('YYYY-MM-DD')

  // Без фильтра по партнёру сшиваем расчёты с полным списком партнёров, чтобы
  // были ВСЕ, включая подпартнёров и тех, у кого нет счетов за период (нули).
  const rows = useMemo(() => {
    const agg = result.data?.partners ?? []
    let base: Row[]
    if (partnerId) {
      base = agg.map((r) => ({
        ...r,
        email: r.email ?? allPartners.byId.get(r.partnerId)?.email ?? '',
        parentName: allPartners.nameOf(r.parentPartnerId),
      }))
    } else {
      const aggById = new Map(agg.map((r) => [r.partnerId, r]))
      const merged: Row[] = allPartners.list.map((p) => {
        const a = aggById.get(p.id)
        return {
          ...ZERO,
          ...(a ?? {}),
          partnerId: p.id,
          partnerStringId: p.partnerId,
          name: p.name,
          email: a?.email ?? p.email ?? '',
          isActive: p.isActive,
          parentPartnerId: p.parentPartnerId,
          parentName: allPartners.nameOf(p.parentPartnerId),
        }
      })
      base = scope === 'root' ? merged.filter((r) => !r.parentPartnerId)
        : scope === 'sub' ? merged.filter((r) => r.parentPartnerId)
        : merged
    }
    const q = emailSearch.trim().toLowerCase()
    if (q) {
      const hitPartners = new Set(
        allUsers.list
          .filter((u) => (u.email ?? '').toLowerCase().includes(q))
          .map((u) => u.partnerId)
          .filter(Boolean) as string[],
      )
      base = base.filter(
        (r) => (r.email ?? '').toLowerCase().includes(q) || hitPartners.has(r.partnerId),
      )
    }
    return base
  }, [result.data, allPartners.list, allUsers.list, partnerId, scope, emailSearch])

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
              presets={RANGE_PRESETS}
            />
          </Field>
          <Field label="Партнёр">
            <PartnerSelect value={partnerId} onChange={setPartnerId} />
          </Field>
          <Field label="Поиск по почте">
            <Input.Search
              allowClear
              placeholder="почта любого аккаунта"
              style={{ width: 240 }}
              value={emailSearch}
              onChange={(e) => setEmailSearch(e.target.value)}
            />
          </Field>
          {!partnerId && (
            <Field label="Показывать">
              <Segmented
                value={scope}
                onChange={(v) => setScope(v as typeof scope)}
                options={[
                  { label: 'Все', value: 'all' },
                  { label: 'Корневые', value: 'root' },
                  { label: 'Подпартнёры', value: 'sub' },
                ]}
              />
            </Field>
          )}
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
          Показаны все партнёры и подпартнёры; у кого нет счетов за период — с нулями.
          Итоговые суммы вверху — по партнёрам с оборотом.
        </Text>
      </Card>

      {partnerId && (
        <Card
          size="small"
          title={`Обороты по аккаунтам${
            allPartners.byId.get(partnerId)?.name ? ` · ${allPartners.byId.get(partnerId)?.name}` : ''
          }`}
        >
          <PartnerTurnoverByUser partnerId={partnerId} from={from} to={to} mode="usdt" />
        </Card>
      )}

      <Card size="small">
        <Toolbar
          loading={query.isFetching || allPartners.isFetching}
          onRefresh={() => query.refetch()}
          total={rows.length}
        />
        <Table
          dataSource={rows}
          loading={query.isFetching || allPartners.isFetching}
          rowKey="partnerId"
          size="small"
          pagination={{ pageSize: 30 }}
          scroll={{ x: 1300 }}
          onRow={onRow}
          expandable={{
            rowExpandable: (r) => (r.invoiceCount ?? 0) > 0,
            expandedRowRender: (r) => (
              <PartnerTurnoverByUser partnerId={r.partnerId} from={from} to={to} mode="usdt" />
            ),
          }}
        >
          <Table.Column
            title="Партнёр"
            width={200}
            fixed="left"
            render={(_: unknown, r: Row) => (
              <Space size={4}>
                <Text strong>{r.name}</Text>
                {r.parentPartnerId && <Tag color="geekblue">суб</Tag>}
              </Space>
            )}
          />
          <Table.Column
            title="Родитель"
            width={160}
            render={(_: unknown, r: Row) =>
              r.parentPartnerId ? (
                r.parentName ?? <Text type="secondary">{r.parentPartnerId.slice(0, 8)}…</Text>
              ) : (
                <Text type="secondary">—</Text>
              )
            }
          />
          <Table.Column
            dataIndex="email"
            title="Аккаунт (почта)"
            width={220}
            render={(v: string) => (v ? <Text copyable>{v}</Text> : <Text type="secondary">—</Text>)}
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
