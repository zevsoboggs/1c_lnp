import { useState, useMemo } from 'react'
import { useCustom } from '@refinedev/core'
import { useMutation } from '@tanstack/react-query'
import {
  Card,
  Table,
  Space,
  Input,
  Typography,
  Button,
  App,
  Tag,
  Statistic,
  Divider,
  Modal,
  Form,
  Select,
  InputNumber,
  Switch,
  DatePicker,
  Alert,
  Progress,
} from 'antd'
import { EditOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { dt } from '../../lib/format'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { action } from '../../api/actions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

const PLANS = [
  { value: 'FREE_TRIAL', label: 'Пробный' },
  { value: 'MONTHLY', label: 'Месяц' },
  { value: 'QUARTERLY', label: 'Квартал' },
  { value: 'SEMI_ANNUAL', label: 'Полгода' },
  { value: 'ANNUAL', label: 'Год' },
]

const planLabel = (v: string) => PLANS.find((p) => p.value === v)?.label ?? v

type Row = {
  id: string
  partnerId: string
  name: string
  email: string
  kycEnabled: boolean
  kycRequired: boolean
  kycPlan: string | null
  kycPlanExpiresAt: string | null
  kycVerificationsUsed: number
  kycVerificationsLimit: number | null
  kycValidityDays: number | null
  isActive: boolean
  isExpired: boolean | null
  isLimitReached: boolean
  expiringIn7Days: boolean
  totalVerifications: number
}

export const KycBillingList = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Row | null>(null)

  const { query, result } = useCustom<{ partners: Row[]; stats: any }>({
    url: '/kyc-billing',
    method: 'get',
  })
  const all = result.data?.partners ?? []
  const s = result.data?.stats

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.partnerId?.toLowerCase().includes(q),
    )
  }, [all, search])

  const save = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      return action('/kyc-billing', {
        method: 'PATCH',
        body: {
          // partnerId здесь — UUID партнёра, а не его человекочитаемый код.
          partnerId: editing!.id,
          confirmCode: v.confirmCode,
          kycEnabled: v.kycEnabled,
          kycRequired: v.kycRequired,
          kycPlan: v.kycPlan,
          // Числовые поля обязаны уйти числами — строку API молча отбросит.
          kycVerificationsLimit:
            v.kycVerificationsLimit != null ? Number(v.kycVerificationsLimit) : undefined,
          kycVerificationsUsed:
            v.kycVerificationsUsed != null ? Number(v.kycVerificationsUsed) : undefined,
          kycValidityDays: v.kycValidityDays != null ? Number(v.kycValidityDays) : undefined,
          kycPlanExpiresAt: v.kycPlanExpiresAt ? v.kycPlanExpiresAt.toISOString() : null,
        },
      })
    },
    onSuccess: () => {
      setEditing(null)
      form.resetFields()
      message.success('Тариф сохранён')
      query.refetch()
    },
    onError: (e: any) =>
      message.error(
        e.code === 'CONFIRM_CODE_INVALID' ? 'Неверный код подтверждения' : e.message,
        6,
      ),
  })

  const open = (r: Row) => {
    setEditing(r)
    form.setFieldsValue({
      kycEnabled: r.kycEnabled,
      kycRequired: r.kycRequired,
      kycPlan: r.kycPlan ?? undefined,
      kycVerificationsLimit: r.kycVerificationsLimit,
      kycVerificationsUsed: r.kycVerificationsUsed,
      kycValidityDays: r.kycValidityDays,
      kycPlanExpiresAt: r.kycPlanExpiresAt ? dayjs(r.kycPlanExpiresAt) : null,
      confirmCode: '',
    })
  }

  const { onRow, menu } = useRowMenu<Row>((r) => [
    { key: 'edit', label: 'Изменить тариф', onClick: () => open(r) },
    { type: 'divider' },
    r.partnerId && {
      key: 'code',
      label: 'Копировать код партнёра',
      onClick: () => navigator.clipboard.writeText(r.partnerId),
    },
    r.email && {
      key: 'mail',
      label: 'Копировать email',
      onClick: () => navigator.clipboard.writeText(r.email),
    },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}
      <Card title="Биллинг KYC" size="small">
        <Space size={28} wrap>
          <Statistic title="Партнёров с KYC" value={s?.totalPartners ?? 0} loading={query.isFetching} />
          <Statistic title="Активных тарифов" value={s?.activePlans ?? 0} />
          <Statistic
            title="Истёкших"
            value={s?.expiredPlans ?? 0}
            valueStyle={{ color: s?.expiredPlans ? '#cf1322' : undefined }}
          />
          <Statistic
            title="Истекают за 7 дней"
            value={s?.expiringIn7Days ?? 0}
            valueStyle={{ color: s?.expiringIn7Days ? '#d46b08' : undefined }}
          />
          <Statistic title="Пробных" value={s?.freeTrial ?? 0} />
          <Statistic title="Месячных" value={s?.monthly ?? 0} />
          <Statistic title="Годовых" value={s?.annual ?? 0} />
          <Statistic title="Верификаций всего" value={s?.totalVerifications ?? 0} />
        </Space>
      </Card>

      <Card size="small">
        <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
          <Field label="Поиск">
            <Input.Search
              allowClear
              placeholder="Партнёр, email, код…"
              style={{ width: 280 }}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
        </Space>

        <Toolbar total={rows.length} loading={query.isFetching} onRefresh={() => query.refetch()} />

        <Table
          dataSource={rows}
          loading={query.isFetching}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 30 }}
          scroll={{ x: 1100 }}
          onRow={onRow}
        >
          <Table.Column
            dataIndex="name"
            title="Партнёр"
            width={190}
            fixed="left"
            render={(v: string) => <Text strong>{v}</Text>}
          />
          <Table.Column
            title="Состояние"
            width={190}
            render={(_: unknown, r: Row) => (
              <Space size={4} wrap>
                <Tag color={r.kycEnabled ? 'success' : 'default'}>
                  {r.kycEnabled ? 'включён' : 'выключен'}
                </Tag>
                {r.kycRequired && <Tag color="blue">обязателен</Tag>}
                {r.isExpired && <Tag color="error">истёк</Tag>}
                {r.expiringIn7Days && <Tag color="orange">истекает</Tag>}
                {r.isLimitReached && <Tag color="error">лимит</Tag>}
              </Space>
            )}
          />
          <Table.Column
            dataIndex="kycPlan"
            title="Тариф"
            width={110}
            render={(v: string) => (v ? <Tag>{planLabel(v)}</Tag> : '—')}
          />
          <Table.Column
            title="Использовано"
            width={170}
            render={(_: unknown, r: Row) => {
              if (r.kycVerificationsLimit == null) return `${r.kycVerificationsUsed} / ∞`
              const pct = Math.min(
                100,
                Math.round((r.kycVerificationsUsed / Math.max(1, r.kycVerificationsLimit)) * 100),
              )
              return (
                <Space direction="vertical" size={0} style={{ width: '100%' }}>
                  <Text style={{ fontSize: 12 }}>
                    {r.kycVerificationsUsed} / {r.kycVerificationsLimit}
                  </Text>
                  <Progress
                    percent={pct}
                    size="small"
                    showInfo={false}
                    status={pct >= 100 ? 'exception' : pct > 80 ? 'active' : 'normal'}
                  />
                </Space>
              )
            }}
          />
          <Table.Column
            dataIndex="kycPlanExpiresAt"
            title="Действует до"
            width={140}
            render={(v: string) => (v ? dt(v) : <Text type="secondary">бессрочно</Text>)}
          />
          <Table.Column
            dataIndex="kycValidityDays"
            title="Срок годности, дн"
            width={140}
            align="right"
            render={(v: number) => v ?? '—'}
          />
          <Table.Column
            dataIndex="totalVerifications"
            title="Верификаций"
            width={120}
            align="right"
            sorter={(a: Row, b: Row) => a.totalVerifications - b.totalVerifications}
          />
          <Table.Column
            title=""
            width={50}
            fixed="right"
            render={(_: unknown, r: Row) => (
              <Button size="small" icon={<EditOutlined />} title="Изменить тариф" onClick={() => open(r)} />
            )}
          />
        </Table>
      </Card>

      <Modal
        open={!!editing}
        title={`KYC-тариф: ${editing?.name ?? ''}`}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={save.isPending}
        onOk={() => save.mutate()}
        onCancel={() => {
          setEditing(null)
          form.resetFields()
        }}
        width={520}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item name="kycPlan" label="Тариф">
            <Select allowClear options={PLANS} />
          </Form.Item>
          <Form.Item name="kycPlanExpiresAt" label="Действует до" extra="Пусто — бессрочно">
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item name="kycVerificationsLimit" label="Лимит верификаций">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item
            name="kycVerificationsUsed"
            label="Использовано"
            extra="Правится вручную — например, чтобы обнулить счётчик при продлении."
          >
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="kycValidityDays" label="Срок годности верификации, дней">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="kycEnabled" label="KYC включён" valuePropName="checked">
            <Switch size="small" />
          </Form.Item>
          <Form.Item name="kycRequired" label="KYC обязателен" valuePropName="checked">
            <Switch size="small" />
          </Form.Item>

          <Divider style={{ margin: '8px 0' }} />
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 8 }}
            message="Изменение тарифа требует кода подтверждения — он задаётся на сервере в KYC_BILLING_CONFIRM_CODE."
          />
          <Form.Item
            name="confirmCode"
            label="Код подтверждения"
            rules={[{ required: true, message: 'Без кода API не примет изменение' }]}
          >
            <Input.Password autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
