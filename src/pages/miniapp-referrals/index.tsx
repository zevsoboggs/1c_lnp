import { useQuery } from '@tanstack/react-query'
import { Card, Table, Space, Statistic, Typography, Tag, Alert, Progress } from 'antd'
import { dt } from '../../lib/format'
import { Toolbar } from '../../components/Toolbar'
import { miniappApi, type Order } from '../../api/miniapp'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

type Referrals = {
  programs: number
  totalReferralRelationships: number
  totalReferralsCounted: number
  totalEarningsRub: number
  totalTurnoverRub: number
  commissionsByStatus: Record<string, { count: number; amountRub: number }>
}

const rub = (v: number | null | undefined) =>
  v == null ? '—' : `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(v)} ₽`

const COMMISSION_STATUS: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: 'Начислена', color: 'success' },
  PAID: { label: 'Выплачена', color: 'blue' },
  PENDING: { label: 'Ожидает', color: 'processing' },
  CANCELLED: { label: 'Отменена', color: 'default' },
}

async function fetchReferrals(): Promise<Referrals> {
  const r = await fetch('/api/miniapp/referrals')
  const b = await r.json()
  if (!r.ok || b?.success === false) throw new Error(b?.error ?? 'Ошибка')
  return b
}

export const MiniappReferrals = () => {
  const stats = useQuery({ queryKey: ['miniapp-referrals'], queryFn: fetchReferrals })

  // Выплаты достаём из заказов: отдельного эндпоинта для них нет.
  const payouts = useQuery({
    queryKey: ['referral-payouts'],
    queryFn: () => miniappApi.orders({ type: 'REFERRAL_WITHDRAW', pageSize: 200 }),
  })

  const s = stats.data
  const rows = payouts.data?.data ?? []
  const paidUsdt = rows
    .filter((r) => r.status === 'COMPLETED')
    .reduce((a, r) => a + Number(r.amount || 0), 0)

  const commissions = Object.entries(s?.commissionsByStatus ?? {})
  const accrued = commissions.reduce((a, [, v]) => a + v.amountRub, 0)

  const { onRow, menu } = useRowMenu<Order>((r) => [
    r.user?.username && {
      key: 'tg',
      label: `Открыть @${r.user.username} в Telegram`,
      onClick: () => window.open(`https://t.me/${r.user!.username}`, '_blank', 'noopener'),
    },
    r.user?.telegramUserId && {
      key: 'id',
      label: 'Копировать Telegram ID',
      onClick: () => navigator.clipboard.writeText(String(r.user!.telegramUserId)),
    },
    r.description && {
      key: 'd',
      label: 'Копировать описание выплаты',
      onClick: () => navigator.clipboard.writeText(r.description!),
    },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}
      <Card title="Реферальная программа мини-аппа" size="small">
        <Space size={32} wrap>
          <Statistic
            title="Оборот рефералов"
            value={s?.totalTurnoverRub ?? 0}
            precision={2}
            suffix="₽"
            loading={stats.isFetching}
            valueStyle={{ fontWeight: 700 }}
          />
          <Statistic
            title="Начислено партнёрам"
            value={s?.totalEarningsRub ?? 0}
            precision={2}
            suffix="₽"
            valueStyle={{ color: '#0D5AA7', fontWeight: 700 }}
          />
          <Statistic title="Программ" value={s?.programs ?? 0} />
          <Statistic
            title="Связей «кто кого привёл»"
            value={s?.totalReferralRelationships ?? 0}
          />
          <Statistic title="Рефералов засчитано" value={s?.totalReferralsCounted ?? 0} />
        </Space>

        {/* Программ 1018, а связей 313: код есть почти у всех, но привёл кого-то
            далеко не каждый. Показываем это явно, иначе цифры путают. */}
        {s && s.programs > 0 && (
          <div style={{ marginTop: 16, maxWidth: 460 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Программа заведена у {s.programs} пользователей, но реально кого-то привели{' '}
              {s.totalReferralRelationships} — это{' '}
              {Math.round((s.totalReferralRelationships / s.programs) * 100)}%.
            </Text>
            <Progress
              percent={Math.round((s.totalReferralRelationships / s.programs) * 100)}
              size="small"
              showInfo={false}
            />
          </div>
        )}
      </Card>

      <Card title="Комиссии по статусам" size="small">
        <Toolbar loading={stats.isFetching} onRefresh={() => stats.refetch()} />
        <Table
          dataSource={commissions.map(([status, v]) => ({ status, ...v }))}
          rowKey="status"
          size="small"
          pagination={false}
          loading={stats.isFetching}
          summary={(data) => {
            const t = (data as any[]).reduce(
              (a, r) => ({ n: a.n + r.count, sum: a.sum + r.amountRub }),
              { n: 0, sum: 0 },
            )
            return (
              <Table.Summary.Row style={{ background: '#FFFCE8', fontWeight: 600 }}>
                <Table.Summary.Cell index={0}>Итого</Table.Summary.Cell>
                <Table.Summary.Cell index={1} align="right">
                  {t.n}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right">
                  {rub(t.sum)}
                </Table.Summary.Cell>
                <Table.Summary.Cell index={3} />
              </Table.Summary.Row>
            )
          }}
        >
          <Table.Column
            dataIndex="status"
            title="Статус"
            width={160}
            render={(v: string) => (
              <Tag color={COMMISSION_STATUS[v]?.color ?? 'default'}>
                {COMMISSION_STATUS[v]?.label ?? v}
              </Tag>
            )}
          />
          <Table.Column dataIndex="count" title="Штук" width={100} align="right" />
          <Table.Column
            dataIndex="amountRub"
            title="Сумма"
            width={150}
            align="right"
            render={(v: number) => <Text strong>{rub(v)}</Text>}
          />
          <Table.Column
            title=""
            render={(_: unknown, r: any) =>
              accrued > 0 ? (
                <Progress
                  percent={Math.round((r.amountRub / accrued) * 100)}
                  size="small"
                  showInfo={false}
                />
              ) : null
            }
          />
        </Table>
      </Card>

      <Card title={`Выплаты рефералов · ${rows.length}`} size="small">
        <Space size={32} wrap style={{ marginBottom: 12 }}>
          <Statistic
            title="Выплачено всего"
            value={paidUsdt}
            precision={2}
            suffix="USDT"
            valueStyle={{ fontWeight: 700 }}
          />
          <Statistic title="Заявок" value={rows.length} />
        </Space>

        <Toolbar
          total={payouts.data?.total}
          loading={payouts.isFetching}
          onRefresh={() => payouts.refetch()}
        />

        <Table
          dataSource={rows}
          loading={payouts.isFetching}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 900 }}
          onRow={onRow}
        >
          <Table.Column
            dataIndex="createdAt"
            title="Когда"
            width={140}
            defaultSortOrder="descend"
            sorter={(a: Order, b: Order) =>
              new Date(a.createdAt).valueOf() - new Date(b.createdAt).valueOf()
            }
            render={(v: string) => dt(v)}
          />
          <Table.Column
            title="Кому"
            width={190}
            render={(_: unknown, r: Order) =>
              r.user ? (
                <Space direction="vertical" size={0}>
                  <Text strong>
                    {r.user.username ? `@${r.user.username}` : (r.user.firstName ?? '—')}
                  </Text>
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
            dataIndex="amount"
            title="Сумма"
            width={130}
            align="right"
            sorter={(a: Order, b: Order) => a.amount - b.amount}
            render={(v: number, r: Order) => (
              <Text strong>
                {Number(v).toFixed(2)} {r.currency}
              </Text>
            )}
          />
          <Table.Column
            dataIndex="status"
            title="Статус"
            width={120}
            render={(v: string) => (
              <Tag color={v === 'COMPLETED' ? 'success' : v === 'FAILED' ? 'error' : 'processing'}>
                {v}
              </Tag>
            )}
          />
          {/* Куда ушли деньги и какая была комиссия — только в тексте описания:
              отдельных полей под это в заказе нет. */}
          <Table.Column
            dataIndex="description"
            title="Куда и сколько"
            ellipsis
            render={(v: string) => <Text style={{ fontSize: 12 }}>{v ?? '—'}</Text>}
          />
        </Table>
      </Card>

      <Alert
        type="info"
        showIcon
        message="Чего здесь пока не видно"
        description={
          <div>
            <Text>
              Детализации нет — админский API мини-аппа отдаёт по рефералке только итоговые числа.
              Недоступны:
            </Text>
            <ul style={{ margin: '8px 0 0', paddingInlineStart: 18 }}>
              <li>кто кого привёл (таблица связей наружу не выставлена);</li>
              <li>сколько заработал конкретный партнёр и по каким сделкам;</li>
              <li>список начислений — только суммы по статусам.</li>
            </ul>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
              Эндпоинты для этого в мини-аппе есть, но они пользовательские: возвращают данные
              того, кто вошёл, и админским ключом не вызываются. Нужны три read-only маршрута под
              admin-ключом — скажите, добавлю.
            </Text>
          </div>
        }
      />
    </Space>
  )
}
