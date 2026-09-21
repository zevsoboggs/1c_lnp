import { useMemo, useState } from 'react'
import { List } from '@refinedev/antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App, Button, Card, Descriptions, Form, Input, InputNumber,
  Segmented, Space, Table, Tag, Typography,
} from 'antd'
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons'
import { agentsApi, type Agent, type AgentApplication } from '../../api/agents'
import { Toolbar } from '../../components/Toolbar'
import { DataTable } from '../../components/DataTable'
import { SecretOnce } from '../../components/SecretOnce'
import { DangerConfirm } from '../../components/DangerAction'
import { dt, money } from '../../lib/format'

const { Text } = Typography

const STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'На рассмотрении', color: 'gold' },
  APPROVED: { label: 'Одобрена', color: 'green' },
  REJECTED: { label: 'Отклонена', color: 'red' },
  CANCELLED: { label: 'Отменена', color: 'default' },
}

/**
 * Агенты платформы и их заявки.
 *
 * Агент — внешний человек, приводящий бизнесы. Одобрение заявки не меняет
 * признак, а открывает бизнес: платформа заводит партнёра с привязкой к агенту
 * и его ставкой, при необходимости создаёт вход в кабинет и выдаёт ключ API.
 * Ключ показывается один раз — поэтому после одобрения он выводится отдельно.
 */
export const AgentsPage = () => {
  const { message } = App.useApp()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'agents' | 'applications'>('applications')
  const [status, setStatus] = useState('PENDING')

  const agents = useQuery({ queryKey: ['agents'], queryFn: () => agentsApi.list() })
  const applications = useQuery({
    queryKey: ['agent-applications', status],
    queryFn: () => agentsApi.applications(status),
  })

  const [approving, setApproving] = useState<AgentApplication | null>(null)
  const [rejecting, setRejecting] = useState<AgentApplication | null>(null)
  const [issued, setIssued] = useState<{ partnerId: string; apiKey: string; name: string } | null>(null)
  const [form] = Form.useForm()

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['agent-applications'] })
    void qc.invalidateQueries({ queryKey: ['agents'] })
  }

  const approve = useMutation({
    mutationFn: (values: Record<string, unknown>) => agentsApi.approve(approving!.id, values),
    onSuccess: (r) => {
      setApproving(null)
      // Ключ API отдаётся один раз: показываем его сразу и отдельно.
      setIssued({ partnerId: r.partner.partnerId, apiKey: r.apiKey, name: r.partner.name })
      message.success(`Партнёр ${r.partner.partnerId} создан`)
      refresh()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const reject = useMutation({
    mutationFn: (reason: string) => agentsApi.reject(rejecting!.id, reason),
    onSuccess: () => {
      setRejecting(null)
      message.success('Заявка отклонена')
      refresh()
    },
    onError: (e: Error) => {
      setRejecting(null)
      message.error(e.message)
    },
  })

  const pending = useMemo(
    () => (applications.data?.applications ?? []).filter((a) => a.status === 'PENDING').length,
    [applications.data],
  )

  return (
    <List title="Агенты" headerButtons={<Button size="small" icon={<ReloadOutlined />} onClick={refresh}>Обновить</Button>}>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          options={[
            { value: 'applications', label: `Заявки${pending ? ` (${pending})` : ''}` },
            { value: 'agents', label: `Агенты (${agents.data?.total ?? 0})` },
          ]}
        />
      </Card>

      {/* Ключ API отдаётся один раз: закрыли окно — только перевыпуск. */}
      <SecretOnce
        open={!!issued}
        title={issued ? `Бизнес «${issued.name}» подключён — ${issued.partnerId}` : ''}
        secret={issued?.apiKey ?? null}
        hint="Ключ API показывается один раз. Передайте его партнёру."
        onClose={() => setIssued(null)}
      />

      {tab === 'applications' ? (
        <>
          <Card size="small" style={{ marginBottom: 12 }}>
            <Segmented
              value={status}
              onChange={(v) => setStatus(String(v))}
              options={[
                { value: 'PENDING', label: 'На рассмотрении' },
                { value: 'APPROVED', label: 'Одобренные' },
                { value: 'REJECTED', label: 'Отклонённые' },
                { value: 'all', label: 'Все' },
              ]}
            />
          </Card>

          <Toolbar total={applications.data?.total} loading={applications.isFetching} onRefresh={refresh} />

          <DataTable
            dataSource={applications.data?.applications ?? []}
            loading={applications.isLoading}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 1100 }}
            expandable={{
              expandedRowRender: (r: AgentApplication) => <ApplicationDetails application={r} />,
            }}
          >
            <Table.Column
              dataIndex="status"
              title="Статус"
              width={140}
              render={(v: string) => <Tag color={STATUS[v]?.color}>{STATUS[v]?.label ?? v}</Tag>}
            />
            <Table.Column dataIndex="companyName" title="Компания" width={200} />
            <Table.Column dataIndex="contactName" title="Контакт" width={160} />
            <Table.Column
              title="Агент"
              width={200}
              render={(_: unknown, r: AgentApplication) => r.agent?.email ?? '—'}
            />
            <Table.Column
              dataIndex="proposedAgentCommission"
              title="Ставка, %"
              width={100}
              align="right"
              render={(v: number | null) => (v === null ? '—' : v)}
            />
            <Table.Column dataIndex="createdAt" title="Подана" width={150} render={(v: string) => dt(v)} />
            <Table.Column
              title="Решение"
              width={150}
              fixed="right"
              render={(_: unknown, r: AgentApplication) =>
                r.status === 'PENDING' ? (
                  <Space size={4}>
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={() => {
                        form.resetFields()
                        form.setFieldsValue({ agentCommissionPercent: r.proposedAgentCommission ?? 0 })
                        setApproving(r)
                      }}
                    >
                      Одобрить
                    </Button>
                    <Button size="small" danger icon={<CloseOutlined />} onClick={() => setRejecting(r)} />
                  </Space>
                ) : (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {r.reviewedAt ? dt(r.reviewedAt) : '—'}
                  </Text>
                )
              }
            />
          </DataTable>
        </>
      ) : (
        <>
          <Toolbar total={agents.data?.total} loading={agents.isFetching} onRefresh={refresh} />
          <DataTable
            dataSource={agents.data?.agents ?? []}
            loading={agents.isLoading}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 900 }}
          >
            <Table.Column dataIndex="email" title="Почта" width={240} render={(v: string) => <Text copyable>{v}</Text>} />
            <Table.Column dataIndex="name" title="Имя" width={160} render={(v: string | null) => v ?? '—'} />
            <Table.Column
              title="Обучение"
              width={130}
              render={(_: unknown, r: Agent) =>
                r.testPassedAt ? <Tag color="green">сдан</Tag> : <Tag color="gold">не сдан</Tag>
              }
            />
            <Table.Column dataIndex="partnersCount" title="Бизнесов" width={100} align="right" />
            <Table.Column dataIndex="partnersActive" title="Из них работают" width={110} align="right" />
            <Table.Column dataIndex="applications" title="Заявок" width={90} align="right" />
            <Table.Column
              title="Вознаграждение"
              width={150}
              align="right"
              render={(_: unknown, r: Agent) => money((r.totals?.commissionEarned ?? 0) / 100)}
            />
            <Table.Column
              title="Оборот бизнесов"
              width={160}
              align="right"
              render={(_: unknown, r: Agent) => money((r.totals?.net ?? 0) / 100)}
            />
            <Table.Column
              dataIndex="isActive"
              title="Состояние"
              width={110}
              render={(v: boolean) => <Tag color={v ? 'success' : 'default'}>{v ? 'активен' : 'выключен'}</Tag>}
            />
          </DataTable>
        </>
      )}

      <ApproveModal
        application={approving}
        form={form}
        loading={approve.isPending}
        onCancel={() => setApproving(null)}
        onOk={(v) => approve.mutate(v)}
      />

      <DangerConfirm
        open={!!rejecting}
        title="Отклонить заявку?"
        what={`Заявка «${rejecting?.companyName ?? ''}» будет отклонена. Агент увидит причину в своём кабинете.`}
        okText="Отклонить"
        loading={reject.isPending}
        onOk={() => reject.mutate('Отклонено оператором')}
        onCancel={() => setRejecting(null)}
      />
    </List>
  )
}

function ApplicationDetails({ application }: { application: AgentApplication }) {
  return (
    <Descriptions size="small" column={2} bordered>
      <Descriptions.Item label="Почта">{application.email}</Descriptions.Item>
      <Descriptions.Item label="Телефон">{application.phone}</Descriptions.Item>
      <Descriptions.Item label="Сайт">{application.website ?? '—'}</Descriptions.Item>
      <Descriptions.Item label="Вид деятельности">{application.businessType ?? '—'}</Descriptions.Item>
      <Descriptions.Item label="Ожидаемый оборот">{application.expectedMonthlyVolume ?? '—'}</Descriptions.Item>
      <Descriptions.Item label="Рассмотрел">{application.reviewedBy?.email ?? '—'}</Descriptions.Item>
      <Descriptions.Item label="О бизнесе" span={2}>{application.description ?? '—'}</Descriptions.Item>
      {application.rejectionReason && (
        <Descriptions.Item label="Причина отказа" span={2}>{application.rejectionReason}</Descriptions.Item>
      )}
      {application.createdPartner && (
        <Descriptions.Item label="Создан партнёр" span={2}>
          {application.createdPartner.name} · {application.createdPartner.partnerId}
        </Descriptions.Item>
      )}
    </Descriptions>
  )
}

function ApproveModal({
  application, form, loading, onOk, onCancel,
}: {
  application: AgentApplication | null
  form: any
  loading: boolean
  onOk: (values: Record<string, unknown>) => void
  onCancel: () => void
}) {
  if (!application) return null

  return (
    <DangerConfirm
      open
      title={`Одобрить заявку «${application.companyName}»?`}
      what="Будет создан партнёр с привязкой к агенту и его ставкой. Ключ API показывается один раз."
      okText="Одобрить и создать партнёра"
      loading={loading}
      onOk={async () => onOk(await form.validateFields())}
      onCancel={onCancel}
    >
      <Form form={form} layout="vertical" size="small">
        <Form.Item
          name="agentCommissionPercent"
          label="Ставка агента, %"
          extra="По умолчанию — предложенная агентом"
        >
          <InputNumber style={{ width: '100%' }} min={0} max={100} step={0.1} />
        </Form.Item>
        <Form.Item name="userEmail" label="Почта для входа в кабинет" extra="Пусто — вход не создаётся">
          <Input placeholder="owner@example.com" />
        </Form.Item>
        <Form.Item name="userPassword" label="Пароль" extra="Не короче 8 символов">
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item name="notes" label="Примечание к решению">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </DangerConfirm>
  )
}
