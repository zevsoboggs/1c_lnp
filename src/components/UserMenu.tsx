import { useState } from 'react'
import { useLogout, useGetIdentity } from '@refinedev/core'
import { Dropdown, Typography, Avatar, Modal, Form, Input, App } from 'antd'
import { UserOutlined, LogoutOutlined, KeyOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { adminApi } from '../api/adminUsers'

const { Text } = Typography

/** Кто вошёл, смена своего пароля и выход — внизу сайдбара. */
export function UserMenu() {
  const { message } = App.useApp()
  const { mutate: logout } = useLogout()
  const { data: me } = useGetIdentity<{ name: string; role?: string }>()
  const [pwOpen, setPwOpen] = useState(false)
  const [form] = Form.useForm()

  const change = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      return adminApi.changePassword(v.current, v.next)
    },
    onSuccess: () => {
      setPwOpen(false)
      form.resetFields()
      message.success('Пароль изменён. Другие сессии завершены.')
    },
    onError: (e: Error) => message.error(e.message),
  })

  return (
    <>
      <Dropdown
        trigger={['click']}
        menu={{
          items: [
            { key: 'pw', icon: <KeyOutlined />, label: 'Сменить пароль', onClick: () => setPwOpen(true) },
            { type: 'divider' },
            {
              key: 'out',
              icon: <LogoutOutlined />,
              label: 'Выйти',
              danger: true,
              onClick: () => logout(),
            },
          ],
        }}
      >
        <div
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            borderTop: '1px solid #efe5b8',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Avatar size={24} icon={<UserOutlined />} style={{ background: '#E8B900', flexShrink: 0 }} />
          <div style={{ minWidth: 0, lineHeight: 1.2 }}>
            <Text strong style={{ fontSize: 12, display: 'block' }} ellipsis>
              {me?.name ?? '—'}
            </Text>
            <Text type="secondary" style={{ fontSize: 10 }} ellipsis>
              {me?.role ?? 'без роли'}
            </Text>
          </div>
        </div>
      </Dropdown>

      <Modal
        open={pwOpen}
        title="Смена пароля"
        okText="Сменить"
        cancelText="Отмена"
        confirmLoading={change.isPending}
        onOk={() => change.mutate()}
        onCancel={() => {
          setPwOpen(false)
          form.resetFields()
        }}
        width={420}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item
            name="current"
            label="Текущий пароль"
            rules={[{ required: true, message: 'Обязательно' }]}
          >
            <Input.Password autoComplete="current-password" autoFocus />
          </Form.Item>
          <Form.Item
            name="next"
            label="Новый пароль"
            extra="Минимум 8 символов. Остальные ваши сессии будут завершены."
            rules={[
              { required: true, message: 'Обязательно' },
              { min: 8, message: 'Минимум 8 символов' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="repeat"
            label="Повторите"
            dependencies={['next']}
            rules={[
              { required: true, message: 'Обязательно' },
              ({ getFieldValue }) => ({
                validator: (_, v) =>
                  !v || getFieldValue('next') === v
                    ? Promise.resolve()
                    : Promise.reject(new Error('Пароли не совпадают')),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
