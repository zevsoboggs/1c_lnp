import { List, useTable } from '@refinedev/antd'
import { Table, Select, Space, Card, Typography, Tag, Tooltip } from 'antd'
import { CheckCircleTwoTone, ClockCircleTwoTone } from '@ant-design/icons'
import type { CrudFilters } from '@refinedev/core'
import { dt } from '../../lib/format'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { useRowMenu } from '../../components/useRowMenu'

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

export const DeclarationList = () => {
  const { tableProps, filters, setFilters, tableQuery } = useTable({
    resource: 'declarations',
    syncWithLocation: true,
    pagination: { pageSize: 50 },
  })

  const valueOf = (field: string) =>
    (filters as CrudFilters)?.find((f) => 'field' in f && f.field === field)?.value

  const apply = (field: string, value: unknown) =>
    setFilters([{ field, operator: 'eq', value }], 'merge')

  // any, а не Row: useTable из Refine отдаёт строку как BaseRecord.
  const { onRow, menu } = useRowMenu<any>((r) => [
    r.domains?.length > 0 && {
      key: 'dom',
      label: `Копировать домены (${r.domains.length})`,
      onClick: () =>
        navigator.clipboard.writeText(r.domains.map((d: Domain) => d.domain).join('\n')),
    },
    r.ips?.length > 0 && {
      key: 'ips',
      label: `Копировать IP (${r.ips.length})`,
      onClick: () => navigator.clipboard.writeText(r.ips.map((i: Ip) => i.ipAddress).join('\n')),
    },
    r.partnerId && {
      key: 'code',
      label: 'Копировать код партнёра',
      onClick: () => navigator.clipboard.writeText(r.partnerId),
    },
  ])

  return (
    <List title="Декларации">
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap align="end" size={12}>
          <Field label="Партнёр">
            <PartnerSelect
              value={valueOf('partnerId') as string}
              onChange={(v) => apply('partnerId', v)}
            />
          </Field>
          <Field label="Показывать">
            <Select
              allowClear
              placeholder="Всех"
              style={{ width: 220 }}
              value={
                valueOf('hasDeclaration') ? 'declared' : valueOf('usingApi') ? 'api' : undefined
              }
              options={[
                { value: 'declared', label: 'Только с декларацией' },
                { value: 'api', label: 'Только ходящих по API' },
              ]}
              onChange={(v) =>
                setFilters(
                  [
                    { field: 'hasDeclaration', operator: 'eq', value: v === 'declared' ? '1' : undefined },
                    { field: 'usingApi', operator: 'eq', value: v === 'api' ? '1' : undefined },
                  ],
                  'merge',
                )
              }
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
          width={230}
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
        <Table.Column
          dataIndex="apiRequests30d"
          title="Запросов за 30 дн"
          width={150}
          align="right"
          sorter={(a: Row, b: Row) => a.apiRequests30d - b.apiRequests30d}
          defaultSortOrder="descend"
          render={(v: number) =>
            v ? <Text strong>{new Intl.NumberFormat('ru-RU').format(v)}</Text> : <Text type="secondary">0</Text>
          }
        />
        <Table.Column
          title="Режим API"
          width={180}
          render={(_: unknown, r: Row) => (
            <Space size={4} wrap>
              {r.apiBlocked && <Tag color="error">заблокирован</Tag>}
              {r.apiVerificationEnforced ? (
                <Tooltip title="Вебхуки и запросы ограничены подтверждёнными доменами">
                  <Tag color="blue">проверка вкл</Tag>
                </Tooltip>
              ) : (
                <Tag>проверка выкл</Tag>
              )}
            </Space>
          )}
        />
        <Table.Column
          dataIndex="partnerId"
          title="Код"
          width={160}
          render={(v: string) => <Text copyable={!!v}>{v}</Text>}
        />
      </Table>
    </List>
  )
}
