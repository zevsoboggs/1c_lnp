import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  Table,
  Space,
  Typography,
  Tag,
  Select,
  Input,
  Button,
  Drawer,
  Descriptions,
  Alert,
} from 'antd'
import { EyeOutlined, UserOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import { dt } from '../../lib/format'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { LogRangePicker } from '../../components/LogRangePicker'
import { useRowMenu } from '../../components/useRowMenu'
import {
  miniappApi,
  ORDER_TYPES,
  TYPE_LABEL,
  ORDER_STATUS,
  ORDER_CATEGORIES,
  type Order,
} from '../../api/miniapp'

const { Text } = Typography

const amount = (v: number, cur?: string | null) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n)} ${cur ?? ''}`.trim()
}

export const MiniappOrders = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [status, setStatus] = useState<string>()
  const [type, setType] = useState<string>()
  const [category, setCategory] = useState<string>()
  const [tgId, setTgId] = useState<string>()
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [dates, setDates] = useState<{ fromDate?: string; toDate?: string }>({})
  const [viewing, setViewing] = useState<Order | null>(null)

  const q = useQuery({
    queryKey: ['miniapp-orders', page, pageSize, status, type, category, tgId, dates],
    queryFn: () =>
      miniappApi.orders({
        page,
        pageSize,
        status,
        type,
        category,
        telegramUserId: tgId,
        ...dates,
      }),
  })

  const reset = () => setPage(1)
  const rows = q.data?.data ?? []

  const { onRow, menu } = useRowMenu<Order>((r) => [
    { key: 'open', label: 'Открыть заказ', onClick: () => setViewing(r) },
    { type: 'divider' },
    r.user?.telegramUserId && {
      key: 'u',
      label: `Все заказы ${r.user.username ? `@${r.user.username}` : 'этого юзера'}`,
      onClick: () => {
        setTgId(String(r.user!.telegramUserId))
        reset()
      },
    },
    r.type && {
      key: 't',
      label: `Только «${TYPE_LABEL[r.type] ?? r.type}»`,
      onClick: () => {
        setType(r.type)
        reset()
      },
    },
    r.status && {
      key: 's',
      label: `Только «${ORDER_STATUS[r.status]?.label ?? r.status}»`,
      onClick: () => {
        setStatus(r.status)
        reset()
      },
    },
    r.paywaveTransactionId && {
      key: 'pw',
      label: 'Копировать ID у провайдера',
      onClick: () => navigator.clipboard.writeText(r.paywaveTransactionId!),
    },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}
      <Card title="Заказы мини-аппа" size="small">
        <Space wrap align="end" size={12}>
          <Field label="Тип">
            <Select
              allowClear
              showSearch
              placeholder="Все"
              style={{ width: 210 }}
              value={type}
              onChange={(v) => {
                setType(v ?? undefined)
                reset()
              }}
              filterOption={(i, o) => String(o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
              options={ORDER_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] ?? t }))}
            />
          </Field>
          <Field label="Статус">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 180 }}
              value={status}
              onChange={(v) => {
                setStatus(v ?? undefined)
                reset()
              }}
              options={Object.entries(ORDER_STATUS).map(([value, { label }]) => ({ value, label }))}
            />
          </Field>
          <Field label="Категория">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 140 }}
              value={category}
              onChange={(v) => {
                setCategory(v ?? undefined)
                reset()
              }}
              options={ORDER_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </Field>
          <Field label="Telegram ID">
            <Input.Search
              allowClear
              placeholder="329609607"
              style={{ width: 160 }}
              onSearch={(v) => {
                setTgId(v || undefined)
                reset()
              }}
            />
          </Field>
          <Field label="Период">
            <LogRangePicker
              value={range}
              onChange={(r, api) => {
                setRange(r)
                // toDate у апстрима сравнивается через lte от полуночи, поэтому
                // компонент отдаёт уже сдвинутую на сутки границу.
                setDates({ fromDate: api.from, toDate: api.to })
                reset()
              }}
            />
          </Field>
        </Space>
      </Card>

      <Card size="small">
        <Toolbar total={q.data?.total} loading={q.isFetching} onRefresh={() => q.refetch()} />

        <Table
          dataSource={rows}
          loading={q.isFetching}
          rowKey="id"
          size="small"
          scroll={{ x: 1250 }}
          onRow={onRow}
          pagination={{
            current: page,
            pageSize,
            total: q.data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100, 200],
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        >
          <Table.Column
            dataIndex="createdAt"
            title="Когда"
            width={140}
            render={(v: string) => dt(v)}
          />
          <Table.Column
            dataIndex="type"
            title="Тип"
            width={180}
            render={(v: string) => <Tag>{TYPE_LABEL[v] ?? v}</Tag>}
          />
          <Table.Column
            dataIndex="status"
            title="Статус"
            width={150}
            render={(v: string) => (
              <Tag color={ORDER_STATUS[v]?.color ?? 'default'}>{ORDER_STATUS[v]?.label ?? v}</Tag>
            )}
          />
          <Table.Column
            dataIndex="amount"
            title="Сумма"
            width={130}
            align="right"
            render={(v: number, r: Order) => <Text strong>{amount(v, r.currency)}</Text>}
          />
          <Table.Column
            title="Пользователь"
            width={190}
            render={(_: unknown, r: Order) =>
              r.user ? (
                <Space size={4}>
                  <UserOutlined style={{ color: '#8c8c8c' }} />
                  <Space direction="vertical" size={0}>
                    <a onClick={() => setTgId(String(r.user!.telegramUserId))}>
                      {r.user.username ? `@${r.user.username}` : r.user.firstName ?? '—'}
                    </a>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {r.user.telegramUserId}
                    </Text>
                  </Space>
                </Space>
              ) : (
                '—'
              )
            }
          />
          <Table.Column
            dataIndex="merchantName"
            title="Мерчант / описание"
            ellipsis
            render={(v: string, r: Order) => v ?? r.description ?? '—'}
          />
          <Table.Column
            dataIndex="category"
            title="Категория"
            width={110}
            render={(v: string) => <Tag>{v}</Tag>}
          />
          <Table.Column
            title="Карта"
            width={170}
            render={(_: unknown, r: Order) =>
              r.card?.cardNumber ? (
                <Text code style={{ fontSize: 11 }}>
                  {r.card.cardNumber}
                </Text>
              ) : (
                '—'
              )
            }
          />
          <Table.Column
            title=""
            width={50}
            fixed="right"
            render={(_: unknown, r: Order) => (
              <Button size="small" icon={<EyeOutlined />} onClick={() => setViewing(r)} />
            )}
          />
        </Table>
      </Card>

      <Drawer open={!!viewing} onClose={() => setViewing(null)} title="Заказ" width={720}>
        {viewing && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {(viewing.status === '0' || viewing.status === '1') && (
              <Alert
                type="warning"
                showIcon
                message={`Некорректный статус: "${viewing.status}"`}
                description="Похоже, сюда записали числовой код вместо названия. Поле статуса в базе мини-аппа — обычная строка без ограничений."
              />
            )}
            {viewing.declineReason && (
              <Alert type="error" showIcon message={`Отказ: ${viewing.declineReason}`} />
            )}

            <Descriptions
              size="small"
              column={2}
              bordered
              items={[
                { key: 't', label: 'Тип', children: TYPE_LABEL[viewing.type] ?? viewing.type },
                {
                  key: 's',
                  label: 'Статус',
                  children: (
                    <Tag color={ORDER_STATUS[viewing.status]?.color}>
                      {ORDER_STATUS[viewing.status]?.label ?? viewing.status}
                    </Tag>
                  ),
                },
                {
                  key: 'a',
                  label: 'Сумма',
                  children: <Text strong>{amount(viewing.amount, viewing.currency)}</Text>,
                },
                { key: 'f', label: 'Комиссия', children: amount(viewing.fee, viewing.currency) },
                { key: 'c', label: 'Категория', children: viewing.category },
                { key: 'cr', label: 'Создан', children: dt(viewing.createdAt) },
                { key: 'u', label: 'Обновлён', children: dt(viewing.updatedAt) },
                {
                  key: 'ex',
                  label: 'Курс',
                  children: viewing.exchangeRate
                    ? `${viewing.exchangeRate} (${viewing.fromCurrency} → ${viewing.toCurrency})`
                    : '—',
                },
                {
                  key: 'usr',
                  label: 'Пользователь',
                  children: viewing.user
                    ? `${viewing.user.firstName ?? ''} ${viewing.user.username ? `@${viewing.user.username}` : ''} · ${viewing.user.telegramUserId}`
                    : '—',
                  span: 2,
                },
                {
                  key: 'm',
                  label: 'Мерчант',
                  children: viewing.merchantName ?? '—',
                  span: 2,
                },
                { key: 'mcc', label: 'MCC', children: viewing.mcc ?? '—' },
                { key: 'rc', label: 'Реф. код', children: viewing.referralCode ?? '—' },
                {
                  key: 'cd',
                  label: 'Карта',
                  children: viewing.card?.cardNumber ?? '—',
                },
                {
                  key: 'pw',
                  label: 'ID у провайдера',
                  children: viewing.paywaveTransactionId ? (
                    <Text copyable style={{ fontSize: 11 }}>
                      {viewing.paywaveTransactionId}
                    </Text>
                  ) : (
                    '—'
                  ),
                },
                {
                  key: 'd',
                  label: 'Описание',
                  children: viewing.description ?? '—',
                  span: 2,
                },
                {
                  key: 'id',
                  label: 'ID заказа',
                  children: <Text copyable style={{ fontSize: 11 }}>{viewing.id}</Text>,
                  span: 2,
                },
              ]}
            />

            {viewing.metadata != null && (
              <Card size="small" title="metadata">
                <pre
                  style={{
                    margin: 0,
                    maxHeight: 300,
                    overflow: 'auto',
                    background: '#fafafa',
                    border: '1px solid #eee',
                    padding: 8,
                    fontSize: 11,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(viewing.metadata, null, 2)}
                </pre>
              </Card>
            )}
          </Space>
        )}
      </Drawer>
    </Space>
  )
}
