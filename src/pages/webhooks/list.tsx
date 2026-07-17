import { useState } from 'react'
import { List, useTable } from '@refinedev/antd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Space, Card, Typography, Tag, Button, Popconfirm, App, Drawer } from 'antd'
import { SendOutlined, DeleteOutlined, HistoryOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons'
import type { CrudFilters } from '@refinedev/core'
import { dt } from '../../lib/format'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { SecretOnce } from '../../components/SecretOnce'
import { WebhookForm } from './WebhookForm'
import { action } from '../../api/actions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

type Delivery = {
  id: string
  event: string
  success: boolean
  statusCode: number | null
  error: string | null
  createdAt: string
}

export const WebhookList = () => {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [historyOf, setHistoryOf] = useState<{ id: string; url: string } | null>(null)
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [form, setForm] = useState<{ mode: 'create' | 'edit'; row?: any } | null>(null)
  const [secret, setSecret] = useState<string | null>(null)

  const { tableProps, filters, setFilters, tableQuery } = useTable({
    resource: 'webhooks',
    syncWithLocation: true,
    pagination: { pageSize: 50 },
  })

  const valueOf = (field: string) =>
    (filters as CrudFilters)?.find((f) => 'field' in f && f.field === field)?.value

  const create = useMutation({
    mutationFn: (v: any) => action<{ webhook: any }>('/webhooks', { body: v }),
    onSuccess: (r) => {
      setForm(null)
      tableQuery.refetch()
      if (r.webhook?.secret) setSecret(r.webhook.secret)
      else message.success('Вебхук создан')
    },
    onError: (e: Error) => message.error(e.message),
  })

  const update = useMutation({
    mutationFn: ({ id, values }: { id: string; values: any }) =>
      action(`/webhooks/${id}`, { method: 'PATCH', body: values }),
    onSuccess: () => {
      setForm(null)
      message.success('Сохранено')
      tableQuery.refetch()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const test = useMutation({
    mutationFn: (id: string) => action<{ result: any }>(`/webhooks/${id}/test`),
    onSuccess: (r) => {
      // Эндпоинт отвечает 200 даже когда доставка провалилась — разбираем result.
      const res = r.result ?? {}
      if (res.success) message.success(`Доставлено · HTTP ${res.status ?? 200}`)
      else message.error(`Не доставлено: ${res.error ?? `HTTP ${res.status}`}`, 8)
    },
    onError: (e: Error) => message.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => action(`/webhooks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      message.success('Вебхук удалён')
      tableQuery.refetch()
      qc.invalidateQueries({ queryKey: ['webhooks'] })
    },
    onError: (e: Error) => message.error(e.message),
  })

  const openHistory = async (r: any) => {
    setHistoryOf({ id: r.id, url: r.url })
    setLoadingHistory(true)
    try {
      const res = await action<{ deliveries: Delivery[] }>(`/webhooks/${r.id}/deliveries?limit=50`, {
        method: 'GET',
      })
      setDeliveries(res.deliveries ?? [])
    } catch (e: any) {
      message.error(e.message)
      setDeliveries([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const { onRow, menu } = useRowMenu<any>((r) => [
    { key: 'edit', label: 'Изменить', onClick: () => setForm({ mode: 'edit', row: r }) },
    { key: 'hist', label: 'История доставок', onClick: () => openHistory(r) },
    { key: 'test', label: 'Отправить тестовое событие', onClick: () => test.mutate(r.id) },
    { type: 'divider' },
    r.url && {
      key: 'url',
      label: 'Копировать URL',
      onClick: () => navigator.clipboard.writeText(r.url),
    },
    { key: 'del', label: 'Удалить', danger: true, onClick: () => remove.mutate(r.id) },
  ])

  return (
    <List
      title="Вебхуки"
      headerButtons={
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setForm({ mode: 'create' })}
        >
          Новый вебхук
        </Button>
      }
    >
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap align="end" size={12}>
          <Field label="Партнёр">
            <PartnerSelect
              value={valueOf('partnerId') as string}
              onChange={(v) => setFilters([{ field: 'partnerId', operator: 'eq', value: v }], 'merge')}
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
          dataIndex="url"
          title="URL"
          width={280}
          render={(v: string) => <Text copyable={!!v}>{v}</Text>}
        />
        <Table.Column
          dataIndex={['partner', 'name']}
          title="Партнёр"
          width={170}
          render={(v: string, r: any) => v ?? r.partnerId ?? '—'}
        />
        <Table.Column
          dataIndex="events"
          title="События"
          width={220}
          render={(v: string[]) =>
            Array.isArray(v) && v.length ? (
              <Space size={2} wrap>
                {v.map((e) => (
                  <Tag key={e} style={{ marginInlineEnd: 0 }}>
                    {e}
                  </Tag>
                ))}
              </Space>
            ) : (
              '—'
            )
          }
        />
        <Table.Column
          title="Статус"
          width={110}
          render={(_: unknown, r: any) => {
            const on = r.isActive ?? r.status === 'ACTIVE'
            return <Tag color={on ? 'success' : 'default'}>{on ? 'активен' : 'выключен'}</Tag>
          }}
        />
        <Table.Column dataIndex="createdAt" title="Создан" width={140} render={(v: string) => dt(v)} />
        <Table.Column
          title="Действия"
          width={180}
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
                icon={<HistoryOutlined />}
                title="История доставок"
                onClick={() => openHistory(r)}
              />
              <Popconfirm
                title="Отправить тестовое событие?"
                description={
                  <span style={{ maxWidth: 280, display: 'block' }}>
                    Реальный запрос уйдёт на {r.url}. Подпись у тестового события считается общим
                    ключом, а не секретом этого вебхука, — на стороне партнёра она не сойдётся.
                  </span>
                }
                okText="Отправить"
                cancelText="Отмена"
                onConfirm={() => test.mutate(r.id)}
              >
                <Button size="small" icon={<SendOutlined />} title="Тестовая отправка" />
              </Popconfirm>
              <Popconfirm
                title="Удалить вебхук?"
                description="Партнёр перестанет получать события."
                okText="Удалить"
                cancelText="Отмена"
                okButtonProps={{ danger: true }}
                onConfirm={() => remove.mutate(r.id)}
              >
                <Button size="small" danger type="text" icon={<DeleteOutlined />} />
              </Popconfirm>
            </Space>
          )}
        />
      </Table>

      <Drawer
        open={!!historyOf}
        onClose={() => setHistoryOf(null)}
        title="История доставок"
        width={720}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          {historyOf?.url}
        </Text>
        <Table
          dataSource={deliveries}
          loading={loadingHistory}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
        >
          <Table.Column dataIndex="createdAt" title="Когда" width={140} render={(v: string) => dt(v)} />
          <Table.Column dataIndex="event" title="Событие" width={150} />
          <Table.Column
            dataIndex="success"
            title="Итог"
            width={110}
            render={(v: boolean, r: Delivery) => (
              <Tag color={v ? 'success' : 'error'}>{v ? 'доставлен' : `ошибка ${r.statusCode ?? ''}`}</Tag>
            )}
          />
          <Table.Column
            dataIndex="error"
            title="Ошибка"
            ellipsis
            render={(v: string) => (v ? <Text type="danger">{v}</Text> : '—')}
          />
        </Table>
      </Drawer>

      <WebhookForm
        open={!!form}
        mode={form?.mode ?? 'create'}
        initial={form?.row}
        loading={create.isPending || update.isPending}
        onCancel={() => setForm(null)}
        onSubmit={(v) =>
          form?.mode === 'create' ? create.mutate(v) : update.mutate({ id: form!.row.id, values: v })
        }
      />

      <SecretOnce
        open={!!secret}
        title="Вебхук создан — секрет подписи"
        secret={secret}
        hint="Передайте его партнёру: этим ключом подписываются события. Показывается один раз, перевыпуска в API нет — только пересоздать вебхук."
        onClose={() => setSecret(null)}
      />
    </List>
  )
}
