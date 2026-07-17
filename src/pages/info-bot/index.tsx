import { useCustom } from '@refinedev/core'
import { Card, Table, Tag, Space, Typography, Statistic, Alert, Badge } from 'antd'
import { dt } from '../../lib/format'
import { Toolbar } from '../../components/Toolbar'
import { InfoBotActions } from './Actions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

type Subscription = {
  id: string
  chatId: string
  chatType: string
  title: string | null
  username: string | null
  isActive: boolean
  notifyIncidents: boolean
  notifyStatus: boolean
  partner: { name: string } | null
  lastNotifiedAt: string | null
  createdAt: string
}

type Incident = {
  id: string
  provider: string
  reason: string | null
  status: string
  source: string | null
  failCount: number
  openedAt: string
  resolvedAt: string | null
  notifiedOpen: boolean
}

type InfoBot = {
  configured: boolean
  botUsername: string | null
  activeCount: number
  subscriptions: Subscription[]
  incidents: Incident[]
  openIncidents: Incident[]
}

export const InfoBotPage = () => {
  // Ответ отдаёт подписчиков и инциденты одним куском, поэтому не generic-список.
  const { query, result } = useCustom<InfoBot>({ url: '/info-bot', method: 'get' })
  const d = result.data

  const { onRow: onIncRow, menu: incMenu } = useRowMenu<Incident>((r) => [
    r.provider && {
      key: 'p',
      label: `Копировать провайдера (${r.provider})`,
      onClick: () => navigator.clipboard.writeText(r.provider),
    },
    r.reason && {
      key: 'r',
      label: 'Копировать причину',
      onClick: () => navigator.clipboard.writeText(r.reason!),
    },
  ])

  const { onRow: onSubRow, menu: subMenu } = useRowMenu<Subscription>((r) => [
    r.username && {
      key: 'tg',
      label: `Открыть @${r.username} в Telegram`,
      onClick: () => window.open(`https://t.me/${r.username}`, '_blank', 'noopener'),
    },
    r.chatId && {
      key: 'c',
      label: 'Копировать chatId',
      onClick: () => navigator.clipboard.writeText(String(r.chatId)),
    },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {incMenu}
      {subMenu}
      <Card title="Info-бот" size="small">
        <Toolbar loading={query.isFetching} onRefresh={() => query.refetch()} />

        {d && !d.configured && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
            message="Бот не настроен — рассылки и алерты не уходят"
          />
        )}

        <Space size={32} wrap style={{ marginTop: 12 }}>
          <Statistic title="Активных чатов" value={d?.activeCount ?? 0} loading={query.isFetching} />
          <Statistic
            title="Открытых инцидентов"
            value={d?.openIncidents?.length ?? 0}
            valueStyle={{ color: d?.openIncidents?.length ? '#cf1322' : undefined }}
            loading={query.isFetching}
          />
          <Statistic
            title="Всего подписчиков"
            value={d?.subscriptions?.length ?? 0}
            loading={query.isFetching}
          />
          {d?.botUsername && (
            <div>
              <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                Бот
              </Text>
              <Text strong>@{d.botUsername}</Text>
            </div>
          )}
        </Space>

        <div style={{ marginTop: 16 }}>
          <InfoBotActions
            statusCount={d?.subscriptions?.filter((s) => s.isActive && s.notifyStatus).length ?? 0}
            incidentCount={d?.subscriptions?.filter((s) => s.isActive && s.notifyIncidents).length ?? 0}
            onDone={() => query.refetch()}
          />
        </div>
      </Card>

      <Card title={`Инциденты · ${d?.incidents?.length ?? 0}`} size="small">
        <Table
          dataSource={d?.incidents ?? []}
          loading={query.isFetching}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          scroll={{ x: 800 }}
          onRow={onIncRow}
        >
          <Table.Column
            dataIndex="provider"
            title="Провайдер"
            width={110}
            render={(v: string) => <Tag>{v}</Tag>}
          />
          <Table.Column
            dataIndex="status"
            title="Статус"
            width={130}
            render={(v: string) =>
              v === 'OPEN' ? (
                <Badge status="error" text="открыт" />
              ) : (
                <Badge status="success" text="закрыт" />
              )
            }
          />
          <Table.Column dataIndex="reason" title="Причина" ellipsis render={(v: string) => v ?? '—'} />
          <Table.Column dataIndex="failCount" title="Ошибок" width={90} align="right" />
          <Table.Column dataIndex="source" title="Источник" width={110} render={(v: string) => v ?? '—'} />
          <Table.Column dataIndex="openedAt" title="Открыт" width={150} render={(v: string) => dt(v)} />
          <Table.Column
            dataIndex="resolvedAt"
            title="Закрыт"
            width={150}
            render={(v: string) => dt(v)}
          />
        </Table>
      </Card>

      <Card title={`Подписчики · ${d?.subscriptions?.length ?? 0}`} size="small">
        <Table
          dataSource={d?.subscriptions ?? []}
          loading={query.isFetching}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 900 }}
          onRow={onSubRow}
        >
          <Table.Column
            dataIndex="title"
            title="Чат"
            width={220}
            render={(v: string, r: Subscription) => v ?? r.username ?? r.chatId}
          />
          <Table.Column
            dataIndex="chatType"
            title="Тип"
            width={100}
            render={(v: string) => <Tag>{v}</Tag>}
          />
          <Table.Column
            dataIndex={['partner', 'name']}
            title="Партнёр"
            width={180}
            render={(v: string) => v ?? '—'}
          />
          <Table.Column
            title="Уведомления"
            width={190}
            render={(_: unknown, r: Subscription) => (
              <Space size={4} wrap>
                {r.notifyIncidents && <Tag color="red">инциденты</Tag>}
                {r.notifyStatus && <Tag color="blue">статусы</Tag>}
                {!r.notifyIncidents && !r.notifyStatus && <Text type="secondary">—</Text>}
              </Space>
            )}
          />
          <Table.Column
            dataIndex="isActive"
            title="Активен"
            width={100}
            render={(v: boolean) => (
              <Tag color={v ? 'success' : 'default'}>{v ? 'да' : 'нет'}</Tag>
            )}
          />
          <Table.Column
            dataIndex="lastNotifiedAt"
            title="Последнее"
            width={150}
            render={(v: string) => dt(v)}
          />
        </Table>
      </Card>
    </Space>
  )
}
