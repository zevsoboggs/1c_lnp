import { useMemo, useState } from 'react'
import { useCustom } from '@refinedev/core'
import {
  Card,
  Table,
  Space,
  Statistic,
  Tabs,
  Input,
  Typography,
  Tag,
  Alert,
  DatePicker,
  Select,
  Button,
} from 'antd'
import { UserOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { dt } from '../../lib/format'
import { Toolbar } from '../../components/Toolbar'
import { Field } from '../../components/Field'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

type Overview = {
  balance: { amount: number; currency: string; fetchedAt: string; cached: boolean }
  ordersTotal: number
}
type Plan = {
  id: string
  name: string
  days: string
  data: string
  data_unit: string
  countries_included: string
  countryIso2: string | null
  image: string | null
  operators: string | null
  plan_type: string
  price: string
  currency: string
}
type Order = {
  id: string
  iccid: string | null
  plan_id: string | null
  user_id: string | null
  payment_id: string | null
  cost_eur: string | number | null
  created_at: string
}

const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const eur = (v: unknown) => `${num(v).toFixed(2)} €`

export const EsimPage = () => {
  const [tab, setTab] = useState('orders')
  const [planSearch, setPlanSearch] = useState('')
  const [orderSearch, setOrderSearch] = useState('')
  const [buyer, setBuyer] = useState<string>()
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)

  const overview = useCustom<Overview>({ url: '/esim', method: 'get' })
  const orders = useCustom<{ orders: Order[] }>({ url: '/esim/orders', method: 'get' })

  // Тарифы весят ~690 КБ и не принимают limit, но без них в заказах вместо
  // страны виден только хеш плана. Поэтому грузим один раз и держим в кэше.
  const plans = useCustom<{ plans: Plan[] }>({
    url: '/esim/plans',
    method: 'get',
    queryOptions: { staleTime: 10 * 60_000 },
  })

  const allPlans = plans.result.data?.plans ?? []
  const allOrders = orders.result.data?.orders ?? []

  const planById = useMemo(() => {
    const m = new Map<string, Plan>()
    for (const p of allPlans) m.set(p.id, p)
    return m
  }, [allPlans])

  /** Заказы, обогащённые тарифом: у самого заказа есть только plan_id. */
  const enriched = useMemo(
    () =>
      allOrders.map((o) => {
        const p = o.plan_id ? planById.get(o.plan_id) : undefined
        return {
          ...o,
          cost: num(o.cost_eur),
          at: dayjs(o.created_at),
          plan: p,
          country: p?.countries_included ?? null,
        }
      }),
    [allOrders, planById],
  )

  /** Покупатели: заказы, суммы и период активности по user_id. */
  const buyers = useMemo(() => {
    const m = new Map<
      string,
      { userId: string; orders: number; total: number; first: Dayjs; last: Dayjs; countries: Set<string> }
    >()
    for (const o of enriched) {
      const id = o.user_id ?? '—'
      const cur = m.get(id)
      if (!cur) {
        m.set(id, {
          userId: id,
          orders: 1,
          total: o.cost,
          first: o.at,
          last: o.at,
          countries: new Set(o.country ? [o.country] : []),
        })
      } else {
        cur.orders++
        cur.total += o.cost
        if (o.at.isBefore(cur.first)) cur.first = o.at
        if (o.at.isAfter(cur.last)) cur.last = o.at
        if (o.country) cur.countries.add(o.country)
      }
    }
    return [...m.values()].sort((a, b) => b.total - a.total)
  }, [enriched])

  const ordersByBuyer = useMemo(() => {
    const m = new Map<string, number>()
    for (const b of buyers) m.set(b.userId, b.orders)
    return m
  }, [buyers])

  const shownOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase()
    return enriched.filter((o) => {
      if (buyer && o.user_id !== buyer) return false
      if (range && (o.at.isBefore(range[0].startOf('day')) || o.at.isAfter(range[1].endOf('day')))) {
        return false
      }
      if (!q) return true
      return (
        o.iccid?.toLowerCase().includes(q) ||
        o.user_id?.toLowerCase().includes(q) ||
        o.country?.toLowerCase().includes(q) ||
        o.plan?.name?.toLowerCase().includes(q) ||
        o.id?.toLowerCase().includes(q)
      )
    })
  }, [enriched, orderSearch, buyer, range])

  const sum = shownOrders.reduce((a, o) => a + o.cost, 0)
  const avg = shownOrders.length ? sum / shownOrders.length : 0
  const uniqueBuyers = new Set(shownOrders.map((o) => o.user_id)).size
  const filtered = Boolean(buyer || range || orderSearch)

  const b = overview.result.data?.balance
  const q = planSearch.trim().toLowerCase()
  const shownPlans = q
    ? allPlans.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.countries_included?.toLowerCase().includes(q) ||
          p.operators?.toLowerCase().includes(q),
      )
    : allPlans

  const { onRow: onOrderRow, menu: orderMenu } = useRowMenu<any>((r) => [
    r.user_id && {
      key: 'buyer',
      label: `Все заказы #${r.user_id}`,
      onClick: () => setBuyer(r.user_id),
    },
    r.country && {
      key: 'c',
      label: `Найти по стране «${r.country}»`,
      onClick: () => setOrderSearch(r.country),
    },
    r.iccid && {
      key: 'i',
      label: 'Копировать ICCID',
      onClick: () => navigator.clipboard.writeText(r.iccid),
    },
  ])

  const { onRow: onBuyerRow, menu: buyerMenu } = useRowMenu<any>((r) => [
    {
      key: 'orders',
      label: 'Показать заказы',
      onClick: () => {
        setBuyer(r.userId)
        setTab('orders')
      },
    },
    {
      key: 'id',
      label: 'Копировать ID покупателя',
      onClick: () => navigator.clipboard.writeText(r.userId),
    },
  ])

  const { onRow: onPlanRow, menu: planMenu } = useRowMenu<Plan>((r) => [
    r.countries_included && {
      key: 'c',
      label: `Тарифы «${r.countries_included}»`,
      onClick: () => setPlanSearch(r.countries_included),
    },
    { key: 'id', label: 'Копировать ID тарифа', onClick: () => navigator.clipboard.writeText(r.id) },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {orderMenu}
      {buyerMenu}
      {planMenu}
      <Card title="eSIM" size="small">
        <Toolbar
          loading={overview.query.isFetching || orders.query.isFetching}
          onRefresh={() => {
            overview.query.refetch()
            orders.query.refetch()
          }}
        />
        <Space size={32} wrap style={{ marginTop: 12 }}>
          <Statistic
            title="Баланс у провайдера"
            value={b?.amount ?? 0}
            precision={2}
            suffix={b?.currency ?? 'EUR'}
            loading={overview.query.isFetching}
            valueStyle={{ fontWeight: 700 }}
          />
          <Statistic title="Всего заказов" value={overview.result.data?.ordersTotal ?? 0} />
          <Statistic title="Покупателей" value={buyers.length} />
          <Statistic
            title="Продано на"
            value={enriched.reduce((a, o) => a + o.cost, 0)}
            precision={2}
            suffix="€"
          />
          {b && (
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                Баланс получен
              </Text>
              <Text>
                {dt(b.fetchedAt)} {b.cached && <Tag>из кэша</Tag>}
              </Text>
            </div>
          )}
        </Space>
        {b && b.amount < 50 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
            message={`Баланс низкий: ${eur(b.amount)} — новые заказы могут не пройти`}
          />
        )}
      </Card>

      <Card size="small">
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'orders',
              label: `Заказы · ${allOrders.length}`,
              children: (
                <>
                  <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
                    <Field label="Период покупки">
                      <DatePicker.RangePicker
                        value={range}
                        onChange={(v) =>
                          setRange(v?.[0] && v?.[1] ? [v[0], v[1]] : null)
                        }
                        format="DD.MM.YYYY"
                        style={{ width: 250 }}
                      />
                    </Field>
                    <Field label="Покупатель">
                      <Select
                        allowClear
                        showSearch
                        placeholder="Все"
                        style={{ width: 220 }}
                        value={buyer}
                        onChange={(v) => setBuyer(v ?? undefined)}
                        filterOption={(i, o) => String(o?.label ?? '').includes(i)}
                        options={buyers.map((x) => ({
                          value: x.userId,
                          label: `#${x.userId} · ${x.orders} шт · ${x.total.toFixed(2)} €`,
                        }))}
                      />
                    </Field>
                    <Field label="Поиск">
                      <Input.Search
                        allowClear
                        placeholder="ICCID, страна, тариф…"
                        style={{ width: 240 }}
                        onChange={(e) => setOrderSearch(e.target.value)}
                      />
                    </Field>
                    {filtered && (
                      <Button
                        size="small"
                        onClick={() => {
                          setBuyer(undefined)
                          setRange(null)
                          setOrderSearch('')
                        }}
                      >
                        Сбросить
                      </Button>
                    )}
                  </Space>

                  {filtered && (
                    <Alert
                      type="info"
                      style={{ marginBottom: 12 }}
                      message={
                        <Space size={24} wrap>
                          <span>
                            Заказов: <Text strong>{shownOrders.length}</Text> из {allOrders.length}
                          </span>
                          <span>
                            Сумма: <Text strong>{eur(sum)}</Text>
                          </span>
                          <span>
                            Средний чек: <Text strong>{eur(avg)}</Text>
                          </span>
                          <span>
                            Покупателей: <Text strong>{uniqueBuyers}</Text>
                          </span>
                        </Space>
                      }
                    />
                  )}

                  <Table
                    dataSource={shownOrders}
                    loading={orders.query.isFetching}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 20, showSizeChanger: false }}
                    scroll={{ x: 1100 }}
                    onRow={onOrderRow}
                  >
                    <Table.Column
                      title="Куплен"
                      width={140}
                      defaultSortOrder="descend"
                      sorter={(a: any, b: any) => a.at.valueOf() - b.at.valueOf()}
                      render={(_: unknown, r: any) => r.at.format('DD.MM.YYYY HH:mm')}
                    />
                    <Table.Column
                      title="Покупатель"
                      width={150}
                      render={(_: unknown, r: any) =>
                        r.user_id ? (
                          <Space size={4}>
                            <UserOutlined style={{ color: '#8c8c8c' }} />
                            <a onClick={() => setBuyer(r.user_id)}>#{r.user_id}</a>
                            {(ordersByBuyer.get(r.user_id) ?? 0) > 1 && (
                              <Tag>{ordersByBuyer.get(r.user_id)}</Tag>
                            )}
                          </Space>
                        ) : (
                          '—'
                        )
                      }
                    />
                    <Table.Column
                      title="Страна"
                      width={170}
                      render={(_: unknown, r: any) =>
                        r.plan ? (
                          <Space size={6}>
                            {r.plan.image && (
                              <img src={r.plan.image} alt="" style={{ height: 12 }} />
                            )}
                            <span>{r.country}</span>
                          </Space>
                        ) : (
                          <Text type="secondary">тариф не найден</Text>
                        )
                      }
                    />
                    <Table.Column
                      title="Тариф"
                      width={220}
                      ellipsis
                      render={(_: unknown, r: any) =>
                        r.plan ? (
                          <span>
                            {r.plan.data} {r.plan.data_unit} · {r.plan.days} дн.
                          </span>
                        ) : (
                          <Text type="secondary" code>
                            {r.plan_id?.slice(0, 12)}…
                          </Text>
                        )
                      }
                    />
                    <Table.Column
                      dataIndex="cost"
                      title="Стоимость"
                      width={110}
                      align="right"
                      sorter={(a: any, b: any) => a.cost - b.cost}
                      render={(v: number) => <Text strong>{eur(v)}</Text>}
                    />
                    <Table.Column
                      dataIndex="iccid"
                      title="ICCID"
                      width={190}
                      render={(v: string) => <Text copyable={!!v}>{v ?? '—'}</Text>}
                    />
                    <Table.Column
                      dataIndex="payment_id"
                      title="Платёж"
                      width={120}
                      render={(v: string) => v ?? <Text type="secondary">—</Text>}
                    />
                  </Table>
                </>
              ),
            },
            {
              key: 'buyers',
              label: `Покупатели · ${buyers.length}`,
              children: (
                <Table
                  dataSource={buyers}
                  loading={orders.query.isFetching}
                  rowKey="userId"
                  size="small"
                  pagination={{ pageSize: 20, showSizeChanger: false }}
                  scroll={{ x: 800 }}
                  onRow={onBuyerRow}
                >
                  <Table.Column
                    title="Покупатель"
                    width={140}
                    render={(_: unknown, r: any) => (
                      <Space size={4}>
                        <UserOutlined style={{ color: '#8c8c8c' }} />
                        <a
                          onClick={() => {
                            setBuyer(r.userId)
                            setTab('orders')
                          }}
                        >
                          #{r.userId}
                        </a>
                      </Space>
                    )}
                  />
                  <Table.Column
                    dataIndex="orders"
                    title="Заказов"
                    width={100}
                    align="right"
                    sorter={(a: any, b: any) => a.orders - b.orders}
                  />
                  <Table.Column
                    dataIndex="total"
                    title="Потрачено"
                    width={120}
                    align="right"
                    defaultSortOrder="descend"
                    sorter={(a: any, b: any) => a.total - b.total}
                    render={(v: number) => <Text strong>{eur(v)}</Text>}
                  />
                  <Table.Column
                    title="Средний чек"
                    width={120}
                    align="right"
                    render={(_: unknown, r: any) => eur(r.total / r.orders)}
                  />
                  <Table.Column
                    title="Страны"
                    ellipsis
                    render={(_: unknown, r: any) => [...r.countries].join(', ') || '—'}
                  />
                  <Table.Column
                    title="Первый заказ"
                    width={140}
                    render={(_: unknown, r: any) => r.first.format('DD.MM.YYYY')}
                  />
                  <Table.Column
                    title="Последний"
                    width={140}
                    sorter={(a: any, b: any) => a.last.valueOf() - b.last.valueOf()}
                    render={(_: unknown, r: any) => r.last.format('DD.MM.YYYY')}
                  />
                </Table>
              ),
            },
            {
              key: 'plans',
              label: `Тарифы${allPlans.length ? ` · ${allPlans.length}` : ''}`,
              children: (
                <>
                  <Space style={{ marginBottom: 12 }}>
                    <Input.Search
                      allowClear
                      placeholder="Страна, название, оператор…"
                      style={{ width: 300 }}
                      onChange={(e) => setPlanSearch(e.target.value)}
                    />
                    {q && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Найдено {shownPlans.length} из {allPlans.length}
                      </Text>
                    )}
                  </Space>
                  <Table
                    dataSource={shownPlans}
                    loading={plans.query.isFetching}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 20, showSizeChanger: false }}
                    scroll={{ x: 800 }}
                    onRow={onPlanRow}
                  >
                    <Table.Column
                      title="Страна"
                      width={180}
                      render={(_: unknown, r: Plan) => (
                        <Space size={6}>
                          {r.image && <img src={r.image} alt="" style={{ height: 12 }} />}
                          <span>{r.countries_included}</span>
                        </Space>
                      )}
                    />
                    <Table.Column dataIndex="name" title="Тариф" width={230} ellipsis />
                    <Table.Column
                      title="Объём"
                      width={100}
                      align="right"
                      render={(_: unknown, r: Plan) => `${r.data} ${r.data_unit}`}
                    />
                    <Table.Column dataIndex="days" title="Дней" width={80} align="right" />
                    <Table.Column
                      dataIndex="plan_type"
                      title="Тип"
                      width={100}
                      render={(v: string) => <Tag>{v}</Tag>}
                    />
                    <Table.Column
                      title="Цена"
                      width={100}
                      align="right"
                      render={(_: unknown, r: Plan) => (
                        <Text strong>
                          {num(r.price).toFixed(2)} {r.currency === 'EUR' ? '€' : r.currency}
                        </Text>
                      )}
                    />
                    <Table.Column
                      dataIndex="operators"
                      title="Оператор"
                      ellipsis
                      render={(v: string) => v ?? '—'}
                    />
                  </Table>
                </>
              ),
            },
          ]}
        />
      </Card>
    </Space>
  )
}
