import { useState } from 'react'
import { useCustom } from '@refinedev/core'
import { useMutation } from '@tanstack/react-query'
import { useSelect } from '@refinedev/antd'
import { Card, Table, Typography, Button, App, Modal, Form, Select, InputNumber, Input, Alert } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { dt } from '../../lib/format'
import { Toolbar } from '../../components/Toolbar'
import { DangerConfirm } from '../../components/DangerAction'
import { action } from '../../api/actions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

type Row = {
  id: string
  ancestorUserId: string
  branchRootUserId: string
  markup: number
  note: string | null
  createdAt: string
  ancestor: { id: string; name: string; email: string }
  branchRoot: { id: string; name: string; email: string }
}

export const ReferralOverrideList = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const [removing, setRemoving] = useState<Row | null>(null)

  const { query, result } = useCustom<{ overrides: Row[] }>({
    url: '/referral-overrides',
    method: 'get',
  })
  const rows = result.data?.overrides ?? []

  const { selectProps } = useSelect({
    resource: 'users',
    optionLabel: 'email',
    optionValue: 'id',
    pagination: { pageSize: 300 },
  })

  const create = useMutation({
    mutationFn: (v: any) => action('/referral-overrides', { body: v }),
    onSuccess: () => {
      setOpen(false)
      form.resetFields()
      message.success('Наценка сохранена')
      query.refetch()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const remove = useMutation({
    mutationFn: (id: string) => action(`/referral-overrides/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setRemoving(null)
      message.success('Наценка удалена')
      query.refetch()
    },
    onError: (e: Error) => {
      setRemoving(null)
      message.error(e.message)
    },
  })

  const userSelect = {
    ...(selectProps as any),
    showSearch: true,
    filterOption: (i: string, o: any) =>
      String(o?.label ?? '').toLowerCase().includes(i.toLowerCase()),
  }

  const { onRow, menu } = useRowMenu<Row>((r) => [
    { key: 'del', label: 'Удалить', danger: true, onClick: () => setRemoving(r) },
    { type: 'divider' },
    r.ancestor?.email && {
      key: 'a',
      label: `Копировать email «${r.ancestor.name}»`,
      onClick: () => navigator.clipboard.writeText(r.ancestor.email),
    },
    r.branchRoot?.email && {
      key: 'b',
      label: `Копировать email «${r.branchRoot.name}»`,
      onClick: () => navigator.clipboard.writeText(r.branchRoot.email),
    },
  ])

  return (
    <Card
      title="Реферальные наценки по веткам"
      size="small"
      extra={
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          Добавить
        </Button>
      }
    >
      <Toolbar total={rows.length} loading={query.isFetching} onRefresh={() => query.refetch()} />
      {menu}

      <Table
        dataSource={rows}
        loading={query.isFetching}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 900 }}
        onRow={onRow}
      >
        <Table.Column
          title="Кому начисляется"
          width={220}
          render={(_: unknown, r: Row) => (
            <div>
              <Text strong>{r.ancestor?.name ?? '—'}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {r.ancestor?.email}
              </Text>
            </div>
          )}
        />
        <Table.Column
          title="За ветку"
          width={220}
          render={(_: unknown, r: Row) => (
            <div>
              <Text strong>{r.branchRoot?.name ?? '—'}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {r.branchRoot?.email}
              </Text>
            </div>
          )}
        />
        <Table.Column
          dataIndex="markup"
          title="Наценка"
          width={110}
          align="right"
          render={(v: number) => (
            <Text strong style={{ color: '#0D5AA7' }}>
              {v}%
            </Text>
          )}
        />
        <Table.Column dataIndex="note" title="Примечание" ellipsis render={(v: string) => v ?? '—'} />
        <Table.Column dataIndex="createdAt" title="Создана" width={140} render={(v: string) => dt(v)} />
        <Table.Column
          title=""
          width={50}
          render={(_: unknown, r: Row) => (
            <Button
              size="small"
              danger
              type="text"
              icon={<DeleteOutlined />}
              onClick={() => setRemoving(r)}
            />
          )}
        />
      </Table>

      <Modal
        open={open}
        title="Реферальная наценка по ветке"
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={create.isPending}
        onOk={async () => create.mutate(await form.validateFields())}
        onCancel={() => setOpen(false)}
        width={560}
        destroyOnHidden
      >
        {/* POST — это upsert по паре (ancestor, branchRoot): повтор не создаст дубль. */}
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Пара «кому» + «за ветку» уникальна: повторное сохранение обновит существующую наценку, а не создаст вторую."
        />
        <Form form={form} layout="vertical" size="small">
          <Form.Item
            name="ancestorUserId"
            label="Кому начисляется"
            rules={[{ required: true, message: 'Обязательно' }]}
          >
            <Select {...userSelect} placeholder="Пользователь-получатель" />
          </Form.Item>
          <Form.Item
            name="branchRootUserId"
            label="За ветку (корень)"
            rules={[{ required: true, message: 'Обязательно' }]}
          >
            <Select {...userSelect} placeholder="Пользователь — корень ветки" />
          </Form.Item>
          <Form.Item
            name="markup"
            label="Наценка, %"
            rules={[{ required: true, message: 'Обязательно' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.1} precision={2} />
          </Form.Item>
          <Form.Item name="note" label="Примечание">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <DangerConfirm
        open={!!removing}
        title="Удалить реферальную наценку?"
        what={`«${removing?.ancestor?.name}» перестанет получать ${removing?.markup}% с ветки «${removing?.branchRoot?.name}».`}
        okText="Удалить"
        loading={remove.isPending}
        onOk={() => remove.mutate(removing!.id)}
        onCancel={() => setRemoving(null)}
      />
    </Card>
  )
}
