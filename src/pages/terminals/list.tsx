import { useState } from 'react'
import { List, useTable } from '@refinedev/antd'
import { useMutation } from '@tanstack/react-query'
import { Table, Select, Space, Card, Typography, Tag, Button, App } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { CrudFilters } from '@refinedev/core'
import { dt } from '../../lib/format'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { DangerConfirm } from '../../components/DangerAction'
import { TerminalForm } from './TerminalForm'
import { action } from '../../api/actions'
import { TERMINAL_PROVIDERS, options } from '../../lib/apiEnums'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

const PROVIDERS = options(TERMINAL_PROVIDERS)

export const TerminalList = () => {
  const { message } = App.useApp()
  const [form, setForm] = useState<{ mode: 'create' | 'edit'; row?: any } | null>(null)
  const [removing, setRemoving] = useState<any>(null)

  const { tableProps, filters, setFilters, tableQuery } = useTable({
    resource: 'terminals',
    syncWithLocation: true,
    pagination: { pageSize: 50 },
  })

  const create = useMutation({
    mutationFn: (v: any) => action('/terminals', { body: v }),
    onSuccess: () => {
      setForm(null)
      message.success('Терминал назначен')
      tableQuery.refetch()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) =>
      action(`/terminals/${id}`, { method: 'PATCH', body: values }),
    onSuccess: () => {
      setForm(null)
      message.success('Сохранено')
      tableQuery.refetch()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => action(`/terminals/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setRemoving(null)
      message.success('Терминал удалён')
      tableQuery.refetch()
    },
    onError: (e: Error) => {
      setRemoving(null)
      message.error(e.message)
    },
  })

  const valueOf = (field: string) =>
    (filters as CrudFilters)?.find((f) => 'field' in f && f.field === field)?.value

  const apply = (field: string, value: unknown) =>
    setFilters([{ field, operator: 'eq', value }], 'merge')

  const { onRow, menu } = useRowMenu<any>((r) => [
    { key: 'edit', label: 'Изменить', onClick: () => setForm({ mode: 'edit', row: r }) },
    { key: 'del', label: 'Удалить', danger: true, onClick: () => setRemoving(r) },
    { type: 'divider' },
    r.partnerId && {
      key: 'partner',
      label: `Терминалы партнёра «${r.partnerName ?? r.partner?.name ?? ''}»`,
      onClick: () => apply('partnerId', r.partnerId),
    },
    r.provider && {
      key: 'prov',
      label: `Отобрать ${r.provider}`,
      onClick: () => apply('provider', r.provider),
    },
    r.config?.tspId != null && {
      key: 'tsp',
      label: `Копировать tspId (${r.config.tspId})`,
      onClick: () => navigator.clipboard.writeText(String(r.config.tspId)),
    },
  ])

  return (
    <List
      title="Терминалы"
      headerButtons={
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setForm({ mode: 'create' })}
        >
          Назначить терминал
        </Button>
      }
    >
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap align="end" size={12}>
          <Field label="Партнёр">
            <PartnerSelect
              value={valueOf('partnerId') as string}
              onChange={(v) => apply('partnerId', v)}
            />
          </Field>
          <Field label="Провайдер">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 160 }}
              options={PROVIDERS}
              value={valueOf('provider') as string}
              onChange={(v) => apply('provider', v)}
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

      <Table {...tableProps} rowKey="id" size="small" scroll={{ x: 1000 }} onRow={onRow}>
        <Table.Column
          dataIndex="provider"
          title="Провайдер"
          width={110}
          render={(v: string) => <Tag>{v}</Tag>}
        />
        <Table.Column
          dataIndex="merchantId"
          title="Merchant ID"
          width={160}
          render={(v: string) => <Text copyable={!!v}>{v ?? '—'}</Text>}
        />
        <Table.Column
          dataIndex="partnerName"
          title="Партнёр"
          width={200}
          render={(v: string, r: any) => v ?? r.partner?.name ?? r.partnerId ?? '—'}
        />
        {/* У KANYON в config лежит tspId — он же код терминала на стороне провайдера. */}
        <Table.Column
          title="tspId / config"
          width={170}
          render={(_: unknown, r: any) => {
            const cfg = r.config ?? {}
            if (cfg.tspId != null) {
              return (
                <Space size={4}>
                  <Text code>{cfg.tspId}</Text>
                  {cfg.mode && <Tag color="blue">{cfg.mode}</Tag>}
                </Space>
              )
            }
            const keys = Object.keys(cfg)
            return keys.length ? <Text type="secondary">{keys.join(', ')}</Text> : '—'
          }}
        />
        <Table.Column
          title="Состояние"
          width={170}
          render={(_: unknown, r: any) => (
            <Space size={4} wrap>
              {r.isDefault && <Tag color="gold">по умолчанию</Tag>}
              <Tag color={r.isActive ? 'success' : 'default'}>
                {r.isActive ? 'активен' : 'выключен'}
              </Tag>
            </Space>
          )}
        />
        <Table.Column dataIndex="priority" title="Приоритет" width={100} align="right" />
        <Table.Column
          dataIndex="userEmail"
          title="Пользователь"
          width={200}
          render={(v: string, r: any) => v ?? r.user?.email ?? '—'}
        />
        <Table.Column dataIndex="createdAt" title="Создан" width={150} render={(v: string) => dt(v)} />
        <Table.Column
          title="Действия"
          width={90}
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
                danger
                type="text"
                icon={<DeleteOutlined />}
                title="Удалить"
                onClick={() => setRemoving(r)}
              />
            </Space>
          )}
        />
      </Table>

      <TerminalForm
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
        open={!!removing}
        title="Удалить терминал?"
        what={
          removing?.isDefault
            ? `Это терминал по умолчанию для «${removing?.partnerName ?? removing?.partner?.name}». После удаления роль перейдёт к следующему по приоритету, а если других терминалов нет — партнёр останется без рабочего провайдера и его платежи перестанут проходить.`
            : `Терминал ${removing?.provider} у «${removing?.partnerName ?? removing?.partner?.name}» будет удалён. Платежи через него перестанут идти.`
        }
        confirmWord={removing?.isDefault ? 'УДАЛИТЬ' : undefined}
        okText="Удалить"
        loading={remove.isPending}
        onOk={() => remove.mutate(removing.id)}
        onCancel={() => setRemoving(null)}
      />
    </List>
  )
}
