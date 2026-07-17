import { useMemo, useState } from 'react'
import { useCustom } from '@refinedev/core'
import { useMutation } from '@tanstack/react-query'
import {
  Card,
  Table,
  Space,
  Typography,
  Tag,
  Tooltip,
  Statistic,
  Tabs,
  Input,
  Button,
  App,
} from 'antd'
import {
  CheckCircleTwoTone,
  ClockCircleTwoTone,
  StopOutlined,
  UnlockOutlined,
  FileTextOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { dt } from '../../lib/format'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { useRowMenu } from '../../components/useRowMenu'
import { DangerConfirm } from '../../components/DangerAction'
import { canWrite } from '../../api/accessControl'

const { Text } = Typography

type Domain = { domain: string; status: string; verifiedAt: string | null }
type Ip = { ipAddress: string; label: string | null }
type Row = {
  id: string
  name: string
  partnerId: string
  isSubPartner: boolean
  parentPartnerId: string | null
  apiVerificationEnforced: boolean
  apiBlocked: boolean
  domains: Domain[]
  ips: Ip[]
  apiRequests30d: number
}

const fmt = (n: number) => new Intl.NumberFormat('ru-RU').format(n)
const hasDeclaration = (r: Row) => (r.domains?.length ?? 0) > 0 || (r.ips?.length ?? 0) > 0

export const DeclarationList = () => {
  const { message } = App.useApp()
  const editable = canWrite('declarations')
  const [tab, setTab] = useState('missing')
  const [search, setSearch] = useState('')
  const [blocking, setBlocking] = useState<Row | null>(null)

  // Берём всех разом (их ~140) и делим на клиенте: так вкладки со счётчиками
  // и сортировка по риску живут в одном месте, без отдельных запросов.
  const { query, result } = useCustom<{ declarations: Row[]; pagination: { total: number } }>({
    url: '/declarations',
    method: 'get',
    config: { query: { limit: 500 } },
  })

  const all = result.data?.declarations ?? []

  const groups = useMemo(() => {
    const missing = all.filter((r) => !hasDeclaration(r))
    const filled = all.filter((r) => hasDeclaration(r))
    // Риск: не заполнил, но реально ходит по API и ещё не заблокирован.
    const risky = missing
      .filter((r) => r.apiRequests30d > 0 && !r.apiBlocked)
      .sort((a, b) => b.apiRequests30d - a.apiRequests30d)
    return { missing, filled, risky }
  }, [all])

  const block = useMutation({
    mutationFn: ({ id, blocked }: { id: string; blocked: boolean }) =>
      fetch(`/api/declaration-block/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked }),
      }).then(async (r) => {
        const b = await r.json().catch(() => null)
        if (!r.ok || b?.success === false) throw new Error(b?.error ?? `Ошибка ${r.status}`)
        return b
      }),
    onSuccess: (_r, v) => {
      setBlocking(null)
      message.success(v.blocked ? 'API партнёра заблокирован' : 'API партнёра разблокирован')
      query.refetch()
    },
    onError: (e: Error) => {
      setBlocking(null)
      message.error(e.message, 6)
    },
  })

  const noticeUrl = (partnerId: string) => `/api/declaration-notice/${partnerId}`

  const { onRow, menu } = useRowMenu<any>((r) => [
    r.partnerId && {
      key: 'notice',
      label: 'Требование о декларации',
      onClick: () => window.open(noticeUrl(r.id), '_blank', 'noopener'),
    },
    editable && {
      key: 'block',
      label: r.apiBlocked ? 'Разблокировать API' : 'Заблокировать API',
      danger: !r.apiBlocked,
      onClick: () =>
        r.apiBlocked ? block.mutate({ id: r.id, blocked: false }) : setBlocking(r),
    },
    r.partnerId && {
      key: 'code',
      label: 'Копировать код партнёра',
      onClick: () => navigator.clipboard.writeText(r.partnerId),
    },
  ])

  const filtered = (rows: Row[]) => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) => r.name?.toLowerCase().includes(q) || r.partnerId?.toLowerCase().includes(q),
    )
  }

  // Колонки действий и режима API — общие для обеих вкладок.
  const actionCol = (
    <Table.Column
      title="Действия"
      width={editable ? 130 : 60}
      fixed="right"
      render={(_: unknown, r: Row) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<FileTextOutlined />}
            title="Требование о декларации"
            href={noticeUrl(r.id)}
            target="_blank"
          />
          {editable &&
            (r.apiBlocked ? (
              <Button
                size="small"
                icon={<UnlockOutlined />}
                title="Разблокировать API"
                loading={block.isPending}
                onClick={() => block.mutate({ id: r.id, blocked: false })}
              />
            ) : (
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                title="Заблокировать API"
                onClick={() => setBlocking(r)}
              />
            ))}
        </Space>
      )}
    />
  )

  const apiModeCol = (
    <Table.Column
      title="Режим API"
      width={170}
      render={(_: unknown, r: Row) => (
        <Space size={4} wrap>
          {r.apiBlocked && <Tag color="error">заблокирован</Tag>}
          {r.apiVerificationEnforced ? (
            <Tooltip title="Запросы ограничены подтверждёнными доменами">
              <Tag color="blue">проверка вкл</Tag>
            </Tooltip>
          ) : (
            <Tag>проверка выкл</Tag>
          )}
        </Space>
      )}
    />
  )

  const partnerCol = (
    <Table.Column
      title="Партнёр"
      width={200}
      fixed="left"
      render={(_: unknown, r: Row) => (
        <Space size={4}>
          <Text strong>{r.name}</Text>
          {r.isSubPartner && <Tag>суб</Tag>}
        </Space>
      )}
    />
  )

  const apiReqCol = (
    <Table.Column
      title="Запросов за 30 дн"
      dataIndex="apiRequests30d"
      width={150}
      align="right"
      defaultSortOrder="descend"
      sorter={(a: Row, b: Row) => a.apiRequests30d - b.apiRequests30d}
      render={(v: number) =>
        v ? <Text strong>{fmt(v)}</Text> : <Text type="secondary">0</Text>
      }
    />
  )

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card title="Декларации доменов и IP" size="small">
        <Space size={32} wrap>
          <Statistic title="Всего партнёров" value={all.length} loading={query.isFetching} />
          <Statistic
            title="Без декларации"
            value={groups.missing.length}
            valueStyle={{ color: groups.missing.length ? '#d46b08' : undefined }}
          />
          <Statistic
            title="Из них ходят по API"
            value={groups.risky.length}
            valueStyle={{ color: groups.risky.length ? '#cf1322' : undefined }}
            prefix={groups.risky.length ? <WarningOutlined /> : undefined}
          />
          <Statistic title="С декларацией" value={groups.filled.length} valueStyle={{ color: '#389e0d' }} />
          <Statistic title="API заблокирован" value={all.filter((r) => r.apiBlocked).length} />
        </Space>
      </Card>

      {menu}

      <Card size="small">
        <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
          <Field label="Поиск">
            <Input.Search
              allowClear
              placeholder="Партнёр или код…"
              style={{ width: 280 }}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
        </Space>

        <Toolbar loading={query.isFetching} onRefresh={() => query.refetch()} />

        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'missing',
              label: (
                <span>
                  Не заполнили{' '}
                  <Tag color={groups.missing.length ? 'orange' : 'default'} style={{ marginInlineEnd: 0 }}>
                    {groups.missing.length}
                  </Tag>
                </span>
              ),
              children: (
                <>
                  {groups.risky.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <Text type="danger" style={{ fontSize: 12 }}>
                        <WarningOutlined /> {groups.risky.length} партнёров без декларации активно
                        ходят по API и не заблокированы — они вверху списка.
                      </Text>
                    </div>
                  )}
                  <Table
                    dataSource={filtered(groups.missing)}
                    loading={query.isFetching}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 30 }}
                    scroll={{ x: 900 }}
                    onRow={onRow}
                    // Красным подсвечиваем риск: не заполнил, но ходит по API.
                    rowClassName={(r: Row) =>
                      r.apiRequests30d > 0 && !r.apiBlocked ? 'onec-row-danger' : ''
                    }
                  >
                    {partnerCol}
                    {apiReqCol}
                    <Table.Column
                      title="Декларация"
                      width={140}
                      render={() => <Tag color="orange">не заполнена</Tag>}
                    />
                    {apiModeCol}
                    <Table.Column
                      dataIndex="partnerId"
                      title="Код"
                      width={160}
                      render={(v: string) => <Text copyable={!!v}>{v}</Text>}
                    />
                    {actionCol}
                  </Table>
                </>
              ),
            },
            {
              key: 'filled',
              label: (
                <span>
                  С декларацией{' '}
                  <Tag color="green" style={{ marginInlineEnd: 0 }}>
                    {groups.filled.length}
                  </Tag>
                </span>
              ),
              children: (
                <Table
                  dataSource={filtered(groups.filled)}
                  loading={query.isFetching}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 30 }}
                  scroll={{ x: 1150 }}
                  onRow={onRow}
                >
                  {partnerCol}
                  <Table.Column
                    dataIndex="domains"
                    title="Домены"
                    width={260}
                    render={(v: Domain[]) =>
                      v?.length ? (
                        <Space direction="vertical" size={2}>
                          {v.map((d) => (
                            <Space key={d.domain} size={4}>
                              {d.status === 'VERIFIED' ? (
                                <Tooltip title={`Подтверждён ${dt(d.verifiedAt)}`}>
                                  <CheckCircleTwoTone twoToneColor="#52c41a" />
                                </Tooltip>
                              ) : (
                                <Tooltip title={`Статус: ${d.status}`}>
                                  <ClockCircleTwoTone twoToneColor="#faad14" />
                                </Tooltip>
                              )}
                              <Text style={{ fontSize: 12 }}>{d.domain}</Text>
                            </Space>
                          ))}
                        </Space>
                      ) : (
                        <Text type="secondary">—</Text>
                      )
                    }
                  />
                  <Table.Column
                    dataIndex="ips"
                    title="Разрешённые IP"
                    width={220}
                    render={(v: Ip[]) =>
                      v?.length ? (
                        <Space size={2} wrap>
                          {v.map((i) => (
                            <Tag key={i.ipAddress} style={{ marginInlineEnd: 0, fontSize: 11 }}>
                              {i.label ? `${i.label}: ${i.ipAddress}` : i.ipAddress}
                            </Tag>
                          ))}
                        </Space>
                      ) : (
                        <Text type="secondary">—</Text>
                      )
                    }
                  />
                  {apiReqCol}
                  {apiModeCol}
                  {actionCol}
                </Table>
              ),
            },
          ]}
        />
      </Card>

      <DangerConfirm
        open={!!blocking}
        title="Заблокировать API партнёра?"
        what={`Партнёр «${blocking?.name}» не сможет обращаться к API до разблокировки. Активные интеграции перестанут работать немедленно.${
          blocking?.apiRequests30d
            ? ` За 30 дней он сделал ${fmt(blocking.apiRequests30d)} запросов — они прекратятся.`
            : ''
        }`}
        confirmWord="ЗАБЛОКИРОВАТЬ"
        okText="Заблокировать API"
        loading={block.isPending}
        onOk={() => blocking && block.mutate({ id: blocking.id, blocked: true })}
        onCancel={() => setBlocking(null)}
      />
    </Space>
  )
}
