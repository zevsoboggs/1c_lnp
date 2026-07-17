import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  Table,
  Space,
  Typography,
  Tag,
  Input,
  Button,
  Drawer,
  Descriptions,
  Avatar,
  Statistic,
} from 'antd'
import { EyeOutlined, UserOutlined } from '@ant-design/icons'
import { dt } from '../../lib/format'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { miniappUsers, type MiniappUser } from '../../api/miniappUsers'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

const KYC_COLOR: Record<string, string> = {
  APPROVED: 'success',
  VERIFIED: 'success',
  PENDING: 'processing',
  DECLINED: 'error',
  REJECTED: 'error',
}

const money = (v: string | number | null | undefined) => {
  const n = Number(v)
  return Number.isFinite(n) ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n) : '0'
}

export const MiniappUsers = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [search, setSearch] = useState<string>()
  const [viewing, setViewing] = useState<MiniappUser | null>(null)

  const q = useQuery({
    queryKey: ['miniapp-users', page, pageSize, search],
    queryFn: () => miniappUsers.list({ page, pageSize, search }),
  })

  const rows = q.data?.data ?? []
  const withBalance = rows.filter((u) => Number(u.internalBalance) > 0).length
  const withKyc = rows.filter((u) => u.kycStatus).length

  const { onRow, menu } = useRowMenu<MiniappUser>((r) => [
    { key: 'open', label: 'Открыть карточку', onClick: () => setViewing(r) },
    { type: 'divider' },
    r.telegramUserId && {
      key: 'tg',
      label: 'Копировать Telegram ID',
      onClick: () => navigator.clipboard.writeText(String(r.telegramUserId)),
    },
    r.username && {
      key: 'un',
      label: `Открыть @${r.username} в Telegram`,
      onClick: () => window.open(`https://t.me/${r.username}`, '_blank', 'noopener'),
    },
    r.email && {
      key: 'em',
      label: 'Копировать email',
      onClick: () => navigator.clipboard.writeText(r.email!),
    },
    r.referralCode && {
      key: 'rc',
      label: 'Копировать реф. код',
      onClick: () => navigator.clipboard.writeText(r.referralCode!),
    },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}
      <Card title="Пользователи мини-аппа" size="small">
        <Space size={32} wrap style={{ marginBottom: 12 }}>
          <Statistic title="Всего" value={q.data?.total ?? 0} loading={q.isFetching} />
          <Statistic title="С балансом (на странице)" value={withBalance} />
          <Statistic title="С KYC (на странице)" value={withKyc} />
        </Space>

        <Space wrap align="end" size={12}>
          <Field label="Поиск">
            <Input.Search
              allowClear
              placeholder="Имя, username, email…"
              style={{ width: 280 }}
              onSearch={(v) => {
                setSearch(v || undefined)
                setPage(1)
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
          scroll={{ x: 1150 }}
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
            title="Пользователь"
            width={230}
            fixed="left"
            render={(_: unknown, r: MiniappUser) => (
              <Space size={8}>
                <Avatar src={r.photoUrl} icon={<UserOutlined />} size="small" />
                <Space direction="vertical" size={0}>
                  <Text strong>
                    {[r.firstName, r.lastName].filter(Boolean).join(' ') || '—'}
                  </Text>
                  {r.username && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      @{r.username}
                    </Text>
                  )}
                </Space>
              </Space>
            )}
          />
          <Table.Column
            dataIndex="telegramUserId"
            title="Telegram ID"
            width={130}
            render={(v: number) => (
              <Text copyable style={{ fontSize: 11 }}>
                {String(v)}
              </Text>
            )}
          />
          <Table.Column
            dataIndex="internalBalance"
            title="Баланс"
            width={110}
            align="right"
            sorter={(a: MiniappUser, b: MiniappUser) =>
              Number(a.internalBalance) - Number(b.internalBalance)
            }
            render={(v: string) =>
              Number(v) > 0 ? <Text strong>{money(v)}</Text> : <Text type="secondary">0</Text>
            }
          />
          <Table.Column
            dataIndex="kycStatus"
            title="KYC"
            width={120}
            render={(v: string) =>
              v ? <Tag color={KYC_COLOR[v] ?? 'default'}>{v}</Tag> : <Text type="secondary">—</Text>
            }
          />
          <Table.Column
            dataIndex="email"
            title="Email"
            width={210}
            render={(v: string, r: MiniappUser) =>
              v ? (
                <Space size={4}>
                  <Text style={{ fontSize: 12 }}>{v}</Text>
                  {r.emailVerified && <Tag color="success">✓</Tag>}
                </Space>
              ) : (
                '—'
              )
            }
          />
          <Table.Column
            title="Возможности"
            width={180}
            render={(_: unknown, r: MiniappUser) => (
              <Space size={2} wrap>
                {r.hasPassword && <Tag>пароль</Tag>}
                {r.paywaveUserId && <Tag color="blue">карты</Tag>}
                {r.cryptoWalletAddress && <Tag color="purple">крипта</Tag>}
                {r.isVCardAutoTopupEnabled && <Tag color="gold">автопополн.</Tag>}
              </Space>
            )}
          />
          <Table.Column
            dataIndex="referralCode"
            title="Реф. код"
            width={120}
            render={(v: string) => (v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—')}
          />
          <Table.Column
            dataIndex="createdAt"
            title="Регистрация"
            width={140}
            render={(v: string) => dt(v)}
          />
          <Table.Column
            title=""
            width={50}
            fixed="right"
            render={(_: unknown, r: MiniappUser) => (
              <Button size="small" icon={<EyeOutlined />} onClick={() => setViewing(r)} />
            )}
          />
        </Table>
      </Card>

      {/* Данные берём из строки списка: отдельный GET /users/{id} у мини-аппа
          сейчас отвечает 500 на любом пользователе. */}
      <Drawer open={!!viewing} onClose={() => setViewing(null)} title="Пользователь" width={640}>
        {viewing && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space size={12}>
              <Avatar src={viewing.photoUrl} icon={<UserOutlined />} size={56} />
              <Space direction="vertical" size={0}>
                <Text strong style={{ fontSize: 16 }}>
                  {[viewing.firstName, viewing.lastName].filter(Boolean).join(' ') || '—'}
                </Text>
                {viewing.username && <Text type="secondary">@{viewing.username}</Text>}
              </Space>
            </Space>

            <Descriptions
              size="small"
              column={2}
              bordered
              items={[
                {
                  key: 'tg',
                  label: 'Telegram ID',
                  children: <Text copyable>{String(viewing.telegramUserId)}</Text>,
                },
                { key: 'b', label: 'Баланс', children: <Text strong>{money(viewing.internalBalance)}</Text> },
                { key: 'e', label: 'Email', children: viewing.email ?? '—' },
                { key: 'ev', label: 'Email подтверждён', children: viewing.emailVerified ? 'да' : 'нет' },
                { key: 'p', label: 'Телефон', children: viewing.phone ?? '—' },
                { key: 'pw', label: 'Пароль задан', children: viewing.hasPassword ? 'да' : 'нет' },
                {
                  key: 'k',
                  label: 'KYC',
                  children: viewing.kycStatus ? (
                    <Tag color={KYC_COLOR[viewing.kycStatus] ?? 'default'}>{viewing.kycStatus}</Tag>
                  ) : (
                    '—'
                  ),
                },
                {
                  key: 'kv',
                  label: 'KYC пройден',
                  children: viewing.kycVerifiedAt ? dt(viewing.kycVerifiedAt) : '—',
                },
                {
                  key: 'rc',
                  label: 'Реф. код',
                  children: viewing.referralCode ? <Text code>{viewing.referralCode}</Text> : '—',
                },
                {
                  key: 'pu',
                  label: 'ID у провайдера карт',
                  children: viewing.paywaveUserId ? (
                    <Text copyable style={{ fontSize: 11 }}>
                      {viewing.paywaveUserId}
                    </Text>
                  ) : (
                    '—'
                  ),
                },
                {
                  key: 'cw',
                  label: 'Крипто-кошелёк',
                  children: viewing.cryptoWalletAddress ? (
                    <Text copyable style={{ fontSize: 11 }}>
                      {viewing.cryptoWalletAddress}
                    </Text>
                  ) : (
                    '—'
                  ),
                  span: 2,
                },
                {
                  key: 'at',
                  label: 'Автопополнение',
                  children: [
                    viewing.isVCardAutoTopupEnabled ? 'карты' : null,
                    viewing.isDepositAutoTopupEnabled ? 'депозиты' : null,
                  ]
                    .filter(Boolean)
                    .join(', ') || '—',
                  span: 2,
                },
                { key: 'c', label: 'Регистрация', children: dt(viewing.createdAt) },
                { key: 'u', label: 'Обновлён', children: dt(viewing.updatedAt) },
                {
                  key: 'id',
                  label: 'ID',
                  children: <Text copyable style={{ fontSize: 11 }}>{viewing.id}</Text>,
                  span: 2,
                },
              ]}
            />
          </Space>
        )}
      </Drawer>
    </Space>
  )
}
