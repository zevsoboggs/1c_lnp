import { useState } from 'react'
import { useCustom } from '@refinedev/core'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  Table,
  Space,
  Typography,
  Tag,
  Select,
  Button,
  Drawer,
  Descriptions,
  Alert,
  Statistic,
  Progress,
  Spin,
  Divider,
} from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { money } from '../../lib/format'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { Sparkline } from '../../components/Sparkline'
import { action } from '../../api/actions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

type Finding = { type: string; severity: string }
type Row = {
  partnerId: string
  name: string
  riskScore: number
  apiBlocked: boolean
  flags: string[]
  distinctIps: number
  clients: string[]
  activeSubKeys: number
  spikeFactor: number | null
  topFindings: Finding[]
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: 'error',
  HIGH: 'volcano',
  MEDIUM: 'orange',
  LOW: 'default',
}

const riskColor = (v: number) => (v >= 70 ? '#cf1322' : v >= 40 ? '#d46b08' : '#389e0d')

export const AmlGuardPage = () => {
  const [windowHours, setWindowHours] = useState(48)
  const [viewing, setViewing] = useState<Row | null>(null)

  const { query, result } = useCustom<{ rows: Row[]; scanned: number }>({
    url: '/aml-guard',
    method: 'get',
    config: { query: { windowHours } },
    // Обзор считает риски по всем партнёрам и занимает секунды — не дёргаем зря.
    queryOptions: { staleTime: 2 * 60_000 },
  })

  const rows = result.data?.rows ?? []
  const scanned = result.data?.scanned ?? 0

  const profile = useQuery({
    queryKey: ['aml-profile', viewing?.partnerId],
    queryFn: () => action<{ profile: any }>(`/aml-guard/partner/${viewing!.partnerId}`, { method: 'GET' }),
    enabled: !!viewing,
    staleTime: 60_000,
  })

  const p = profile.data?.profile
  const series = p?.turnover?.series ?? []

  const critical = rows.filter((r) => r.topFindings?.some((f) => f.severity === 'CRITICAL')).length

  const { onRow, menu } = useRowMenu<Row>((r) => [
    { key: 'open', label: 'Профиль риска', onClick: () => setViewing(r) },
    { type: 'divider' },
    r.flags?.length > 0 && {
      key: 'flags',
      label: 'Копировать находки',
      onClick: () => navigator.clipboard.writeText(r.flags.join('\n')),
    },
    r.partnerId && {
      key: 'pid',
      label: 'Копировать ID партнёра',
      onClick: () => navigator.clipboard.writeText(r.partnerId),
    },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}
      <Card title="AML-Guard" size="small">
        <Space wrap align="end" size={12}>
          <Field label="Окно анализа">
            <Select
              style={{ width: 160 }}
              value={windowHours}
              onChange={setWindowHours}
              options={[
                { value: 24, label: '24 часа' },
                { value: 48, label: '48 часов' },
                { value: 72, label: '72 часа' },
                { value: 168, label: 'Неделя' },
              ]}
            />
          </Field>
        </Space>

        <Divider style={{ margin: '12px 0' }} />

        <Space size={32} wrap>
          <Statistic title="Проверено партнёров" value={scanned} loading={query.isFetching} />
          <Statistic
            title="С находками"
            value={rows.length}
            valueStyle={{ color: rows.length ? '#d46b08' : undefined }}
          />
          <Statistic
            title="Критических"
            value={critical}
            valueStyle={{ color: critical ? '#cf1322' : undefined }}
          />
        </Space>
      </Card>

      <Card size="small">
        <Toolbar total={rows.length} loading={query.isFetching} onRefresh={() => query.refetch()} />
        <Table
          dataSource={rows}
          loading={query.isFetching}
          rowKey="partnerId"
          size="small"
          pagination={{ pageSize: 30 }}
          scroll={{ x: 1150 }}
          onRow={onRow}
        >
          <Table.Column
            dataIndex="name"
            title="Партнёр"
            width={170}
            fixed="left"
            render={(v: string, r: Row) => (
              <Space size={4}>
                <Text strong>{v}</Text>
                {r.apiBlocked && <Tag color="error">API off</Tag>}
              </Space>
            )}
          />
          <Table.Column
            dataIndex="riskScore"
            title="Риск"
            width={130}
            align="right"
            defaultSortOrder="descend"
            sorter={(a: Row, b: Row) => a.riskScore - b.riskScore}
            render={(v: number) => (
              <Space size={6}>
                <Progress
                  type="line"
                  percent={v}
                  showInfo={false}
                  size={[50, 6]}
                  strokeColor={riskColor(v)}
                />
                <Text strong style={{ color: riskColor(v) }}>
                  {v}
                </Text>
              </Space>
            )}
          />
          <Table.Column
            dataIndex="topFindings"
            title="Находки"
            width={240}
            render={(v: Finding[]) => (
              <Space size={2} wrap>
                {v?.map((f) => (
                  <Tag key={f.type} color={SEV_COLOR[f.severity]} style={{ marginInlineEnd: 0 }}>
                    {f.type}
                  </Tag>
                ))}
              </Space>
            )}
          />
          <Table.Column
            dataIndex="spikeFactor"
            title="Всплеск"
            width={100}
            align="right"
            sorter={(a: Row, b: Row) => (a.spikeFactor ?? 0) - (b.spikeFactor ?? 0)}
            render={(v: number) =>
              v ? <Text strong style={{ color: v >= 3 ? '#cf1322' : undefined }}>×{v}</Text> : '—'
            }
          />
          <Table.Column dataIndex="distinctIps" title="IP" width={70} align="right" />
          <Table.Column
            dataIndex="activeSubKeys"
            title="Ключей"
            width={90}
            align="right"
            render={(v: number) => v ?? '—'}
          />
          <Table.Column
            dataIndex="clients"
            title="Клиенты"
            width={140}
            render={(v: string[]) =>
              v?.length ? (
                <Space size={2} wrap>
                  {v.map((c) => (
                    <Tag key={c} style={{ marginInlineEnd: 0 }}>
                      {c}
                    </Tag>
                  ))}
                </Space>
              ) : (
                '—'
              )
            }
          />
          <Table.Column
            title=""
            width={50}
            fixed="right"
            render={(_: unknown, r: Row) => (
              <Button
                size="small"
                icon={<EyeOutlined />}
                title="Профиль партнёра"
                onClick={() => setViewing(r)}
              />
            )}
          />
        </Table>
      </Card>

      <Drawer
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={`Профиль риска: ${viewing?.name ?? ''}`}
        width={800}
      >
        {profile.isFetching && <Spin />}
        {p && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space size={32} wrap>
              <Statistic
                title="Риск-скор"
                value={p.riskScore}
                valueStyle={{ color: riskColor(p.riskScore), fontWeight: 700 }}
              />
              <Statistic title="IP-адресов" value={p.distinctSourceIps?.length ?? 0} />
              <Statistic title="Пользователей" value={p.users?.length ?? 0} />
              <Statistic
                title="Пик оборота"
                value={p.turnover?.peakRub ?? 0}
                precision={0}
                suffix="₽"
              />
            </Space>

            {p.handover?.detected && (
              <Alert
                type="error"
                showIcon
                message="Похоже на передачу ключа третьим лицам"
                description="Guard увидел признаки того, что API-ключом пользуется не сам партнёр."
              />
            )}

            {p.turnover?.spikeFlag && (
              <Alert
                type="warning"
                showIcon
                message={`Всплеск оборота ×${p.turnover.spikeFactor}`}
                description={`Пик ${money((p.turnover.peakRub ?? 0) * 100)} против среднего ${money((p.turnover.recentAvgRub ?? 0) * 100)}.`}
              />
            )}

            {series.length > 0 && (
              <Card size="small" title="Оборот по дням">
                <Sparkline
                  data={series.map((d: any) => d.sumRub)}
                  labels={series.map((d: any) => d.date)}
                  width={720}
                  height={80}
                />
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {series[0]?.date} — {series[series.length - 1]?.date}, пик выделен красным
                </Text>
              </Card>
            )}

            {p.riskReasons?.length > 0 && (
              <Card size="small" title="Почему поднят риск">
                <ul style={{ margin: 0, paddingInlineStart: 18 }}>
                  {p.riskReasons.map((r: string, i: number) => (
                    <li key={i}>
                      <Text>{r}</Text>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {p.guardFindings?.length > 0 && (
              <Card size="small" title="Находки">
                <Table
                  dataSource={p.guardFindings}
                  rowKey={(r: any, i) => `${r.type}-${i}`}
                  size="small"
                  pagination={false}
                >
                  <Table.Column
                    dataIndex="severity"
                    title="Важность"
                    width={110}
                    render={(v: string) => <Tag color={SEV_COLOR[v]}>{v}</Tag>}
                  />
                  <Table.Column dataIndex="type" title="Тип" width={170} />
                  <Table.Column
                    dataIndex="detail"
                    title="Детали"
                    render={(v: unknown, r: any) =>
                      typeof v === 'string' ? v : (r.message ?? r.description ?? '—')
                    }
                  />
                </Table>
              </Card>
            )}

            <Descriptions
              size="small"
              column={2}
              bordered
              items={[
                { key: 'a', label: 'Активен', children: p.isActive ? 'да' : 'нет' },
                { key: 'b', label: 'API заблокирован', children: p.apiBlocked ? 'да' : 'нет' },
                {
                  key: 'c',
                  label: 'Проверка доменов',
                  children: p.apiVerificationEnforced ? 'включена' : 'выключена',
                },
                { key: 'd', label: 'Клиенты', children: (p.sourceClients ?? []).join(', ') || '—' },
                {
                  key: 'e',
                  label: 'IP-адреса',
                  children: (p.distinctSourceIps ?? []).join(', ') || '—',
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
