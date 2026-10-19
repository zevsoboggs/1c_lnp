import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Collapse,
  Card,
  Descriptions,
  Drawer,
  Input,
  Select,
  Space,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd'
import { EyeOutlined, LockOutlined, UnlockOutlined, UserOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import { dt } from '../../lib/format'
import { canWrite } from '../../api/accessControl'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { LogRangePicker } from '../../components/LogRangePicker'
import { DataTable } from '../../components/DataTable'
import { DangerConfirm } from '../../components/DangerAction'
import { useRowMenu } from '../../components/useRowMenu'
import {
  cardsApi,
  CARD_STATUS,
  TX_TYPE,
  TX_STATUS,
  MOVEMENT_TYPE,
  APP_TYPES,
  PAY_PROVIDER,
  usd,
  ownerLabel,
  statMoney,
  APP_STATUS,
  type HiCard,
  type CardTx,
  type Movement,
  type AppOperation,
  type Unmatched,
} from '../../api/cards'

const { Text, Paragraph } = Typography

const n2 = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const amount = (v: number | null | undefined, cur?: string | null) =>
  v == null || !Number.isFinite(Number(v)) ? '—' : `${n2.format(Number(v))} ${cur ?? ''}`.trim()

/** Маску знает только мини-апп; если карта к заказу не привязана — честный прочерк. */
const panLabel = (c: { last4: string | null }) => (c.last4 ? `•••• ${c.last4}` : '—')

/**
 * Карты HiCard: виртуальные Visa в USD, выпускаются с нашего резерва у эмитента.
 *
 * Пять вкладок по тому, как к картам приходят: сколько денег у HiCard и что
 * заработали; какие карты есть и у кого; что происходило по картам у эмитента;
 * что клиенты заплатили в приложении; чем расходовался резерв.
 */
export const CardsPage = () => {
  const [tab, setTab] = useState('overview')
  const [cardId, setCardId] = useState<string>()
  const [opened, setOpened] = useState<string | null>(null)

  const showTransactions = (id: string) => {
    setCardId(id)
    setTab('transactions')
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          { key: 'overview', label: 'Обзор', children: <Overview /> },
          { key: 'cards', label: 'Карты', children: <CardList onOpen={setOpened} onTransactions={showTransactions} /> },
          {
            key: 'transactions',
            label: 'Операции у эмитента',
            children: <Transactions cardId={cardId} onCard={setCardId} onOpen={setOpened} />,
          },
          { key: 'app', label: 'Заказы в приложении', children: <AppOperations /> },
          { key: 'reserve', label: 'Резерв', children: <Reserve /> },
        ]}
      />
      <CardDrawer id={opened} onClose={() => setOpened(null)} onTransactions={showTransactions} />
    </Space>
  )
}

// ── Обзор ────────────────────────────────────────────────────────────────────

function Overview() {
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [dates, setDates] = useState<{ fromDate?: string; toDate?: string }>({})

  const summary = useQuery({ queryKey: ['cards-summary'], queryFn: cardsApi.summary })
  const revenue = useQuery({ queryKey: ['cards-revenue', dates], queryFn: () => cardsApi.revenue(dates) })

  const reserve = summary.data?.reserves?.[0]
  const r = revenue.data
  const issueMismatch = r && r.issued.count !== r.hicard.cardsIssued
  const problems = r ? r.unmatched.length + r.orphanDeposits.length : 0

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {summary.error && <Alert type="error" showIcon message={(summary.error as Error).message} />}

      <Card title="Резерв у HiCard и картотека" size="small" loading={summary.isLoading}>
        <Space wrap size={32}>
          <Statistic title="Резерв, доступно" value={reserve?.available ?? 0} formatter={statMoney} suffix={reserve?.currency ?? 'USDT'} />
          {!!reserve?.holding && <Statistic title="Заблокировано" value={reserve.holding} formatter={statMoney} suffix={reserve.currency} />}
          <Statistic title="Карт у HiCard" value={summary.data?.cards.total ?? 0} />
          <Statistic title="Активны" value={summary.data?.cards.byStatus.ACTIVE ?? 0} valueStyle={{ color: '#1a7f37' }} />
          <Statistic title="Заморожены" value={summary.data?.cards.byStatus.FROZEN ?? 0} valueStyle={{ color: '#1668dc' }} />
          <Statistic title="Выпускаются" value={summary.data?.cards.byStatus.PENDING ?? 0} />
          <Statistic title="Закрыты / не выпущены" value={(summary.data?.cards.byStatus.CANCELLED ?? 0) + (summary.data?.cards.byStatus.FAILED ?? 0)} />
        </Space>
        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
          Все карты эмитента за всё время. Выпуск и деньги на карты списываются с резерва; пополнение
          резерва — переводом USDT на счета HiCard (TRC-20 и BEP-20).
        </Paragraph>
      </Card>

      <Card
        title={range ? 'Деньги по картам за период' : 'Деньги по картам за всё время'}
        size="small"
        loading={revenue.isLoading}
        extra={
          <LogRangePicker
            value={range}
            onChange={(v, api) => {
              setRange(v)
              setDates({ fromDate: api.from, toDate: api.to })
            }}
          />
        }
      >
        {revenue.error ? (
          <Alert type="warning" showIcon message={(revenue.error as Error).message} />
        ) : (
          r && (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {r && (issueMismatch || problems > 0) && (
                <Alert
                  type="warning"
                  showIcon
                  message="Заказы клиентов сходятся с HiCard не полностью — ниже списки, что именно"
                  description={
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {issueMismatch && (
                        <li>
                          Заказов на выпуск с картой HiCard — {r.issued.count}, выпусков у HiCard — {r.hicard.cardsIssued}.
                        </li>
                      )}
                      {r.unmatched.length > 0 && <li>Заказов, которые не удалось посчитать уверенно: {r.unmatched.length}.</li>}
                      {r.orphanDeposits.length > 0 && (
                        <li>
                          Пополнений карт у HiCard без заказа: {r.orphanDeposits.length} на{' '}
                          {usd(r.orphanDeposits.reduce((s, x) => s + x.amount, 0), 'USDT')}.
                        </li>
                      )}
                    </ul>
                  }
                />
              )}

              <div>
                <Text strong>По заказам клиентов</Text>
                <Space wrap size={32} style={{ marginTop: 8, display: 'flex' }}>
                  <Statistic title="Заказов на выпуск" value={r.issued.count} />
                  {r.issued.noFee > 0 && <Statistic title="Из них без суммы" value={r.issued.noFee} valueStyle={{ color: '#d46b08' }} />}
                  <Statistic title="За выпуск" value={r.issued.usd} formatter={statMoney} suffix="USD" />
                  <Statistic title="Пополнений" value={r.topups.count} />
                  <Statistic title="Клиенты заплатили" value={r.topups.grossUsd} formatter={statMoney} suffix="USD" />
                  <Statistic title="Ушло на карты" value={r.topups.creditedUsd} formatter={statMoney} suffix="USD" />
                  <Statistic title="Наша комиссия 3,5%" value={r.topups.feeUsd} formatter={statMoney} suffix="USD" />
                </Space>
              </div>

              <div>
                <Text strong>По резерву HiCard</Text>
                <Space wrap size={32} style={{ marginTop: 8, display: 'flex' }}>
                  <Statistic title="Выпущено карт" value={r.hicard.cardsIssued} />
                  <Statistic title="Пополнений карт" value={r.hicard.deposits} />
                  <Statistic title="Выпуск обошёлся" value={r.hicard.issueCostUsdt} formatter={statMoney} suffix="USDT" />
                  <Statistic title="Ушло на карты" value={r.hicard.depositedUsdt} formatter={statMoney} suffix="USDT" />
                  <Statistic title="Комиссия эмитента" value={r.hicard.depositFeesUsdt} formatter={statMoney} suffix="USDT" />
                  <Statistic title="Пополнили резерв" value={r.hicard.reserveTopUpsUsdt} formatter={statMoney} suffix="USDT" />
                </Space>
              </div>

              <div>
                <Text strong>Итог</Text>
                <Space wrap size={32} style={{ marginTop: 8, display: 'flex' }}>
                  <Statistic title="Выручка (выпуск + комиссия)" value={r.revenueUsd} formatter={statMoney} suffix="USD" />
                  <Statistic title="Себестоимость у HiCard" value={r.costUsd} formatter={statMoney} suffix="USD" />
                  <Statistic
                    title={problems > 0 ? "Заработали (без несопоставленного)" : "Заработали"}
                    value={r.marginUsd}
                    formatter={statMoney}
                    suffix="USD"
                    valueStyle={{ color: r.marginUsd >= 0 ? '#1a7f37' : '#cf1322' }}
                  />
                </Space>
              </div>

              {r.unmatched.length > 0 && (
                <Collapse
                  size="small"
                  items={[
                    {
                      key: 'u',
                      label: `Не сопоставлено заказов: ${r.unmatched.length}`,
                      children: (
                        <Table
                          size="small"
                          rowKey={(x) => x.id + x.why}
                          pagination={r.unmatched.length > 20 ? { pageSize: 20 } : false}
                          dataSource={r.unmatched}
                          scroll={{ x: 900 }}
                          columns={[
                            { dataIndex: 'createdAt', title: 'Когда', width: 130, render: (v: string) => dt(v) },
                            { dataIndex: 'type', title: 'Вид', width: 150, render: (v: string) => APP_TYPES.find((t) => t.value === v)?.label ?? v },
                            { title: 'Сумма', width: 120, align: 'right', render: (_: unknown, x: Unmatched) => amount(x.amount, x.currency) },
                            { dataIndex: 'user', title: 'Клиент', width: 140, render: (v: string | null, x: Unmatched) => v ?? x.telegramUserId ?? '—' },
                            { dataIndex: 'why', title: 'Почему не посчитан', render: (v: string) => <Text type="warning">{v}</Text> },
                            { dataIndex: 'id', title: 'ID заказа', width: 120, render: (v: string) => <Text copyable={{ text: v }} style={{ fontSize: 11 }}>{v.slice(0, 8)}…</Text> },
                          ]}
                        />
                      ),
                    },
                  ]}
                />
              )}

              {r.orphanDeposits.length > 0 && (
                <Collapse
                  size="small"
                  items={[
                    {
                      key: 'o',
                      label: `Пополнения у HiCard без заказа: ${r.orphanDeposits.length}`,
                      children: (
                        <Table
                          size="small"
                          rowKey={(x) => `${x.cardId}-${x.occurredAt}`}
                          pagination={false}
                          dataSource={r.orphanDeposits}
                          columns={[
                            { dataIndex: 'occurredAt', title: 'Когда', width: 140, render: (v: string) => dt(v) },
                            { dataIndex: 'amount', title: 'На карту', width: 120, align: 'right', render: (v: number) => amount(v, 'USDT') },
                            { dataIndex: 'owner', title: 'Клиент', width: 150, render: (v: string | null) => v ?? '—' },
                            { dataIndex: 'cardId', title: 'Карта в HiCard', render: (v: string | null) => (v ? <Text copyable style={{ fontSize: 11 }}>{v}</Text> : '—') },
                          ]}
                        />
                      ),
                    },
                  ]}
                />
              )}

              {Object.keys(r.byMethod).length > 0 && (
                <Space wrap size={8}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Чем платили:
                  </Text>
                  {Object.entries(r.byMethod).map(([m, n]) => (
                    <Tag key={m}>
                      {PAY_PROVIDER[m] ?? m}: <b>{n}</b>
                    </Tag>
                  ))}
                </Space>
              )}

              <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
                Считаются только оплаченные заказы по картам, которые есть у HiCard.
                {r.legacyExcluded > 0 &&
                  ` Заказы прежних провайдеров карт до 15.10.2026 (PaySpace, Card Program) — ${r.legacyExcluded} шт. — в расчёт не входят.`}
                {' '}Заказы без суммы выпуска или без данных о зачислении на карту в деньги не включены — они в списке «Не сопоставлено».
              </Paragraph>
            </Space>
          )
        )}
      </Card>
    </Space>
  )
}

// ── Карты ────────────────────────────────────────────────────────────────────

function CardList({ onOpen, onTransactions }: { onOpen: (id: string) => void; onTransactions: (id: string) => void }) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [status, setStatus] = useState<string>()

  const q = useQuery({
    queryKey: ['cards-list', page, pageSize, status],
    queryFn: () => cardsApi.list({ limit: pageSize, offset: (page - 1) * pageSize, status }),
  })

  const { onRow, menu } = useRowMenu<HiCard>((r) => [
    { key: 'open', label: 'Открыть карту', onClick: () => onOpen(r.id) },
    { key: 'tx', label: 'Операции по карте', onClick: () => onTransactions(r.id) },
    { type: 'divider' },
    { key: 'id', label: 'Копировать ID в HiCard', onClick: () => navigator.clipboard.writeText(r.id) },
  ])

  return (
    <Card size="small">
      {menu}
      <Toolbar total={q.data?.total} loading={q.isFetching} onRefresh={() => q.refetch()}>
        <Select
          size="small"
          allowClear
          placeholder="Статус у эмитента"
          style={{ width: 180 }}
          value={status}
          onChange={(v) => {
            setStatus(v ?? undefined)
            setPage(1)
          }}
          options={['ACTIVE', 'FROZEN', 'PENDING', 'CANCELLED'].map((v) => ({ value: v, label: CARD_STATUS[v]?.label ?? v }))}
        />
      </Toolbar>
      <DataTable
        dataSource={q.data?.rows ?? []}
        loading={q.isFetching}
        rowKey="id"
        size="small"
        scroll={{ x: 1000 }}
        onRow={onRow}
        locale={{ emptyText: q.error ? (q.error as Error).message : 'Карт нет' }}
        pagination={{
          current: page,
          pageSize,
          total: q.data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: [25, 50, 100],
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
          },
        }}
      >
        <Table.Column dataIndex="createdAt" title="Выпущена" width={140} render={(v: string | null) => dt(v)} />
        <Table.Column
          title="Карта"
          width={150}
          render={(_: unknown, r: HiCard) => (
            <Space direction="vertical" size={0}>
              <Text code>{panLabel(r)}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {r.scheme ?? ''} · {r.form === 'VIRTUAL' ? 'виртуальная' : r.form ?? ''}
              </Text>
            </Space>
          )}
        />
        <Table.Column
          dataIndex="status"
          title="Статус"
          width={130}
          render={(v: string) => <Tag color={CARD_STATUS[v]?.color ?? 'default'}>{CARD_STATUS[v]?.label ?? v}</Tag>}
        />
        <Table.Column
          dataIndex="balance"
          title="Баланс"
          width={130}
          align="right"
          render={(v: number | null, r: HiCard) => <Text strong>{usd(v, r.currency)}</Text>}
        />
        <Table.Column
          title="Клиент"
          width={200}
          render={(_: unknown, r: HiCard) =>
            r.owner ? (
              <Space size={4}>
                <UserOutlined style={{ color: '#8c8c8c' }} />
                <Space direction="vertical" size={0}>
                  <span>{ownerLabel(r.owner)}</span>
                  {r.owner.telegramUserId && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {r.owner.telegramUserId}
                    </Text>
                  )}
                </Space>
              </Space>
            ) : (
              <Text type="secondary">не найден в приложении</Text>
            )
          }
        />
        <Table.Column
          dataIndex="id"
          title="ID в HiCard"
          ellipsis
          render={(v: string) => (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {v}
            </Text>
          )}
        />
        <Table.Column
          title=""
          width={50}
          fixed="right"
          render={(_: unknown, r: HiCard) => <Button size="small" icon={<EyeOutlined />} onClick={() => onOpen(r.id)} />}
        />
      </DataTable>
    </Card>
  )
}

// ── Карточка карты ───────────────────────────────────────────────────────────

function CardDrawer({
  id,
  onClose,
  onTransactions,
}: {
  id: string | null
  onClose: () => void
  onTransactions: (id: string) => void
}) {
  const write = canWrite('cards')
  const client = useQueryClient()
  const [confirm, setConfirm] = useState<'freeze' | 'unfreeze' | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const q = useQuery({ queryKey: ['card', id], queryFn: () => cardsApi.card(id!), enabled: !!id })
  const tx = useQuery({
    queryKey: ['card-tx-short', id],
    queryFn: () => cardsApi.transactions({ cardId: id!, limit: 10, offset: 0 }),
    enabled: !!id,
  })
  const card = q.data?.card

  const act = async () => {
    if (!card || !confirm) return
    setBusy(true)
    try {
      await (confirm === 'freeze' ? cardsApi.freeze(card.id, reason) : cardsApi.unfreeze(card.id, reason))
      message.success(confirm === 'freeze' ? 'Карта заморожена' : 'Карта разморожена')
      setConfirm(null)
      setReason('')
      client.invalidateQueries({ queryKey: ['card', id] })
      client.invalidateQueries({ queryKey: ['cards-list'] })
      client.invalidateQueries({ queryKey: ['cards-summary'] })
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      title="Карта"
      width={720}
      loading={q.isLoading}
      extra={
        card &&
        write && (
          <Space>
            {card.status === 'ACTIVE' && (
              <Button danger icon={<LockOutlined />} onClick={() => setConfirm('freeze')}>
                Заморозить
              </Button>
            )}
            {card.status === 'FROZEN' && (
              <Button icon={<UnlockOutlined />} onClick={() => setConfirm('unfreeze')}>
                Разморозить
              </Button>
            )}
          </Space>
        )
      }
    >
      {q.error && <Alert type="error" showIcon message={(q.error as Error).message} />}
      {card && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Descriptions
            size="small"
            column={2}
            bordered
            items={[
              { key: 'p', label: 'Карта', children: <Text code>{panLabel(card)}</Text> },
              {
                key: 's',
                label: 'Статус',
                children: (
                  <Space size={4}>
                    <Tag color={CARD_STATUS[card.status]?.color}>{CARD_STATUS[card.status]?.label ?? card.status}</Tag>
                    {card.statusTitle && <Text type="secondary" style={{ fontSize: 11 }}>{card.statusTitle}</Text>}
                  </Space>
                ),
              },
              { key: 'b', label: 'Баланс', children: <Text strong>{usd(card.balance, card.currency)}</Text> },
              { key: 'sc', label: 'Схема', children: `${card.scheme ?? '—'} · ${card.country ?? ''}` },
              { key: 'c', label: 'Выпущена', children: dt(card.createdAt) },
              { key: 'bin', label: 'BIN', children: card.bin ?? '—' },
              {
                key: 'o',
                label: 'Клиент',
                span: 2,
                children: card.owner
                  ? `${card.owner.firstName ?? ''} ${card.owner.username ? `@${card.owner.username}` : ''} · ${card.owner.telegramUserId ?? card.owner.userId}`
                  : 'не найден в приложении',
              },
              { key: 'id', label: 'ID в HiCard', span: 2, children: <Text copyable style={{ fontSize: 11 }}>{card.id}</Text> },
              {
                key: 'h',
                label: 'Держатель в HiCard',
                span: 2,
                children: card.cardholderId ? <Text copyable style={{ fontSize: 11 }}>{card.cardholderId}</Text> : '—',
              },
            ]}
          />

          <Card
            size="small"
            title="Последние операции"
            extra={
              <a
                onClick={() => {
                  onTransactions(card.id)
                  onClose()
                }}
              >
                Все операции
              </a>
            }
          >
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              loading={tx.isFetching}
              dataSource={tx.data?.rows ?? []}
              locale={{ emptyText: 'Операций нет' }}
              columns={[
                { dataIndex: 'occurredAt', title: 'Когда', width: 130, render: (v: string) => dt(v) },
                { dataIndex: 'type', title: 'Вид', width: 120, render: (v: string, r: CardTx) => TX_TYPE[v] ?? r.typeTitle ?? v },
                {
                  dataIndex: 'status',
                  title: 'Статус',
                  width: 100,
                  render: (v: string) => <Tag color={TX_STATUS[v]?.color}>{TX_STATUS[v]?.label ?? v}</Tag>,
                },
                { title: 'Сумма', align: 'right', width: 110, render: (_: unknown, r: CardTx) => amount(r.billingAmount ?? r.amount, r.billingCurrency ?? r.currency) },
                { dataIndex: 'merchant', title: 'Мерчант', ellipsis: true, render: (v: string, r: CardTx) => v ?? r.reason ?? '—' },
              ]}
            />
          </Card>

          <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
            Полный номер, срок и CVV эмитент через API не отдаёт — только окном в приложении
            клиента. Выпуск и пополнение здесь нарочно не сделаны: они списывают резерв, а оплату
            за них принимает мини-апп.
          </Paragraph>
        </Space>
      )}

      <DangerConfirm
        open={!!confirm}
        title={confirm === 'freeze' ? 'Заморозить карту' : 'Разморозить карту'}
        what={
          confirm === 'freeze'
            ? 'Карта перестанет проходить оплаты сразу, у всех мерчантов и в Apple Pay / Google Pay. Деньги на ней останутся.'
            : 'Карта снова сможет оплачивать покупки.'
        }
        confirmWord={confirm === 'freeze' ? 'ЗАМОРОЗИТЬ' : undefined}
        okText={confirm === 'freeze' ? 'Заморозить' : 'Разморозить'}
        loading={busy}
        onOk={act}
        onCancel={() => setConfirm(null)}
      >
        <Field label="Причина (попадёт в журнал)">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="клиент потерял телефон" />
        </Field>
      </DangerConfirm>
    </Drawer>
  )
}

// ── Операции у эмитента ──────────────────────────────────────────────────────

function Transactions({
  cardId,
  onCard,
  onOpen,
}: {
  cardId?: string
  onCard: (id?: string) => void
  onOpen: (id: string) => void
}) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const q = useQuery({
    queryKey: ['cards-tx', cardId, page, pageSize],
    queryFn: () => cardsApi.transactions({ cardId, limit: pageSize, offset: (page - 1) * pageSize }),
  })

  return (
    <Card size="small">
      <Toolbar total={q.data?.total} loading={q.isFetching} onRefresh={() => q.refetch()}>
        <Input.Search
          size="small"
          allowClear
          placeholder="ID карты в HiCard"
          style={{ width: 240 }}
          defaultValue={cardId}
          key={cardId ?? 'all'}
          onSearch={(v) => {
            onCard(v.trim() || undefined)
            setPage(1)
          }}
        />
        {cardId && (
          <Tag closable onClose={() => onCard(undefined)}>
            карта {cardId}
          </Tag>
        )}
      </Toolbar>
      <DataTable
        dataSource={q.data?.rows ?? []}
        loading={q.isFetching}
        rowKey="id"
        size="small"
        scroll={{ x: 1150 }}
        locale={{ emptyText: q.error ? (q.error as Error).message : 'Операций нет' }}
        pagination={{
          current: page,
          pageSize,
          total: q.data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
          },
        }}
      >
        <Table.Column dataIndex="occurredAt" title="Когда" width={140} render={(v: string) => dt(v)} />
        <Table.Column dataIndex="type" title="Вид" width={130} render={(v: string, r: CardTx) => <Tag>{TX_TYPE[v] ?? r.typeTitle ?? v}</Tag>} />
        <Table.Column
          dataIndex="status"
          title="Статус"
          width={110}
          render={(v: string) => <Tag color={TX_STATUS[v]?.color ?? 'default'}>{TX_STATUS[v]?.label ?? v}</Tag>}
        />
        <Table.Column
          title="Списано"
          width={120}
          align="right"
          render={(_: unknown, r: CardTx) => <Text strong>{amount(r.billingAmount, r.billingCurrency)}</Text>}
        />
        <Table.Column title="Сумма покупки" width={120} align="right" render={(_: unknown, r: CardTx) => amount(r.amount, r.currency)} />
        <Table.Column
          title="Мерчант"
          width={220}
          ellipsis
          render={(_: unknown, r: CardTx) => (
            <Space direction="vertical" size={0}>
              <span>{r.merchant ?? '—'}</span>
              {(r.mcc || r.merchantCountry) && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  MCC {r.mcc ?? '—'} · {r.merchantCountry ?? ''}
                </Text>
              )}
            </Space>
          )}
        />
        <Table.Column title="Клиент" width={150} render={(_: unknown, r: CardTx) => ownerLabel(r.owner)} />
        <Table.Column
          dataIndex="reason"
          title="Причина отказа"
          ellipsis
          render={(v: string | null) => (v ? <Text type="danger">{v}</Text> : '—')}
        />
        <Table.Column
          title=""
          width={50}
          fixed="right"
          render={(_: unknown, r: CardTx) =>
            r.cardId && <Button size="small" icon={<EyeOutlined />} onClick={() => onOpen(r.cardId!)} />
          }
        />
      </DataTable>
    </Card>
  )
}

// ── Заказы в приложении ──────────────────────────────────────────────────────

function AppOperations() {
  const [type, setType] = useState('CARD_ACTIVATION')
  const [status, setStatus] = useState<string>()
  const [tgId, setTgId] = useState<string>()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [dates, setDates] = useState<{ fromDate?: string; toDate?: string }>({})
  const [viewing, setViewing] = useState<AppOperation | null>(null)

  const q = useQuery({
    queryKey: ['cards-app', type, status, tgId, page, pageSize, dates],
    queryFn: () => cardsApi.operations({ type, status, telegramUserId: tgId, page, pageSize, ...dates }),
  })

  const reset = () => setPage(1)

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card size="small">
        <Space wrap align="end" size={12}>
          <Field label="Вид">
            <Select
              style={{ width: 260 }}
              value={type}
              onChange={(v) => {
                setType(v)
                reset()
              }}
              options={APP_TYPES}
            />
          </Field>
          <Field label="Статус">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 160 }}
              value={status}
              onChange={(v) => {
                setStatus(v ?? undefined)
                reset()
              }}
              options={Object.entries(APP_STATUS).map(([value, { label }]) => ({ value, label }))}
            />
          </Field>
          <Field label="Telegram ID">
            <Input.Search
              allowClear
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
              onChange={(v, api) => {
                setRange(v)
                setDates({ fromDate: api.from, toDate: api.to })
                reset()
              }}
            />
          </Field>
        </Space>
      </Card>

      <Card size="small">
        <Toolbar total={q.data?.total} loading={q.isFetching} onRefresh={() => q.refetch()} />
        <DataTable
          dataSource={q.data?.rows ?? []}
          loading={q.isFetching}
          rowKey="id"
          size="small"
          scroll={{ x: 1150 }}
          onRow={(r: AppOperation) => ({ onDoubleClick: () => setViewing(r) })}
          locale={{ emptyText: q.error ? (q.error as Error).message : 'Заказов нет' }}
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
          <Table.Column dataIndex="createdAt" title="Когда" width={140} render={(v: string) => dt(v)} />
          <Table.Column
            dataIndex="status"
            title="Статус"
            width={110}
            render={(v: string) => <Tag color={APP_STATUS[v]?.color ?? 'default'}>{APP_STATUS[v]?.label ?? v}</Tag>}
          />
          <Table.Column
            title="Сумма"
            width={130}
            align="right"
            render={(_: unknown, r: AppOperation) => <Text strong>{amount(r.amount, r.currency)}</Text>}
          />
          {type !== 'CARD_PURCHASE' && (
            <Table.Column
              title="На карту / выпуск"
              width={150}
              align="right"
              render={(_: unknown, r: AppOperation) =>
                r.metadata?.credited != null ? amount(Number(r.metadata.credited), 'USD') : r.metadata?.feeUsd ? `${r.metadata.feeUsd} USD` : '—'
              }
            />
          )}
          {type !== 'CARD_PURCHASE' && (
            <Table.Column
              title="Чем оплачено"
              width={150}
              render={(_: unknown, r: AppOperation) => {
                const p = r.metadata?.provider ?? r.metadata?.paymentMethod
                return p ? <Tag>{PAY_PROVIDER[p] ?? p}</Tag> : '—'
              }}
            />
          )}
          {type === 'CARD_PURCHASE' && (
            <Table.Column
              title="Мерчант"
              width={220}
              ellipsis
              render={(_: unknown, r: AppOperation) => (
                <Space direction="vertical" size={0}>
                  <span>{r.merchantName ?? r.description ?? '—'}</span>
                  {r.declineReason && (
                    <Text type="danger" style={{ fontSize: 11 }}>
                      {r.declineReason}
                    </Text>
                  )}
                </Space>
              )}
            />
          )}
          <Table.Column
            title="Клиент"
            width={180}
            render={(_: unknown, r: AppOperation) =>
              r.user ? (
                <Space direction="vertical" size={0}>
                  <a
                    onClick={() => {
                      setTgId(String(r.user!.telegramUserId))
                      reset()
                    }}
                  >
                    {ownerLabel(r.user)}
                  </a>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {r.user.telegramUserId}
                  </Text>
                </Space>
              ) : (
                '—'
              )
            }
          />
          <Table.Column
            title="Карта"
            width={110}
            render={(_: unknown, r: AppOperation) => (r.card?.last4 ? <Text code>•••• {r.card.last4}</Text> : '—')}
          />
          <Table.Column dataIndex="description" title="Описание" ellipsis render={(v: string | null) => v ?? '—'} />
          <Table.Column
            title=""
            width={50}
            fixed="right"
            render={(_: unknown, r: AppOperation) => <Button size="small" icon={<EyeOutlined />} onClick={() => setViewing(r)} />}
          />
        </DataTable>
      </Card>

      <Drawer open={!!viewing} onClose={() => setViewing(null)} title="Заказ по карте" width={640}>
        {viewing && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions
              size="small"
              column={2}
              bordered
              items={[
                { key: 't', label: 'Вид', children: APP_TYPES.find((t) => t.value === viewing.type)?.label ?? viewing.type },
                { key: 's', label: 'Статус', children: APP_STATUS[viewing.status]?.label ?? viewing.status },
                { key: 'a', label: 'Сумма', children: <Text strong>{amount(viewing.amount, viewing.currency)}</Text> },
                { key: 'x', label: 'Курс', children: viewing.exchangeRate ?? '—' },
                { key: 'c', label: 'Когда', children: dt(viewing.createdAt) },
                { key: 'k', label: 'Карта', children: viewing.card?.last4 ? `•••• ${viewing.card.last4}` : '—' },
                { key: 'u', label: 'Клиент', span: 2, children: viewing.user ? `${ownerLabel(viewing.user)} · ${viewing.user.telegramUserId}` : '—' },
                { key: 'id', label: 'ID заказа', span: 2, children: <Text copyable style={{ fontSize: 11 }}>{viewing.id}</Text> },
              ]}
            />
            {viewing.metadata && (
              <Card size="small" title="metadata">
                <pre style={{ margin: 0, maxHeight: 320, overflow: 'auto', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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

// ── Резерв ───────────────────────────────────────────────────────────────────

function Reserve() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const q = useQuery({
    queryKey: ['cards-reserve', page, pageSize],
    queryFn: () => cardsApi.movements({ limit: pageSize, offset: (page - 1) * pageSize }),
  })

  return (
    <Card size="small">
      <Toolbar total={q.data?.total} loading={q.isFetching} onRefresh={() => q.refetch()} />
      <DataTable
        dataSource={q.data?.rows ?? []}
        loading={q.isFetching}
        rowKey="id"
        size="small"
        scroll={{ x: 900 }}
        locale={{ emptyText: q.error ? (q.error as Error).message : 'Движений нет' }}
        pagination={{
          current: page,
          pageSize,
          total: q.data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          onChange: (p, ps) => {
            setPage(p)
            setPageSize(ps)
          },
        }}
      >
        <Table.Column dataIndex="occurredAt" title="Когда" width={140} render={(v: string) => dt(v)} />
        <Table.Column
          dataIndex="type"
          title="Движение"
          width={210}
          render={(v: string, r: Movement) => <Tag>{MOVEMENT_TYPE[v] ?? r.typeTitle ?? v}</Tag>}
        />
        <Table.Column
          dataIndex="amount"
          title="Сумма"
          width={130}
          align="right"
          render={(v: number, r: Movement) => <Text strong>{amount(v, r.currency)}</Text>}
        />
        <Table.Column dataIndex="before" title="Было" width={130} align="right" render={(v: number | null, r: Movement) => amount(v, r.currency)} />
        <Table.Column dataIndex="after" title="Стало" width={130} align="right" render={(v: number | null, r: Movement) => amount(v, r.currency)} />
        <Table.Column dataIndex="description" title="Описание" ellipsis render={(v: string | null) => v ?? '—'} />
      </DataTable>
    </Card>
  )
}
