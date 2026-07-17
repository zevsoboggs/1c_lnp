import { useState } from 'react'
import { List, useTable } from '@refinedev/antd'
import { useMutation } from '@tanstack/react-query'
import { Table, Select, Space, Card, Input, Typography, Tag, Button, App } from 'antd'
import { PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { CrudFilters } from '@refinedev/core'
import { dt } from '../../lib/format'
import { USER_ROLE, selectOptions } from '../../lib/enums'
import { StatusTag } from '../../components/StatusTag'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { UserForm } from './UserForm'
import { action } from '../../api/actions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

export const UserList = () => {
  const { message } = App.useApp()
  const [form, setForm] = useState<{ mode: 'create' | 'edit'; row?: any } | null>(null)

  const { tableProps, filters, setFilters, tableQuery } = useTable({
    resource: 'users',
    syncWithLocation: true,
    pagination: { pageSize: 50 },
  })

  const create = useMutation({
    mutationFn: (v: any) => action('/users', { body: v }),
    onSuccess: () => {
      setForm(null)
      message.success('Пользователь создан')
      tableQuery.refetch()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) =>
      action(`/users/${id}`, { method: 'PATCH', body: values }),
    onSuccess: () => {
      setForm(null)
      message.success('Сохранено')
      tableQuery.refetch()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const valueOf = (field: string) =>
    (filters as CrudFilters)?.find((f) => 'field' in f && f.field === field)?.value

  const apply = (field: string, value: unknown) =>
    setFilters([{ field, operator: 'eq', value }], 'merge')

  const { onRow, menu } = useRowMenu<any>((r) => [
    { key: 'edit', label: 'Изменить', onClick: () => setForm({ mode: 'edit', row: r }) },
    { type: 'divider' },
    r.email && {
      key: 'email',
      label: 'Копировать email',
      onClick: () => navigator.clipboard.writeText(r.email),
    },
    r.role && {
      key: 'role',
      label: `Отобрать роль «${r.role}»`,
      onClick: () => apply('role', r.role),
    },
    r.partnerId && {
      key: 'partner',
      label: `Показать юзеров партнёра «${r.partner?.name ?? ''}»`,
      onClick: () => apply('partnerId', r.partnerId),
    },
  ])

  return (
    <List
      title="Пользователи"
      headerButtons={
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setForm({ mode: 'create' })}
        >
          Новый пользователь
        </Button>
      }
    >
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
          <Field label="Партнёр">
            <PartnerSelect
              value={valueOf('partnerId') as string}
              onChange={(v) => apply('partnerId', v)}
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
        <Table.Column
          dataIndex="name"
          title="Имя"
          width={200}
          render={(v: string) => v ?? '—'}
        />
        <Table.Column
          dataIndex="email"
          title="Email"
          width={240}
          render={(v: string) => <Text copyable={!!v}>{v}</Text>}
        />
        <Table.Column
          dataIndex="role"
          title="Роль"
          width={130}
          render={(v: string) => <StatusTag list={USER_ROLE} value={v} />}
        />
        <Table.Column
          dataIndex={['partner', 'name']}
          title="Партнёр"
          width={200}
          render={(v: string) => v ?? '—'}
        />
        <Table.Column
          dataIndex="isActive"
          title="Активен"
          width={110}
          render={(v: boolean) => (
            <Tag color={v ? 'success' : 'default'}>{v ? 'да' : 'нет'}</Tag>
          )}
        />
        <Table.Column
          dataIndex="currencyMarkup"
          title="Наценка"
          width={110}
          align="right"
          render={(v: number) => (v == null ? '—' : `${v}%`)}
        />
        <Table.Column dataIndex="createdAt" title="Создан" width={150} render={(v: string) => dt(v)} />
        <Table.Column
          title=""
          width={50}
          fixed="right"
          render={(_: unknown, r: any) => (
            <Button
              size="small"
              icon={<EditOutlined />}
              title="Изменить"
              onClick={() => setForm({ mode: 'edit', row: r })}
            />
          )}
        />
      </Table>

      <UserForm
        open={!!form}
        mode={form?.mode ?? 'create'}
        initial={form?.row}
        loading={create.isPending || update.isPending}
        onCancel={() => setForm(null)}
        onSubmit={(v) =>
          form?.mode === 'create' ? create.mutate(v) : update.mutate({ id: form!.row.id, values: v })
        }
      />
    </List>
  )
}
