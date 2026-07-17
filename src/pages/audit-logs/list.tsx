import { useState } from 'react'
import { List, useTable } from '@refinedev/antd'
import { Table, Space, Card, Input, Typography, Tag, Button, Drawer, Descriptions } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import type { CrudFilters } from '@refinedev/core'
import type { Dayjs } from 'dayjs'
import { dt } from '../../lib/format'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { LogRangePicker } from '../../components/LogRangePicker'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

type Row = {
  id: string
  userId: string | null
  userEmail: string | null
  action: string
  entity: string | null
  entityId: string | null
  details: unknown
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
}

/** Цвет по смыслу действия, а не по точному имени: список action открытый. */
const actionColor = (a: string) => {
  if (/REJECT|FAIL|DELETE|BLOCK/i.test(a)) return 'error'
  if (/APPROVE|PAID|COMPLETE|ISSUED|ACCEPTED/i.test(a)) return 'success'
  if (/CREATE|LOGIN/i.test(a)) return 'blue'
  if (/UPDATE|SYNC|REFUND/i.test(a)) return 'orange'
  return 'default'
}

export const AuditLogList = () => {
  const [viewing, setViewing] = useState<Row | null>(null)
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)

  const { tableProps, filters, setFilters, tableQuery } = useTable({
    resource: 'audit-logs',
    syncWithLocation: true,
    pagination: { pageSize: 50 },
  })

  const valueOf = (field: string) =>
    (filters as CrudFilters)?.find((f) => 'field' in f && f.field === field)?.value

  const apply = (field: string, value: unknown) =>
    setFilters([{ field, operator: 'eq', value }], 'merge')

  // any, а не Row: useTable из Refine отдаёт строку как BaseRecord.
  const { onRow, menu } = useRowMenu<any>((r) => [
    { key: 'open', label: 'Открыть запись', onClick: () => setViewing(r) },
    { type: 'divider' },
    r.action && {
      key: 'a',
      label: `Только «${r.action}»`,
      onClick: () => apply('action', r.action),
    },
    r.entity && {
      key: 'e',
      label: `Только объект «${r.entity}»`,
      onClick: () => apply('entity', r.entity),
    },
    r.entityId && {
      key: 'eid',
      label: 'История этого объекта',
      onClick: () => apply('entityId', r.entityId),
    },
    r.userEmail && {
      key: 'u',
      label: `Действия ${r.userEmail}`,
      onClick: () => apply('userEmail', r.userEmail),
    },
  ])

  return (
    <List title="Аудит действий">
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap align="end" size={12}>
          <Field label="Поиск">
            <Input.Search
              allowClear
              placeholder="По записи…"
              style={{ width: 200 }}
              defaultValue={valueOf('search') as string}
              onSearch={(v) => apply('search', v || undefined)}
            />
          </Field>
          {/* Совпадение частичное: action=REFUND найдёт и ADMIN_API_REFUND_APPROVED. */}
          <Field label="Действие">
            <Input.Search
              allowClear
              placeholder="REFUND, LOGIN…"
              style={{ width: 180 }}
              defaultValue={valueOf('action') as string}
              onSearch={(v) => apply('action', v || undefined)}
            />
          </Field>
          <Field label="Сущность">
            <Input.Search
              allowClear
              placeholder="Invoice, Partner…"
              style={{ width: 160 }}
              defaultValue={valueOf('entity') as string}
              onSearch={(v) => apply('entity', v || undefined)}
            />
          </Field>
          <Field label="Кто (email)">
            <Input.Search
              allowClear
              placeholder="user@example.com"
              style={{ width: 200 }}
              defaultValue={valueOf('userEmail') as string}
              onSearch={(v) => apply('userEmail', v || undefined)}
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

      <Table {...tableProps} rowKey="id" size="small" scroll={{ x: 1150 }} onRow={onRow}>
        <Table.Column dataIndex="createdAt" title="Когда" width={140} render={(v: string) => dt(v)} />
        <Table.Column
          dataIndex="action"
          title="Действие"
          width={230}
          render={(v: string) => <Tag color={actionColor(v)}>{v}</Tag>}
        />
        <Table.Column
          dataIndex="userEmail"
          title="Кто"
          width={200}
          render={(v: string) =>
            v ?? <Text type="secondary">система</Text>
          }
        />
        <Table.Column
          dataIndex="entity"
          title="Объект"
          width={120}
          render={(v: string) => v ?? '—'}
        />
        <Table.Column
          dataIndex="entityId"
          title="ID объекта"
          width={230}
          render={(v: string) =>
            v ? (
              <Text copyable style={{ fontSize: 11 }}>
                {v}
              </Text>
            ) : (
              '—'
            )
          }
        />
        <Table.Column
          dataIndex="ipAddress"
          title="IP"
          width={150}
          ellipsis
          render={(v: string) => <Text style={{ fontSize: 11 }}>{v ?? '—'}</Text>}
        />
        <Table.Column
          dataIndex="details"
          title="Детали"
          ellipsis
          render={(v: unknown) =>
            v ? (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {Object.keys(v as object).slice(0, 4).join(', ')}
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
          render={(_: unknown, r: Row) => (
            <Button size="small" icon={<EyeOutlined />} onClick={() => setViewing(r)} />
          )}
        />
      </Table>

      <Drawer open={!!viewing} onClose={() => setViewing(null)} title="Запись аудита" width={720}>
        {viewing && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions
              size="small"
              column={1}
              bordered
              items={[
                {
                  key: 'a',
                  label: 'Действие',
                  children: <Tag color={actionColor(viewing.action)}>{viewing.action}</Tag>,
                },
                { key: 'w', label: 'Кто', children: viewing.userEmail ?? 'система' },
                { key: 't', label: 'Когда', children: dt(viewing.createdAt) },
                { key: 'e', label: 'Объект', children: viewing.entity ?? '—' },
                {
                  key: 'i',
                  label: 'ID объекта',
                  children: viewing.entityId ? <Text copyable>{viewing.entityId}</Text> : '—',
                },
                { key: 'ip', label: 'IP', children: viewing.ipAddress ?? '—' },
                {
                  key: 'ua',
                  label: 'User-Agent',
                  children: <Text style={{ fontSize: 11 }}>{viewing.userAgent ?? '—'}</Text>,
                },
              ]}
            />
            {viewing.details != null && (
              <Card size="small" title="Детали">
                <pre
                  style={{
                    margin: 0,
                    maxHeight: 420,
                    overflow: 'auto',
                    background: '#fafafa',
                    border: '1px solid #eee',
                    padding: 8,
                    fontSize: 11,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {JSON.stringify(viewing.details, null, 2)}
                </pre>
              </Card>
            )}
          </Space>
        )}
      </Drawer>
    </List>
  )
}
