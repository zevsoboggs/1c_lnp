import { useState } from 'react'
import { List, useTable } from '@refinedev/antd'
import { useQuery } from '@tanstack/react-query'
import {
  Table,
  Select,
  Space,
  Card,
  Input,
  Typography,
  Tag,
  Statistic,
  Button,
  Drawer,
  Descriptions,
  Spin,
  Divider,
} from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import type { CrudFilters } from '@refinedev/core'
import type { Dayjs } from 'dayjs'
import { dt } from '../../lib/format'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { LogRangePicker } from '../../components/LogRangePicker'
import { action } from '../../api/actions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

type Row = {
  id: string
  requestId: string
  createdAt: string
  partnerId: string | null
  partnerName: string | null
  method: string
  endpoint: string
  success: boolean
  statusCode: number
  duration: number
  ipAddress: string | null
  errorMessage: string | null
}

const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].map((v) => ({ value: v, label: v }))

const codeColor = (c: number) =>
  c >= 500 ? 'error' : c >= 400 ? 'warning' : c >= 300 ? 'default' : 'success'

/** Тела и заголовки приходят строками или объектами — показываем читаемо. */
const pretty = (v: unknown) => {
  if (v == null) return '—'
  if (typeof v === 'string') {
    try {
      return JSON.stringify(JSON.parse(v), null, 2)
    } catch {
      return v
    }
  }
  return JSON.stringify(v, null, 2)
}

const Code = ({ value }: { value: unknown }) => (
  <pre
    style={{
      margin: 0,
      maxHeight: 260,
      overflow: 'auto',
      background: '#fafafa',
      border: '1px solid #eee',
      padding: 8,
      fontSize: 11,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    }}
  >
    {pretty(value)}
  </pre>
)

export const ApiLogList = () => {
  const [viewing, setViewing] = useState<Row | null>(null)
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)

  const { tableProps, filters, setFilters, tableQuery } = useTable({
    resource: 'api-logs',
    syncWithLocation: true,
    pagination: { pageSize: 50 },
  })

  const valueOf = (field: string) =>
    (filters as CrudFilters)?.find((f) => 'field' in f && f.field === field)?.value

  const apply = (field: string, value: unknown) =>
    setFilters([{ field, operator: 'eq', value }], 'merge')

  const detail = useQuery({
    queryKey: ['api-log', viewing?.id],
    queryFn: () => action<{ log: any }>(`/api-logs/${viewing!.id}`, { method: 'GET' }),
    enabled: !!viewing,
  })

  const log = detail.data?.log
  const stats = (tableQuery.data as any)?.stats

  // any, а не Row: useTable из Refine отдаёт строку как BaseRecord.
  const { onRow, menu } = useRowMenu<any>((r) => [
    { key: 'open', label: 'Полная запись', onClick: () => setViewing(r) },
    { type: 'divider' },
    r.endpoint && {
      key: 'ep',
      label: 'Отобрать по этому эндпоинту',
      onClick: () => apply('endpoint', r.endpoint),
    },
    r.partnerId && {
      key: 'p',
      label: `Логи партнёра «${r.partnerName ?? ''}»`,
      onClick: () => apply('partnerId', r.partnerId),
    },
    { key: 'm', label: `Только ${r.method}`, onClick: () => apply('method', r.method) },
    !r.success && { key: 'err', label: 'Только ошибки', onClick: () => apply('success', 'false') },
    r.requestId && {
      key: 'rid',
      label: 'Копировать requestId',
      onClick: () => navigator.clipboard.writeText(r.requestId),
    },
  ])

  return (
    <List title="API-логи">
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space size={32} wrap style={{ marginBottom: 12 }}>
          <Statistic
            title="Запросов всего"
            value={stats?.total ?? tableQuery.data?.total ?? 0}
            loading={tableQuery.isFetching}
          />
          <Statistic title="Успешных" value={stats?.success ?? 0} valueStyle={{ color: '#389e0d' }} />
          <Statistic
            title="С ошибками"
            value={stats?.errors ?? 0}
            valueStyle={{ color: stats?.errors ? '#cf1322' : undefined }}
          />
        </Space>

        <Divider style={{ margin: '0 0 12px' }} />

        <Space wrap align="end" size={12}>
          <Field label="Поиск">
            <Input.Search
              allowClear
              placeholder="requestId, эндпоинт…"
              style={{ width: 220 }}
              defaultValue={valueOf('search') as string}
              onSearch={(v) => apply('search', v || undefined)}
            />
          </Field>
          <Field label="Партнёр">
            <PartnerSelect
              value={valueOf('partnerId') as string}
              onChange={(v) => apply('partnerId', v)}
            />
          </Field>
          <Field label="Результат">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 150 }}
              value={valueOf('success') as string}
              onChange={(v) => apply('success', v)}
              options={[
                { value: 'true', label: 'Успешные' },
                { value: 'false', label: 'С ошибкой' },
              ]}
            />
          </Field>
          <Field label="Метод">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 110 }}
              options={METHODS}
              value={valueOf('method') as string}
              onChange={(v) => apply('method', v)}
            />
          </Field>
          <Field label="Эндпоинт">
            <Input.Search
              allowClear
              placeholder="/api/v2/invoices…"
              style={{ width: 200 }}
              defaultValue={valueOf('endpoint') as string}
              onSearch={(v) => apply('endpoint', v || undefined)}
            />
          </Field>
          <Field label="Период">
            <LogRangePicker
              value={range}
              onChange={(r, api) => {
                setRange(r)
                setFilters(
                  [
                    { field: 'from', operator: 'eq', value: api.from },
                    { field: 'to', operator: 'eq', value: api.to },
                  ],
                  'merge',
                )
              }}
            />
          </Field>
        </Space>
      </Card>

      <Toolbar
        total={tableQuery.data?.total}
        loading={tableQuery.isFetching}
        onRefresh={() => tableQuery.refetch()}
      />

      {menu}

      <Table {...tableProps} rowKey="id" size="small" scroll={{ x: 1200 }} onRow={onRow}>
        <Table.Column dataIndex="createdAt" title="Когда" width={140} render={(v: string) => dt(v)} />
        <Table.Column
          dataIndex="method"
          title="Метод"
          width={80}
          render={(v: string) => <Tag>{v}</Tag>}
        />
        <Table.Column
          dataIndex="statusCode"
          title="Код"
          width={80}
          align="center"
          render={(v: number) => <Tag color={codeColor(v)}>{v}</Tag>}
        />
        <Table.Column
          dataIndex="endpoint"
          title="Эндпоинт"
          width={330}
          ellipsis
          render={(v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>}
        />
        <Table.Column
          dataIndex="partnerName"
          title="Партнёр"
          width={150}
          render={(v: string) => v ?? <Text type="secondary">—</Text>}
        />
        <Table.Column
          dataIndex="duration"
          title="Время"
          width={90}
          align="right"
          render={(v: number) => (
            <Text style={{ color: v > 2000 ? '#cf1322' : v > 500 ? '#d46b08' : undefined }}>
              {v} мс
            </Text>
          )}
        />
        <Table.Column
          dataIndex="ipAddress"
          title="IP"
          width={150}
          ellipsis
          render={(v: string) => <Text style={{ fontSize: 11 }}>{v ?? '—'}</Text>}
        />
        <Table.Column
          dataIndex="errorMessage"
          title="Ошибка"
          ellipsis
          render={(v: string) => (v ? <Text type="danger">{v}</Text> : '—')}
        />
        <Table.Column
          title=""
          width={50}
          fixed="right"
          render={(_: unknown, r: Row) => (
            <Button
              size="small"
              icon={<EyeOutlined />}
              title="Полная запись"
              onClick={() => setViewing(r)}
            />
          )}
        />
      </Table>

      <Drawer open={!!viewing} onClose={() => setViewing(null)} title="Запись API-лога" width={860}>
        {detail.isFetching && <Spin />}
        {log && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions
              size="small"
              column={2}
              bordered
              items={[
                { key: 'm', label: 'Метод', children: <Tag>{log.method}</Tag> },
                {
                  key: 's',
                  label: 'Код',
                  children: <Tag color={codeColor(log.statusCode)}>{log.statusCode}</Tag>,
                },
                { key: 'e', label: 'Эндпоинт', children: <Text copyable>{log.endpoint}</Text>, span: 2 },
                { key: 'p', label: 'Партнёр', children: log.partnerName ?? '—' },
                { key: 'd', label: 'Длительность', children: `${log.duration} мс` },
                { key: 'i', label: 'IP', children: log.ipAddress ?? '—' },
                { key: 't', label: 'Когда', children: dt(log.createdAt) },
                {
                  key: 'r',
                  label: 'requestId',
                  children: <Text copyable style={{ fontSize: 11 }}>{log.requestId}</Text>,
                  span: 2,
                },
                { key: 'ua', label: 'User-Agent', children: <Text style={{ fontSize: 11 }}>{log.userAgent ?? '—'}</Text>, span: 2 },
              ]}
            />

            {log.errorMessage && (
              <Card size="small" title="Ошибка">
                <Text type="danger">{log.errorMessage}</Text>
              </Card>
            )}

            {log.queryParams && (
              <Card size="small" title="Query-параметры">
                <Code value={log.queryParams} />
              </Card>
            )}
            <Card size="small" title="Заголовки запроса">
              <Code value={log.requestHeaders} />
            </Card>
            <Card size="small" title="Тело запроса">
              <Code value={log.requestBody} />
            </Card>
            <Card size="small" title="Ответ">
              <Code value={log.responseBody} />
            </Card>
          </Space>
        )}
      </Drawer>
    </List>
  )
}
