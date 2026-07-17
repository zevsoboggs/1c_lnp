import { useMemo, useState } from 'react'
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
  Radio,
  Alert,
  Segmented,
} from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined } from '@ant-design/icons'
import { dt } from '../../lib/format'
import { Toolbar } from '../../components/Toolbar'
import { DangerConfirm } from '../../components/DangerAction'
import { useRowMenu } from '../../components/useRowMenu'
import { adminApi, LEVELS, type Role } from '../../api/adminUsers'
import { canWrite } from '../../api/accessControl'
import type { Level, Section } from '../../api/authProvider'

const { Text } = Typography

export const AdminRoles = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [editing, setEditing] = useState<Role | 'new' | null>(null)
  const [perms, setPerms] = useState<Record<string, Level>>({})
  const [removing, setRemoving] = useState<Role | null>(null)

  const q = useQuery({ queryKey: ['admin-roles'], queryFn: adminApi.roles })
  const roles = q.data?.roles ?? []
  const sections = q.data?.sections ?? []
  const editable = canWrite('admin-roles')

  const grouped = useMemo(() => {
    const m = new Map<string, Section[]>()
    for (const s of sections) {
      if (!m.has(s.group)) m.set(s.group, [])
      m.get(s.group)!.push(s)
    }
    return [...m.entries()]
  }, [sections])

  const save = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      if (editing === 'new') {
        return adminApi.createRole({ name: v.name, description: v.description, permissions: perms })
      }
      return adminApi.updateRole((editing as Role).id, {
        name: v.name,
        description: v.description,
        permissions: (editing as Role).is_system ? undefined : perms,
      })
    },
    onSuccess: () => {
      setEditing(null)
      form.resetFields()
      message.success('Роль сохранена')
      q.refetch()
    },
    onError: (e: Error) => message.error(e.message, 6),
  })

  const remove = useMutation({
    mutationFn: () => adminApi.deleteRole(removing!.id),
    onSuccess: () => {
      setRemoving(null)
      message.success('Роль удалена')
      q.refetch()
    },
    onError: (e: Error) => {
      setRemoving(null)
      message.error(e.message, 6)
    },
  })

  const open = (r: Role | 'new') => {
    setEditing(r)
    if (r === 'new') {
      form.resetFields()
      setPerms(Object.fromEntries(sections.map((s) => [s.key, 'none'])) as Record<string, Level>)
    } else {
      form.setFieldsValue({ name: r.name, description: r.description })
      setPerms({
        ...(Object.fromEntries(sections.map((s) => [s.key, 'none'])) as Record<string, Level>),
        ...r.permissions,
      })
    }
  }

  const setAll = (level: Level) =>
    setPerms(Object.fromEntries(sections.map((s) => [s.key, level])) as Record<string, Level>)

  const setGroup = (group: string, level: Level) =>
    setPerms((p) => ({
      ...p,
      ...Object.fromEntries(
        sections.filter((s) => s.group === group).map((s) => [s.key, level]),
      ),
    }))

  const count = (r: Role, level: Level) =>
    r.is_system ? sections.length : sections.filter((s) => (r.permissions?.[s.key] ?? 'none') === level).length

  const { onRow, menu } = useRowMenu<Role>((r) => [
    editable && { key: 'edit', label: 'Изменить', onClick: () => open(r) },
    editable &&
      !r.is_system && { key: 'del', label: 'Удалить', danger: true, onClick: () => setRemoving(r) },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}
      <Card
        title="Роли"
        size="small"
        extra={
          editable && (
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => open('new')}>
              Новая роль
            </Button>
          )
        }
      >
        <Toolbar total={roles.length} loading={q.isFetching} onRefresh={() => q.refetch()} />

        <Table
          dataSource={roles}
          loading={q.isFetching}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 900 }}
          onRow={onRow}
        >
          <Table.Column
            dataIndex="name"
            title="Роль"
            width={200}
            render={(v: string, r: Role) => (
              <Space size={4}>
                {r.is_system && <LockOutlined style={{ color: '#8c8c8c' }} />}
                <Text strong>{v}</Text>
              </Space>
            )}
          />
          <Table.Column
            dataIndex="description"
            title="Описание"
            ellipsis
            render={(v: string) => v ?? '—'}
          />
          <Table.Column
            title="Доступ"
            width={280}
            render={(_: unknown, r: Role) => (
              <Space size={4}>
                <Tag color="green">полный: {count(r, 'write')}</Tag>
                <Tag color="blue">чтение: {count(r, 'read')}</Tag>
                <Tag>закрыто: {r.is_system ? 0 : count(r, 'none')}</Tag>
              </Space>
            )}
          />
          <Table.Column
            dataIndex="users_count"
            title="Юзеров"
            width={90}
            align="right"
            render={(v: number) => (v ? <Tag color="blue">{v}</Tag> : <Text type="secondary">0</Text>)}
          />
          <Table.Column dataIndex="created_at" title="Создана" width={140} render={(v: string) => dt(v)} />
          {editable && (
            <Table.Column
              title=""
              width={80}
              fixed="right"
              render={(_: unknown, r: Role) => (
                <Space size={4}>
                  <Button size="small" icon={<EditOutlined />} onClick={() => open(r)} />
                  {!r.is_system && (
                    <Button
                      size="small"
                      danger
                      type="text"
                      icon={<DeleteOutlined />}
                      onClick={() => setRemoving(r)}
                    />
                  )}
                </Space>
              )}
            />
          )}
        </Table>
      </Card>

      <Modal
        open={!!editing}
        title={editing === 'new' ? 'Новая роль' : `Роль: ${(editing as Role)?.name ?? ''}`}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={save.isPending}
        onOk={() => save.mutate()}
        onCancel={() => {
          setEditing(null)
          form.resetFields()
        }}
        width={860}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Обязательно' }]}>
            <Input disabled={editing !== 'new' && (editing as Role)?.is_system} />
          </Form.Item>
          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>

        {editing !== 'new' && (editing as Role)?.is_system ? (
          <Alert
            type="info"
            showIcon
            message="Права системной роли не редактируются"
            description="«Администратор» всегда имеет полный доступ ко всем разделам, включая те, что появятся позже. Иначе можно было бы случайно закрыть себе вход в администрирование."
          />
        ) : (
          <>
            <Space style={{ marginBottom: 8 }} size={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Всем разделам сразу:
              </Text>
              {LEVELS.map((l) => (
                <Button key={l.value} size="small" onClick={() => setAll(l.value)}>
                  {l.label}
                </Button>
              ))}
            </Space>

            <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid #f0f0f0' }}>
              {grouped.map(([group, items]) => (
                <div key={group}>
                  <div
                    style={{
                      background: '#fafafa',
                      padding: '6px 10px',
                      borderBottom: '1px solid #f0f0f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    <Text strong style={{ fontSize: 12 }}>
                      {group}
                    </Text>
                    <Segmented
                      size="small"
                      options={LEVELS.map((l) => ({ label: l.label, value: l.value }))}
                      onChange={(v) => setGroup(group, v as Level)}
                      value={
                        items.every((s) => perms[s.key] === perms[items[0].key])
                          ? perms[items[0].key]
                          : undefined
                      }
                    />
                  </div>
                  {items.map((s) => (
                    <div
                      key={s.key}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '5px 10px',
                        borderBottom: '1px solid #f5f5f5',
                      }}
                    >
                      <Text style={{ fontSize: 13 }}>{s.label}</Text>
                      <Radio.Group
                        size="small"
                        optionType="button"
                        value={perms[s.key] ?? 'none'}
                        onChange={(e) => setPerms((p) => ({ ...p, [s.key]: e.target.value }))}
                        options={LEVELS.map((l) => ({ label: l.label, value: l.value }))}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </Modal>

      <DangerConfirm
        open={!!removing}
        title="Удалить роль?"
        what={`Роль «${removing?.name}» будет удалена. Если она назначена кому-то — удаление не пройдёт, сначала переведите людей на другую роль.`}
        okText="Удалить"
        loading={remove.isPending}
        onOk={() => remove.mutate()}
        onCancel={() => setRemoving(null)}
      />
    </Space>
  )
}
