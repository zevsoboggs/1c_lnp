import { useState } from 'react'
import { List, useTable } from '@refinedev/antd'
import { useMutation } from '@tanstack/react-query'
import { Table, Select, Space, Card, Input, Typography, Tag, Button, App } from 'antd'
import { PlusOutlined, EditOutlined, KeyOutlined } from '@ant-design/icons'
import type { CrudFilters } from '@refinedev/core'
import { dt } from '../../lib/format'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { DangerConfirm } from '../../components/DangerAction'
import { SecretOnce } from '../../components/SecretOnce'
import { PartnerForm } from './PartnerForm'
import { action } from '../../api/actions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

export const PartnerList = () => {
  const { message } = App.useApp()
  const { tableProps, filters, setFilters, tableQuery } = useTable({
    resource: 'partners',
    syncWithLocation: true,
    pagination: { pageSize: 50 },
  })

  const [form, setForm] = useState<{ mode: 'create' | 'edit'; row?: any } | null>(null)
  const [rotating, setRotating] = useState<any>(null)
  const [secret, setSecret] = useState<{ title: string; value: string; hint?: string } | null>(null)

  const valueOf = (field: string) =>
    (filters as CrudFilters)?.find((f) => 'field' in f && f.field === field)?.value

  const apply = (field: string, value: unknown) =>
    setFilters([{ field, operator: 'eq', value }], 'merge')

  const create = useMutation({
    mutationFn: (v: any) => action<{ partner: any }>('/partners', { body: v }),
    onSuccess: (r) => {
      setForm(null)
      tableQuery.refetch()
      if (r.partner?.apiSecretKey) {
        setSecret({
          title: `Партнёр «${r.partner.name}» создан`,
          value: r.partner.apiSecretKey,
          hint: 'API-секрет отдаётся только сейчас. Перевыпустить можно кнопкой с ключом, но старый сразу перестанет работать.',
        })
      } else {
        message.success('Партнёр создан')
      }
    },
    onError: (e: Error) => message.error(e.message),
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) =>
      action(`/partners/${id}`, { method: 'PATCH', body: values }),
    onSuccess: () => {
      setForm(null)
      message.success('Сохранено')
      tableQuery.refetch()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const rotate = useMutation({
    mutationFn: (id: string) => action<{ partner: any }>(`/partners/${id}/generate-secret`),
    onSuccess: (r) => {
      setRotating(null)
      tableQuery.refetch()
      setSecret({
        title: `Новый секрет для «${r.partner.name}»`,
        value: r.partner.apiSecretKey,
        hint: 'Старый секрет уже недействителен — интеграции партнёра перестанут работать, пока не пропишут новый.',
      })
    },
    onError: (e: Error) => {
      setRotating(null)
      message.error(e.message)
    },
  })

  const { onRow, menu } = useRowMenu<any>((r) => [
    { key: 'edit', label: 'Изменить', onClick: () => setForm({ mode: 'edit', row: r }) },
    { key: 'secret', label: 'Перевыпустить API-секрет', danger: true, onClick: () => setRotating(r) },
    { type: 'divider' },
    r.partnerId && {
      key: 'code',
      label: 'Копировать код партнёра',
      onClick: () => navigator.clipboard.writeText(r.partnerId),
    },
    r.email && {
      key: 'email',
      label: 'Копировать email',
      onClick: () => navigator.clipboard.writeText(r.email),
    },
  ])

  return (
    <List
      title="Партнёры"
      headerButtons={
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setForm({ mode: 'create' })}>
          Новый партнёр
        </Button>
      }
    >
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap align="end" size={12}>
          <Field label="Поиск">
            <Input.Search
              allowClear
              placeholder="Название, email, код…"
              style={{ width: 280 }}
              defaultValue={valueOf('q') as string}
              onSearch={(v) => apply('q', v || undefined)}
            />
          </Field>
          <Field label="Активность">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 180 }}
              options={[
                { value: 'true', label: 'Активные' },
                { value: 'false', label: 'Неактивные' },
              ]}
              value={valueOf('isActive') as string}
              onChange={(v) => apply('isActive', v)}
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
          dataIndex="name"
          title="Название"
          width={200}
          render={(v: string) => <Text strong>{v}</Text>}
        />
        {/* Тут partnerId — человекочитаемый код. В /finance это поле означает UUID. */}
        <Table.Column
          dataIndex="partnerId"
          title="Код"
          width={140}
          render={(v: string) => <Text copyable={!!v}>{v ?? '—'}</Text>}
        />
        <Table.Column dataIndex="email" title="Email" width={200} />
        <Table.Column
          title="Состояние"
          width={190}
          render={(_: unknown, r: any) => (
            <Space size={4} wrap>
              <Tag color={r.isActive ? 'success' : 'default'}>
                {r.isActive ? 'Активен' : 'Выключен'}
              </Tag>
              {r.isBlocked && <Tag color="error">Заблокирован</Tag>}
              {r.apiBlocked && <Tag color="warning">API off</Tag>}
              {r.kycEnabled && <Tag color="blue">KYC</Tag>}
            </Space>
          )}
        />
        <Table.Column
          dataIndex="platformCommission"
          title="Комиссия"
          width={100}
          align="right"
          render={(v: number) => (v == null ? '—' : `${v}%`)}
        />
        <Table.Column
          dataIndex="parentPartnerId"
          title="Родитель"
          width={110}
          render={(v: string) => (v ? <Tag>суб-партнёр</Tag> : '—')}
        />
        <Table.Column dataIndex="createdAt" title="Создан" width={140} render={(v: string) => dt(v)} />
        <Table.Column
          title="Действия"
          width={100}
          fixed="right"
          render={(_: unknown, r: any) => (
            <Space size={4}>
              <Button
                size="small"
                icon={<EditOutlined />}
                title="Изменить"
                onClick={() => setForm({ mode: 'edit', row: r })}
              />
              <Button
                size="small"
                icon={<KeyOutlined />}
                title="Перевыпустить API-секрет"
                onClick={() => setRotating(r)}
              />
            </Space>
          )}
        />
      </Table>

      <PartnerForm
        open={!!form}
        mode={form?.mode ?? 'create'}
        initial={form?.row}
        loading={create.isPending || update.isPending}
        onCancel={() => setForm(null)}
        onSubmit={(v) =>
          form?.mode === 'create' ? create.mutate(v) : update.mutate({ id: form!.row.id, values: v })
        }
      />

      <DangerConfirm
        open={!!rotating}
        title="Перевыпустить API-секрет?"
        what={`Старый секрет партнёра «${rotating?.name}» перестанет работать немедленно. Все его интеграции будут получать ошибки, пока туда не пропишут новый секрет.`}
        confirmWord="ПЕРЕВЫПУСТИТЬ"
        okText="Перевыпустить"
        loading={rotate.isPending}
        onOk={() => rotate.mutate(rotating.id)}
        onCancel={() => setRotating(null)}
      />

      <SecretOnce
        open={!!secret}
        title={secret?.title ?? ''}
        secret={secret?.value ?? null}
        hint={secret?.hint}
        onClose={() => setSecret(null)}
      />
    </List>
  )
}
