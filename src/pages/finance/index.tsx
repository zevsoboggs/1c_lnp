import { useMemo, useState } from 'react'
import { useCustom } from '@refinedev/core'
import { Card, Table, Space, Statistic, Typography, DatePicker, Divider, Tag, Segmented, Input } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { money, usdt } from '../../lib/format'
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
  parentPartnerId?: string | null
  parentName?: string | null
}

const ZERO = {
  email: '',
  totalInvoiceAmount: 0,
  grossInvoiceAmount: 0,
  refundedAmount: 0,
  refundCount: 0,
  totalInvoiceAmountUsdt: 0,
  platformCommissionPercent: 0,
  platformCommissionAmount: 0,
  partnerRevenue: 0,
  invoiceCount: 0,
  averageInvoice: 0,
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
  const [scope, setScope] = useState<'all' | 'root' | 'sub'>('all')
  const [emailSearch, setEmailSearch] = useState('')
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

  const allPartners = useAllPartners()
  const allUsers = useAllUsers(!!emailSearch.trim())
  const s = result.data?.stats
  const from = range[0].format('YYYY-MM-DD')
  const to = range[1].format('YYYY-MM-DD')

  // По одному партнёру показываем ровно ответ API. Без фильтра — сшиваем с полным
  // списком партнёров, чтобы были ВСЕ, включая подпартнёров и тех, у кого за
  // период нет счетов (у них нули). Родителя подставляем по карте.
  const rows = useMemo(() => {
    const agg = result.data?.partners ?? []
    let base: Row[]
    if (partnerId) {
      base = agg.map((r) => ({ ...r, parentName: allPartners.nameOf(r.parentPartnerId) }))
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
    // Поиск по почте: совпадение по почте владельца ИЛИ любого пользователя
    // партнёра (тогда оператор находит партнёра по почте суб-аккаунта).
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

      {partnerId && (
        <Card
          size="small"
          title={`Обороты по аккаунтам${
            allPartners.byId.get(partnerId)?.name ? ` · ${allPartners.byId.get(partnerId)?.name}` : ''
          }`}
        >
          <PartnerTurnoverByUser partnerId={partnerId} from={from} to={to} mode="rub" />
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
          // У строк нет id: это агрегаты, а не сущности Partner.
          rowKey="partnerId"
          size="small"
          pagination={{ pageSize: 30 }}
          scroll={{ x: 1530 }}
          onRow={onRow}
          expandable={{
            rowExpandable: (r) => (r.invoiceCount ?? 0) > 0,
            expandedRowRender: (r) => (
              <PartnerTurnoverByUser partnerId={r.partnerId} from={from} to={to} mode="rub" />
            ),
          }}
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
                <Table.Summary.Row style={{ background: '#eaf2fd', fontWeight: 600 }}>
                  {/* index 0 — колонка-раскрытие (expandable), под ней пусто. */}
                  <Table.Summary.Cell index={0} />
                  <Table.Summary.Cell index={1}>Итого на странице</Table.Summary.Cell>
                  <Table.Summary.Cell index={2} />
                  <Table.Summary.Cell index={3} />
                  <Table.Summary.Cell index={4} align="right">
                    {money(t.gross)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="right">
                    {t.refunded ? money(t.refunded) : '—'}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6} align="right">
                    {money(t.commission)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={7} align="right">
                    {money(t.revenue)}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={8} align="right">
                    {t.count}
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={9} />
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
                {r.parentPartnerId && <Tag color="geekblue">суб</Tag>}
                {!r.isActive && <Tag>выкл</Tag>}
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
