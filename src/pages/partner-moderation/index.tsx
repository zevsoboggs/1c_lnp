import { useState } from 'react'
import { useCustom } from '@refinedev/core'
import { useMutation } from '@tanstack/react-query'
import {
  Card,
  Table,
  Space,
  Typography,
  Tag,
  Select,
  Button,
  App,
  Modal,
  Form,
  InputNumber,
  Input,
  Alert,
  Descriptions,
  Switch,
} from 'antd'
import { CheckOutlined, CloseOutlined } from '@ant-design/icons'
import { dt } from '../../lib/format'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { DangerConfirm } from '../../components/DangerAction'
import { TERMINAL_PROVIDERS, options } from '../../lib/apiEnums'
import { action } from '../../api/actions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

type Row = {
  id: string
  partnerId: string
  name: string
  email: string
  phone: string | null
  moderationStatus: string
  platformCommission: number | null
  createdAt: string
  rejectionReason: string | null
  parentPartner: { id: string; name: string; partnerId: string } | null
  users: Array<{ name: string; email: string; createdBy?: { name: string; email: string } }>
  providers: any[]
  _count: { invoices: number }
}

const MOD: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'На модерации', color: 'processing' },
  APPROVED: { label: 'Одобрен', color: 'success' },
  REJECTED: { label: 'Отклонён', color: 'error' },
}

export const PartnerModerationPage = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [status, setStatus] = useState('pending')
  const [activating, setActivating] = useState<Row | null>(null)
  const [rejecting, setRejecting] = useState<Row | null>(null)
  const [reason, setReason] = useState('')
  const [provider, setProvider] = useState('KANYON')
  const [direct, setDirect] = useState(true)

  const { query, result } = useCustom<{ partners: Row[]; count: number }>({
    url: '/partner-moderation',
    method: 'get',
    config: { query: { status } },
  })

  const rows = result.data?.partners ?? []

  const activate = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      const kanyonDirect = provider === 'KANYON' && direct
      return action(`/partner-moderation/${activating!.id}/activate`, {
        body: {
          provider,
          merchantId: v.merchantId,
          platformCommission: Number(v.platformCommission),
          // KANYON принимается только прямым API — с числовым tspId.
          ...(kanyonDirect ? { config: { mode: 'direct', tspId: Number(v.tspId) } } : {}),
        },
      })
    },
    onSuccess: () => {
      setActivating(null)
      form.resetFields()
      message.success('Партнёр активирован')
      query.refetch()
    },
    onError: (e: Error) => message.error(e.message, 8),
  })

  const reject = useMutation({
    mutationFn: () =>
      action(`/partner-moderation/${rejecting!.id}/activate`, {
        body: { action: 'reject', rejectionReason: reason || undefined },
      }),
    onSuccess: () => {
      setRejecting(null)
      setReason('')
      message.success('Партнёр отклонён')
      query.refetch()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const kanyonDirect = provider === 'KANYON' && direct

  const { onRow, menu } = useRowMenu<Row>((r) => [
    r.moderationStatus === 'PENDING' && {
      key: 'act',
      label: 'Активировать',
      onClick: () => {
        setActivating(r)
        setProvider('KANYON')
        setDirect(true)
        form.setFieldsValue({ platformCommission: r.platformCommission ?? 0 })
      },
    },
    r.moderationStatus === 'PENDING' && {
      key: 'rej',
      label: 'Отклонить',
      danger: true,
      onClick: () => setRejecting(r),
    },
    r.moderationStatus === 'PENDING' && { type: 'divider' },
    r.email && {
      key: 'mail',
      label: 'Копировать email',
      onClick: () => navigator.clipboard.writeText(r.email),
    },
    r.partnerId && {
      key: 'code',
      label: 'Копировать код партнёра',
      onClick: () => navigator.clipboard.writeText(r.partnerId),
    },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}
      <Card title="Модерация подпартнёров" size="small">
        <Space wrap align="end" size={12}>
          <Field label="Показывать">
            <Select
              style={{ width: 200 }}
              value={status}
              onChange={setStatus}
              options={[
                { value: 'pending', label: 'На модерации' },
                { value: 'rejected', label: 'Отклонённые' },
                { value: 'all', label: 'Все' },
              ]}
            />
          </Field>
        </Space>
      </Card>

      <Card size="small">
        <Toolbar total={result.data?.count} loading={query.isFetching} onRefresh={() => query.refetch()} />

        <Table
          dataSource={rows}
          loading={query.isFetching}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1150 }}
          onRow={onRow}
        >
          <Table.Column
            dataIndex="name"
            title="Партнёр"
            width={170}
            fixed="left"
            render={(v: string) => <Text strong>{v}</Text>}
          />
          <Table.Column
            dataIndex="moderationStatus"
            title="Статус"
            width={140}
            render={(v: string) => <Tag color={MOD[v]?.color}>{MOD[v]?.label ?? v}</Tag>}
          />
          <Table.Column
            dataIndex={['parentPartner', 'name']}
            title="Родитель"
            width={160}
            render={(v: string) => v ?? <Text type="secondary">корневой</Text>}
          />
          <Table.Column dataIndex="email" title="Email" width={210} />
          <Table.Column
            title="Кто пригласил"
            width={180}
            render={(_: unknown, r: Row) => {
              const by = r.users?.[0]?.createdBy
              return by ? (
                <Space direction="vertical" size={0}>
                  <Text style={{ fontSize: 12 }}>{by.name}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {by.email}
                  </Text>
                </Space>
              ) : (
                '—'
              )
            }}
          />
          <Table.Column
            title="Терминалы"
            width={110}
            render={(_: unknown, r: Row) =>
              r.providers?.length ? <Tag color="blue">{r.providers.length}</Tag> : <Tag>нет</Tag>
            }
          />
          <Table.Column
            title="Счетов"
            width={90}
            align="right"
            render={(_: unknown, r: Row) => r._count?.invoices ?? 0}
          />
          <Table.Column dataIndex="createdAt" title="Заявка" width={140} render={(v: string) => dt(v)} />
          <Table.Column
            dataIndex="rejectionReason"
            title="Причина отказа"
            ellipsis
            render={(v: string) => (v ? <Text type="danger">{v}</Text> : '—')}
          />
          <Table.Column
            title="Действия"
            width={110}
            fixed="right"
            render={(_: unknown, r: Row) =>
              r.moderationStatus === 'PENDING' ? (
                <Space size={4}>
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckOutlined />}
                    title="Активировать"
                    onClick={() => {
                      setActivating(r)
                      setProvider('KANYON')
                      setDirect(true)
                      form.setFieldsValue({
                        platformCommission: r.platformCommission ?? 0,
                        merchantId: undefined,
                        tspId: undefined,
                      })
                    }}
                  />
                  <Button
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    title="Отклонить"
                    onClick={() => setRejecting(r)}
                  />
                </Space>
              ) : (
                <Text type="secondary">—</Text>
              )
            }
          />
        </Table>
      </Card>

      <Modal
        open={!!activating}
        title={`Активировать: ${activating?.name ?? ''}`}
        okText="Активировать"
        cancelText="Отмена"
        confirmLoading={activate.isPending}
        onOk={() => activate.mutate()}
        onCancel={() => {
          setActivating(null)
          form.resetFields()
        }}
        width={560}
        destroyOnHidden
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Descriptions
            size="small"
            column={1}
            bordered
            items={[
              { key: 'p', label: 'Родитель', children: activating?.parentPartner?.name ?? 'корневой' },
              { key: 'e', label: 'Email', children: activating?.email ?? '—' },
              {
                key: 'i',
                label: 'Пригласил',
                children: activating?.users?.[0]?.createdBy?.name ?? '—',
              },
            ]}
          />

          <Alert
            type="info"
            showIcon
            message="Партнёру назначается терминал и комиссия — после этого он сможет принимать платежи."
          />

          <Form form={form} layout="vertical" size="small">
            <Form.Item label="Провайдер" required>
              <Select value={provider} onChange={setProvider} options={options(TERMINAL_PROVIDERS)} />
            </Form.Item>

            {provider === 'KANYON' && (
              <Form.Item label="Режим KANYON">
                <Switch size="small" checked={direct} onChange={setDirect} style={{ marginRight: 8 }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  прямой API — для KANYON поддерживается только он
                </Text>
              </Form.Item>
            )}

            {kanyonDirect && (
              <Form.Item
                name="tspId"
                label="config.tspId"
                rules={[
                  { required: true, message: 'Для прямого KANYON нужен tspId' },
                  {
                    validator: (_, v) =>
                      v == null || Number(v) > 0
                        ? Promise.resolve()
                        : Promise.reject(new Error('tspId должен быть числом больше нуля')),
                  },
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            )}

            <Form.Item
              name="merchantId"
              label={kanyonDirect ? 'Имя терминала (merchantId)' : 'Merchant ID'}
              rules={[{ required: kanyonDirect, message: 'Для KANYON имя терминала обязательно' }]}
            >
              <Input />
            </Form.Item>

            <Form.Item
              name="platformCommission"
              label="Комиссия платформы, %"
              rules={[{ required: true, message: 'Обязательно' }]}
            >
              <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.1} precision={2} />
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      <DangerConfirm
        open={!!rejecting}
        title="Отклонить партнёра?"
        what={`«${rejecting?.name}» не сможет принимать платежи. Заявку подал ${rejecting?.users?.[0]?.createdBy?.name ?? 'неизвестно кто'}.`}
        okText="Отклонить"
        loading={reject.isPending}
        onOk={() => reject.mutate()}
        onCancel={() => {
          setRejecting(null)
          setReason('')
        }}
      >
        <div>
          <Text style={{ display: 'block', marginBottom: 4 }}>Причина отказа</Text>
          <Input.TextArea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </DangerConfirm>
    </Space>
  )
}
