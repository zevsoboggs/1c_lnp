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
  Input,
  InputNumber,
  Switch,
  Alert,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { dt } from '../../lib/format'
import { Toolbar } from '../../components/Toolbar'
import { DangerConfirm } from '../../components/DangerAction'
import { useRowMenu } from '../../components/useRowMenu'
import { employeesApi, type Employee } from '../../api/employees'
import { canWrite } from '../../api/accessControl'

const { Text } = Typography

export const Employees = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [editing, setEditing] = useState<Employee | 'new' | null>(null)
  const [removing, setRemoving] = useState<Employee | null>(null)
  const editable = canWrite('employees')

  const q = useQuery({ queryKey: ['employees'], queryFn: employeesApi.list })
  const rows = q.data?.employees ?? []
  const active = rows.filter((e) => e.is_active)

  const save = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      const payload = {
        fullName: v.fullName,
        position: v.position,
        email: v.email,
        phone: v.phone,
        telegram: v.telegram,
        percent: v.percent ?? 0,
        isActive: v.isActive,
        comment: v.comment,
      }
      if (editing === 'new') return employeesApi.create(payload)
      return employeesApi.update((editing as Employee).id, payload)
    },
    onSuccess: () => {
      setEditing(null)
      form.resetFields()
      message.success('Сохранено')
      q.refetch()
    },
    onError: (e: Error) => message.error(e.message, 6),
  })

  const remove = useMutation({
    mutationFn: () => employeesApi.remove(removing!.id),
    onSuccess: () => {
      setRemoving(null)
      message.success('Сотрудник удалён')
      q.refetch()
    },
    onError: (e: Error) => {
      setRemoving(null)
      message.error(e.message, 6)
    },
  })

  const open = (e: Employee | 'new') => {
    setEditing(e)
    if (e === 'new') {
      form.resetFields()
      form.setFieldsValue({ isActive: true, percent: 0 })
    } else {
      form.setFieldsValue({
        fullName: e.full_name,
        position: e.position,
        email: e.email,
        phone: e.phone,
        telegram: e.telegram,
        percent: e.percent,
        isActive: e.is_active,
        comment: e.comment,
      })
    }
  }

  const { onRow, menu } = useRowMenu<Employee>((e) => [
    editable && { key: 'edit', label: 'Изменить', onClick: () => open(e) },
    editable && { type: 'divider' },
    editable && { key: 'del', label: 'Удалить', danger: true, onClick: () => setRemoving(e) },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}
      <Card
        title="Сотрудники"
        size="small"
        extra={
          editable && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => open('new')}>
              Новый сотрудник
            </Button>
          )
        }
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Справочник сотрудников и их процент"
          description="Процент — доля сотрудника от оборота. На него будет опираться модуль расчёта зарплаты."
        />
        <Toolbar total={rows.length} loading={q.isFetching} onRefresh={() => q.refetch()}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Активных: {active.length}
          </Text>
        </Toolbar>
        <Table
          dataSource={rows}
          loading={q.isFetching}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 980 }}
          onRow={onRow}
          rowClassName={(e: Employee) => (e.is_active ? '' : 'onec-row-muted')}
        >
          <Table.Column
            dataIndex="full_name"
            title="ФИО"
            width={220}
            render={(v: string) => <Text strong>{v}</Text>}
          />
          <Table.Column
            dataIndex="position"
            title="Должность"
            width={170}
            render={(v: string) => v || <Text type="secondary">—</Text>}
          />
          <Table.Column
            dataIndex="percent"
            title="Процент"
            width={110}
            align="right"
            sorter={(a: Employee, b: Employee) => a.percent - b.percent}
            render={(v: number) =>
              v ? <Tag color="green" style={{ fontWeight: 600 }}>{v}%</Tag> : <Text type="secondary">0%</Text>
            }
          />
          <Table.Column
            dataIndex="phone"
            title="Телефон"
            width={150}
            render={(v: string) => (v ? <Text copyable>{v}</Text> : <Text type="secondary">—</Text>)}
          />
          <Table.Column
            dataIndex="email"
            title="Email"
            width={180}
            render={(v: string) => (v ? <Text copyable>{v}</Text> : <Text type="secondary">—</Text>)}
          />
          <Table.Column
            dataIndex="telegram"
            title="Telegram"
            width={140}
            render={(v: string) => (v ? <Text copyable>{v}</Text> : <Text type="secondary">—</Text>)}
          />
          <Table.Column
            dataIndex="is_active"
            title="Статус"
            width={110}
            render={(v: boolean) => (
              <Tag color={v ? 'success' : 'default'}>{v ? 'работает' : 'уволен'}</Tag>
            )}
          />
          <Table.Column
            dataIndex="created_at"
            title="Добавлен"
            width={140}
            render={(v: string) => dt(v)}
          />
          {editable && (
            <Table.Column
              title=""
              width={90}
              fixed="right"
              render={(_: unknown, e: Employee) => (
                <Space size={4}>
                  <Button size="small" icon={<EditOutlined />} onClick={() => open(e)} />
                  <Button
                    size="small"
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => setRemoving(e)}
                  />
                </Space>
              )}
            />
          )}
        </Table>
      </Card>

      <Modal
        open={!!editing}
        title={editing === 'new' ? 'Новый сотрудник' : `Сотрудник: ${(editing as Employee)?.full_name}`}
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
          <Form.Item name="fullName" label="ФИО" rules={[{ required: true, message: 'Обязательно' }]}>
            <Input placeholder="Иванов Иван Иванович" autoComplete="off" />
          </Form.Item>
          <Form.Item name="position" label="Должность">
            <Input placeholder="Менеджер, оператор, руководитель…" />
          </Form.Item>
          <Space size={12} style={{ display: 'flex' }} align="start">
            <Form.Item
              name="percent"
              label="Процент от оборота"
              extra="Доля для расчёта зарплаты"
              style={{ flex: 1 }}
              rules={[{ type: 'number', min: 0, max: 100, message: '0–100' }]}
            >
              <InputNumber
                min={0}
                max={100}
                step={0.5}
                precision={3}
                addonAfter="%"
                style={{ width: '100%' }}
              />
            </Form.Item>
            {editing !== 'new' && (
              <Form.Item name="isActive" label="Работает" valuePropName="checked">
                <Switch size="small" />
              </Form.Item>
            )}
          </Space>
          <Form.Item name="phone" label="Телефон">
            <Input placeholder="+7 900 000-00-00" />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input placeholder="name@company.io" autoComplete="off" />
          </Form.Item>
          <Form.Item name="telegram" label="Telegram">
            <Input placeholder="@username" />
          </Form.Item>
          <Form.Item name="comment" label="Комментарий">
            <Input.TextArea rows={2} placeholder="Заметки" />
          </Form.Item>
        </Form>
      </Modal>

      <DangerConfirm
        open={!!removing}
        title="Удалить сотрудника?"
        what={`«${removing?.full_name}» будет удалён из справочника.`}
        confirmWord="УДАЛИТЬ"
        okText="Удалить"
        loading={remove.isPending}
        onOk={() => remove.mutate()}
        onCancel={() => setRemoving(null)}
      />
    </Space>
  )
}
