import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Card,
  Table,
  Space,
  Typography,
  Tag,
  Button,
  App,
  Modal,
  Form,
  InputNumber,
  Switch,
  Alert,
} from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { Toolbar } from '../../components/Toolbar'
import { DangerConfirm } from '../../components/DangerAction'
import { salaryApi, type Rate } from '../../api/salary'
import { canWrite } from '../../api/accessControl'

const { Text } = Typography

export const SalaryRates = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<Rate | null>(null)
  const editable = canWrite('salary-rates')

  const q = useQuery({ queryKey: ['salary-rates'], queryFn: salaryApi.rates })
  const rates = q.data?.rates ?? []

  const create = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      return salaryApi.createRate(v.percent)
    },
    onSuccess: () => {
      setAdding(false)
      form.resetFields()
      message.success('Ставка добавлена')
      q.refetch()
    },
    onError: (e: Error) => message.error(e.message, 6),
  })

  const toggle = useMutation({
    mutationFn: (r: Rate) => salaryApi.updateRate(r.id, { isActive: !r.is_active }),
    onSuccess: () => q.refetch(),
    onError: (e: Error) => message.error(e.message),
  })

  const remove = useMutation({
    mutationFn: () => salaryApi.deleteRate(removing!.id),
    onSuccess: () => {
      setRemoving(null)
      message.success('Ставка удалена')
      q.refetch()
    },
    onError: (e: Error) => {
      setRemoving(null)
      message.error(e.message, 6)
    },
  })

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card
        title="Ставки (проценты для зарплаты)"
        size="small"
        extra={
          editable && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAdding(true)}>
              Новая ставка
            </Button>
          )
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Справочник процентов"
          description="Здесь заводятся проценты (0.1 %, 0.5 % и любые другие). Их назначают партнёрам в разделе «Проценты партнёров», а зарплата берёт оборот партнёра × его ставку."
        />
        <Toolbar total={rates.length} loading={q.isFetching} onRefresh={() => q.refetch()} />
        <Table
          dataSource={rates}
          loading={q.isFetching}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 520 }}
          locale={{ emptyText: 'Ставок пока нет — добавьте 0.1 и 0.5' }}
        >
          <Table.Column
            dataIndex="percent"
            title="Ставка"
            width={140}
            render={(v: number) => (
              <Tag color="green" style={{ fontWeight: 600, fontSize: 13 }}>
                {v}%
              </Tag>
            )}
          />
          <Table.Column
            dataIndex="partners_count"
            title="Партнёров на ставке"
            width={190}
            align="right"
            render={(v: number) => (v ? v : <Text type="secondary">0</Text>)}
          />
          <Table.Column
            dataIndex="is_active"
            title="Активна"
            width={120}
            render={(v: boolean, r: Rate) =>
              editable ? (
                <Switch size="small" checked={v} onChange={() => toggle.mutate(r)} />
              ) : (
                <Tag color={v ? 'success' : 'default'}>{v ? 'да' : 'нет'}</Tag>
              )
            }
          />
          {editable && (
            <Table.Column
              title=""
              width={60}
              fixed="right"
              render={(_: unknown, r: Rate) => (
                <Button
                  size="small"
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  onClick={() => setRemoving(r)}
                />
              )}
            />
          )}
        </Table>
      </Card>

      <Modal
        open={adding}
        title="Новая ставка"
        okText="Добавить"
        cancelText="Отмена"
        confirmLoading={create.isPending}
        onOk={() => create.mutate()}
        onCancel={() => {
          setAdding(false)
          form.resetFields()
        }}
        width={360}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item
            name="percent"
            label="Процент от оборота"
            rules={[{ required: true, message: 'Обязательно' }]}
          >
            <InputNumber
              min={0}
              max={100}
              step={0.1}
              precision={3}
              addonAfter="%"
              autoFocus
              style={{ width: '100%' }}
              placeholder="0.1"
            />
          </Form.Item>
        </Form>
      </Modal>

      <DangerConfirm
        open={!!removing}
        title="Удалить ставку?"
        what={`Ставка ${removing?.percent}% будет удалена.`}
        confirmWord="УДАЛИТЬ"
        okText="Удалить"
        loading={remove.isPending}
        onOk={() => remove.mutate()}
        onCancel={() => setRemoving(null)}
      />
    </Space>
  )
}
