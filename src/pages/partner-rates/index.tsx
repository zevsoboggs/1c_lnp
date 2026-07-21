import { useMemo, useState } from 'react'
import { useList } from '@refinedev/core'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, Table, Space, Typography, Select, Input, Alert, Segmented, App, Tag } from 'antd'
import { Toolbar } from '../../components/Toolbar'
import { salaryApi, type Assignment } from '../../api/salary'
import { employeesApi } from '../../api/employees'
import { canWrite } from '../../api/accessControl'

const { Text } = Typography

type PartnerRow = {
  id: string
  name: string
  rateId: string | null
  employeeId: string | null
  percent: number | null
}

export const PartnerRates = () => {
  const { message } = App.useApp()
  const editable = canWrite('partner-rates')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'assigned' | 'unassigned'>('all')

  // Партнёры приходят из admin-api, назначения — из нашей базы; сшиваем по id.
  const partners = useList<{ id: string; name: string }>({
    resource: 'partners',
    pagination: { pageSize: 200 },
  })
  const assignQ = useQuery({ queryKey: ['salary-assignments'], queryFn: salaryApi.assignments })
  const ratesQ = useQuery({ queryKey: ['salary-rates'], queryFn: salaryApi.rates })
  const empQ = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list })

  const assignMap = useMemo(() => {
    const m = new Map<string, Assignment>()
    for (const a of assignQ.data?.assignments ?? []) m.set(a.partner_id, a)
    return m
  }, [assignQ.data])

  const rows: PartnerRow[] = useMemo(() => {
    const list = (partners.result?.data ?? []).map((p) => {
      const a = assignMap.get(p.id)
      return {
        id: p.id,
        name: p.name,
        rateId: a?.rate_id ?? null,
        employeeId: a?.employee_id ?? null,
        percent: a?.percent ?? null,
      }
    })
    const q = search.trim().toLowerCase()
    return list
      .filter((r) => (q ? r.name.toLowerCase().includes(q) : true))
      .filter((r) =>
        filter === 'all'
          ? true
          : filter === 'assigned'
            ? r.rateId
            : !r.rateId,
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
  }, [partners.result, assignMap, search, filter])

  const rateOptions = (ratesQ.data?.rates ?? [])
    .filter((r) => r.is_active)
    .map((r) => ({ value: r.id, label: `${r.percent}%` }))
  const empOptions = (empQ.data?.employees ?? [])
    .filter((e) => e.is_active)
    .map((e) => ({ value: e.id, label: e.full_name }))

  const save = useMutation({
    mutationFn: (v: { row: PartnerRow; rateId: string | null; employeeId: string | null }) =>
      salaryApi.setAssignment(v.row.id, {
        partnerName: v.row.name,
        rateId: v.rateId,
        employeeId: v.employeeId,
      }),
    onSuccess: () => assignQ.refetch(),
    onError: (e: Error) => message.error(e.message, 6),
  })

  const assignedCount = rows.filter((r) => r.rateId).length
  const loading = partners.query.isLoading || assignQ.isFetching

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card title="Проценты партнёров" size="small">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Ставка и ответственный по каждому партнёру"
          description="Выберите партнёру ставку (из раздела «Ставки») и сотрудника, который его ведёт. Зарплата сотрудника считается по обороту закреплённых за ним партнёров × их ставка. Изменение ставки не трогает уже сохранённые зарплатные листы."
        />
        <Toolbar total={rows.length} loading={loading} onRefresh={() => { partners.query.refetch(); assignQ.refetch() }}>
          <Input.Search
            placeholder="Поиск партнёра"
            allowClear
            size="small"
            style={{ width: 220 }}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Segmented
            size="small"
            value={filter}
            onChange={(v) => setFilter(v as typeof filter)}
            options={[
              { label: 'Все', value: 'all' },
              { label: 'С назначением', value: 'assigned' },
              { label: 'Без', value: 'unassigned' },
            ]}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Назначено: {assignedCount}
          </Text>
        </Toolbar>
        <Table
          dataSource={rows}
          loading={loading}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 25, showSizeChanger: false }}
          scroll={{ x: 640 }}
        >
          <Table.Column
            dataIndex="name"
            title="Партнёр"
            render={(v: string) => <Text strong>{v}</Text>}
          />
          <Table.Column
            title="Ставка"
            width={150}
            render={(_: unknown, r: PartnerRow) =>
              editable ? (
                <Select
                  size="small"
                  style={{ width: 130 }}
                  placeholder="—"
                  allowClear
                  value={r.rateId ?? undefined}
                  options={rateOptions}
                  onChange={(rateId) =>
                    save.mutate({ row: r, rateId: rateId ?? null, employeeId: r.employeeId })
                  }
                />
              ) : r.percent != null ? (
                <Tag color="green">{r.percent}%</Tag>
              ) : (
                <Text type="secondary">—</Text>
              )
            }
          />
          <Table.Column
            title="Ответственный сотрудник"
            width={230}
            render={(_: unknown, r: PartnerRow) =>
              editable ? (
                <Select
                  size="small"
                  style={{ width: 210 }}
                  placeholder="—"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={r.employeeId ?? undefined}
                  options={empOptions}
                  onChange={(employeeId) =>
                    save.mutate({ row: r, rateId: r.rateId, employeeId: employeeId ?? null })
                  }
                />
              ) : (
                <Text type={r.employeeId ? undefined : 'secondary'}>
                  {empOptions.find((o) => o.value === r.employeeId)?.label ?? '—'}
                </Text>
              )
            }
          />
        </Table>
      </Card>
    </Space>
  )
}
