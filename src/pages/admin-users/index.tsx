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
  Select,
  Switch,
  Alert,
  Tabs,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LogoutOutlined,
  LockOutlined,
} from '@ant-design/icons'
import { dt } from '../../lib/format'
import { Toolbar } from '../../components/Toolbar'
import { DangerConfirm } from '../../components/DangerAction'
import { useRowMenu } from '../../components/useRowMenu'
import { adminApi, type AdminUser } from '../../api/adminUsers'
import { canWrite } from '../../api/accessControl'
import { getMe } from '../../api/authProvider'

const { Text } = Typography

export const AdminUsers = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [editing, setEditing] = useState<AdminUser | 'new' | null>(null)
  const [removing, setRemoving] = useState<AdminUser | null>(null)
  const me = getMe()
  const editable = canWrite('admin-users')

  const q = useQuery({ queryKey: ['admin-users'], queryFn: adminApi.users })
  const roles = useQuery({ queryKey: ['admin-roles'], queryFn: adminApi.roles })
  const audit = useQuery({ queryKey: ['admin-audit'], queryFn: adminApi.audit })

  const users = q.data?.users ?? []

  const save = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      if (editing === 'new') {
        return adminApi.createUser({
          username: v.username,
          fullName: v.fullName,
          password: v.password,
          roleId: v.roleId,
        })
      }
      return adminApi.updateUser((editing as AdminUser).id, {
        fullName: v.fullName,
        roleId: v.roleId,
        isActive: v.isActive,
        password: v.password || undefined,
      })
    },
    onSuccess: () => {
      setEditing(null)
      form.resetFields()
      message.success('Сохранено')
      q.refetch()
      audit.refetch()
    },
    onError: (e: Error) => message.error(e.message, 6),
  })

  const remove = useMutation({
    mutationFn: () => adminApi.deleteUser(removing!.id),
    onSuccess: () => {
      setRemoving(null)
      message.success('Пользователь удалён')
      q.refetch()
    },
    onError: (e: Error) => {
      setRemoving(null)
      message.error(e.message, 6)
    },
  })

  const kick = useMutation({
    mutationFn: (id: string) => adminApi.kick(id),
    onSuccess: (r) => {
      message.success(r.revoked ? `Сессий завершено: ${r.revoked}` : 'Активных сессий не было')
      audit.refetch()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const open = (u: AdminUser | 'new') => {
    setEditing(u)
    if (u === 'new') form.resetFields()
    else
      form.setFieldsValue({
        username: u.username,
        fullName: u.full_name,
        roleId: u.role_id,
        isActive: u.is_active,
        password: '',
      })
  }

  // Принимает и null, и 'new': модалка вызывает это до того, как выбран
  // пользователь, и `editing !== 'new'` от null не спасает.
  const isSelf = (u?: AdminUser | 'new' | null) => !!u && u !== 'new' && u.id === me?.id

  const { onRow, menu } = useRowMenu<AdminUser>((u) => [
    editable && { key: 'edit', label: 'Изменить', onClick: () => open(u) },
    editable && { key: 'kick', label: 'Завершить все сессии', onClick: () => kick.mutate(u.id) },
    editable && !isSelf(u) && { type: 'divider' },
    editable &&
      !isSelf(u) && { key: 'del', label: 'Удалить', danger: true, onClick: () => setRemoving(u) },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}
      <Card
        title="Пользователи системы"
        size="small"
        extra={
          editable && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => open('new')}>
              Новый пользователь
            </Button>
          )
        }
      >
        <Tabs
          items={[
            {
              key: 'users',
              label: `Пользователи · ${users.length}`,
              children: (
                <>
                  <Toolbar total={users.length} loading={q.isFetching} onRefresh={() => q.refetch()} />
                  <Table
                    dataSource={users}
                    loading={q.isFetching}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ x: 900 }}
                    onRow={onRow}
                  >
                    <Table.Column
                      dataIndex="username"
                      title="Логин"
                      width={170}
                      render={(v: string, u: AdminUser) => (
                        <Space size={4}>
                          <Text strong>{v}</Text>
                          {isSelf(u) && <Tag color="blue">это вы</Tag>}
                        </Space>
                      )}
                    />
                    <Table.Column
                      dataIndex="full_name"
                      title="Имя"
                      width={190}
                      render={(v: string) => v ?? '—'}
                    />
                    <Table.Column
                      dataIndex="role_name"
                      title="Роль"
                      width={180}
                      render={(v: string, u: AdminUser) =>
                        v ? (
                          <Space size={4}>
                            {u.role_is_system && <LockOutlined style={{ color: '#8c8c8c' }} />}
                            <Tag color={u.role_is_system ? 'red' : 'default'}>{v}</Tag>
                          </Space>
                        ) : (
                          <Text type="secondary">без роли</Text>
                        )
                      }
                    />
                    <Table.Column
                      dataIndex="is_active"
                      title="Статус"
                      width={110}
                      render={(v: boolean) => (
                        <Tag color={v ? 'success' : 'default'}>{v ? 'активен' : 'отключён'}</Tag>
                      )}
                    />
                    <Table.Column
                      dataIndex="last_login_at"
                      title="Последний вход"
                      width={150}
                      render={(v: string) => (v ? dt(v) : <Text type="secondary">не входил</Text>)}
                    />
                    <Table.Column
                      dataIndex="created_at"
                      title="Создан"
                      width={140}
                      render={(v: string) => dt(v)}
                    />
                    {editable && (
                      <Table.Column
                        title=""
                        width={110}
                        fixed="right"
                        render={(_: unknown, u: AdminUser) => (
                          <Space size={4}>
                            <Button size="small" icon={<EditOutlined />} onClick={() => open(u)} />
                            <Button
                              size="small"
                              icon={<LogoutOutlined />}
                              title="Завершить все сессии"
                              onClick={() => kick.mutate(u.id)}
                            />
                            {!isSelf(u) && (
                              <Button
                                size="small"
                                danger
                                type="text"
                                icon={<DeleteOutlined />}
                                onClick={() => setRemoving(u)}
                              />
                            )}
                          </Space>
                        )}
                      />
                    )}
                  </Table>
                </>
              ),
            },
            {
              key: 'audit',
              label: 'Журнал админки',
              children: (
                <>
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="Кто что делал именно в этой админке"
                    description="В аудите loveandpay все действия отсюда выглядят как «admin-api (1C)» — по нему не понять, какой оператор нажал кнопку. Здесь видно имя."
                  />
                  <Toolbar loading={audit.isFetching} onRefresh={() => audit.refetch()} />
                  <Table
                    dataSource={audit.data?.entries ?? []}
                    loading={audit.isFetching}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 20 }}
                    scroll={{ x: 800 }}
                  >
                    <Table.Column
                      dataIndex="created_at"
                      title="Когда"
                      width={150}
                      render={(v: string) => dt(v)}
                    />
                    <Table.Column
                      dataIndex="username"
                      title="Кто"
                      width={150}
                      render={(v: string) => v ?? <Text type="secondary">—</Text>}
                    />
                    <Table.Column
                      dataIndex="action"
                      title="Действие"
                      width={190}
                      render={(v: string) => (
                        <Tag color={/DELETE|REVOKED/.test(v) ? 'error' : /LOGIN/.test(v) ? 'blue' : 'default'}>
                          {v}
                        </Tag>
                      )}
                    />
                    <Table.Column dataIndex="entity" title="Объект" width={120} render={(v: string) => v ?? '—'} />
                    <Table.Column dataIndex="ip_address" title="IP" width={140} render={(v: string) => v ?? '—'} />
                    <Table.Column
                      dataIndex="details"
                      title="Детали"
                      ellipsis
                      render={(v: unknown) =>
                        v ? (
                          <Text style={{ fontSize: 11 }}>
                            {Array.isArray((v as any).changed)
                              ? (v as any).changed.join('; ')
                              : JSON.stringify(v)}
                          </Text>
                        ) : (
                          '—'
                        )
                      }
                    />
                  </Table>
                </>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        open={!!editing}
        title={editing === 'new' ? 'Новый пользователь' : `Пользователь: ${(editing as AdminUser)?.username}`}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={save.isPending}
        onOk={() => save.mutate()}
        onCancel={() => {
          setEditing(null)
          form.resetFields()
        }}
        width={480}
        destroyOnHidden
      >
        {isSelf(editing) && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="Это вы. Отключить себя или сменить себе роль нельзя — иначе можно потерять доступ к админке."
          />
        )}
        <Form form={form} layout="vertical" size="small">
          <Form.Item
            name="username"
            label="Логин"
            rules={[{ required: editing === 'new', message: 'Обязательно' }]}
          >
            <Input disabled={editing !== 'new'} autoComplete="off" />
          </Form.Item>
          <Form.Item name="fullName" label="Имя">
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing === 'new' ? 'Пароль' : 'Новый пароль'}
            extra={
              editing === 'new'
                ? 'Минимум 8 символов'
                : 'Оставьте пустым, чтобы не менять. Смена пароля завершит все сессии этого пользователя.'
            }
            rules={[
              { required: editing === 'new', message: 'Обязательно' },
              { min: 8, message: 'Минимум 8 символов' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item name="roleId" label="Роль" rules={[{ required: true, message: 'Обязательно' }]}>
            <Select
              disabled={isSelf(editing)}
              options={(roles.data?.roles ?? []).map((r) => ({
                value: r.id,
                label: r.is_system ? `${r.name} (полный доступ)` : r.name,
              }))}
            />
          </Form.Item>
          {editing !== 'new' && (
            <Form.Item name="isActive" label="Активен" valuePropName="checked">
              <Switch size="small" disabled={isSelf(editing)} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      <DangerConfirm
        open={!!removing}
        title="Удалить пользователя?"
        what={`«${removing?.username}» потеряет доступ к админке немедленно, все его сессии будут завершены.`}
        confirmWord="УДАЛИТЬ"
        okText="Удалить"
        loading={remove.isPending}
        onOk={() => remove.mutate()}
        onCancel={() => setRemoving(null)}
      />
    </Space>
  )
}
