import { useState } from 'react'
import { List, useTable } from '@refinedev/antd'
import { useMutation } from '@tanstack/react-query'
import { Table, Select, Space, Card, Input, Typography, InputNumber, Button, App, Tooltip, Tag } from 'antd'
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons'
import type { CrudFilters } from '@refinedev/core'
import { USER_ROLE, selectOptions } from '../../lib/enums'
import { StatusTag } from '../../components/StatusTag'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { action } from '../../api/actions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

/**
 * Наценки на курс. Строки — это пользователи (эндпоинт отдаёт их под ключом
 * `users`, не `markups`), а PATCH висит на коллекции: id уходит в теле как
 * userId, роута /markups/{id} не существует.
 */
export const MarkupList = () => {
  const { message } = App.useApp()
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<number>(0)

  const { tableProps, filters, setFilters, tableQuery } = useTable({
    resource: 'markups',
    syncWithLocation: true,
    pagination: { pageSize: 50 },
  })

  const valueOf = (field: string) =>
    (filters as CrudFilters)?.find((f) => 'field' in f && f.field === field)?.value

  const apply = (field: string, value: unknown) =>
    setFilters([{ field, operator: 'eq', value }], 'merge')

  const save = useMutation({
    mutationFn: (userId: string) =>
      // currencyMarkup обязан быть числом: строку API молча отвергнет.
      action('/markups', { method: 'PATCH', body: { userId, currencyMarkup: Number(draft) } }),
    onSuccess: () => {
      setEditing(null)
      message.success('Наценка сохранена')
      tableQuery.refetch()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const { onRow, menu } = useRowMenu<any>((r) => [
    {
      key: 'edit',
      label: 'Изменить наценку',
      onClick: () => {
        setEditing(r.id)
        setDraft(r.currencyMarkup ?? 0)
      },
    },
    { type: 'divider' },
    r.email && {
      key: 'mail',
      label: 'Копировать email',
      onClick: () => navigator.clipboard.writeText(r.email),
    },
    r.role && { key: 'role', label: `Отобрать роль «${r.role}»`, onClick: () => apply('role', r.role) },
  ])

  return (
    <List title="Наценки на курс">
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap align="end" size={12}>
          <Field label="Поиск">
            <Input.Search
              allowClear
              placeholder="Имя или email…"
              style={{ width: 260 }}
              defaultValue={valueOf('q') as string}
              onSearch={(v) => apply('q', v || undefined)}
            />
          </Field>
          <Field label="Роль">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 170 }}
              options={selectOptions(USER_ROLE)}
              value={valueOf('role') as string}
              onChange={(v) => apply('role', v)}
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

      <Table {...tableProps} rowKey="id" size="small" scroll={{ x: 900 }} onRow={onRow}>
        <Table.Column dataIndex="name" title="Имя" width={180} render={(v: string) => v ?? '—'} />
        <Table.Column dataIndex="email" title="Email" width={230} />
        <Table.Column
          dataIndex="role"
          title="Роль"
          width={120}
          render={(v: string) => <StatusTag list={USER_ROLE} value={v} />}
        />
        <Table.Column
          dataIndex="currencyMarkup"
          title="Своя наценка"
          width={170}
          align="right"
          render={(v: number, r: any) =>
            editing === r.id ? (
              <Space size={4}>
                <InputNumber
                  size="small"
                  autoFocus
                  min={0}
                  max={100}
                  step={0.1}
                  precision={2}
                  value={draft}
                  onChange={(x) => setDraft(x ?? 0)}
                  style={{ width: 80 }}
                  onPressEnter={() => save.mutate(r.id)}
                />
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={save.isPending}
                  onClick={() => save.mutate(r.id)}
                />
                <Button size="small" icon={<CloseOutlined />} onClick={() => setEditing(null)} />
              </Space>
            ) : (
              <Space size={4}>
                <Text strong>{v == null ? '—' : `${v}%`}</Text>
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditing(r.id)
                    setDraft(v ?? 0)
                  }}
                />
              </Space>
            )
          }
        />
        <Table.Column
          dataIndex="effectiveMarkup"
          title="Эффективная"
          width={130}
          align="right"
          render={(v: number, r: any) => (
            <Tooltip
              title={
                r.markupChain?.length
                  ? `Цепочка: ${r.markupChain.map((c: any) => `${c.name ?? c.email}: ${c.markup}%`).join(' → ')}`
                  : 'Наследования нет — это собственное значение'
              }
            >
              <Text style={{ color: '#0D5AA7' }}>{v == null ? '—' : `${v}%`}</Text>
            </Tooltip>
          )}
        />
        <Table.Column
          dataIndex="markupChain"
          title="Наследование"
          render={(v: any[]) =>
            v?.length ? (
              <Space size={2} wrap>
                {v.map((c, i) => (
                  <Tag key={i} style={{ marginInlineEnd: 0 }}>
                    {c.name ?? c.email}: {c.markup}%
                  </Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">—</Text>
            )
          }
        />
      </Table>
    </List>
  )
}
