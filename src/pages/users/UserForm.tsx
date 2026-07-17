import { useEffect } from 'react'
import { Modal, Form, Input, InputNumber, Switch, Select, Alert } from 'antd'
import { useSelect } from '@refinedev/antd'
import { USER_ROLE, selectOptions } from '../../lib/enums'

export function UserForm({
  open,
  mode,
  initial,
  loading,
  onSubmit,
  onCancel,
}: {
  open: boolean
  mode: 'create' | 'edit'
  initial?: any
  loading?: boolean
  onSubmit: (values: Record<string, unknown>) => void
  onCancel: () => void
}) {
  const [form] = Form.useForm()

  const { selectProps } = useSelect({
    resource: 'partners',
    optionLabel: 'name',
    optionValue: 'id',
    pagination: { pageSize: 200 },
  })

  useEffect(() => {
    if (!open) return
    form.resetFields()
    if (mode === 'edit' && initial) {
      form.setFieldsValue({ ...initial, partnerId: initial.partnerId ?? undefined })
    }
  }, [open, initial, mode, form])

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Новый пользователь' : `Пользователь: ${initial?.email ?? ''}`}
      okText={mode === 'create' ? 'Создать' : 'Сохранить'}
      cancelText="Отмена"
      onOk={async () => onSubmit(await form.validateFields())}
      onCancel={onCancel}
      confirmLoading={loading}
      width={520}
      destroyOnHidden
    >
      {mode === 'edit' && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Email и пароль через это API не меняются — только имя, роль, партнёр и наценки."
        />
      )}
      <Form form={form} layout="vertical" size="small">
        {mode === 'create' && (
          <>
            <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Обязательно' }]}>
              <Input />
            </Form.Item>
            <Form.Item
              name="password"
              label="Пароль"
              rules={[{ required: true, message: 'Обязательно' }]}
            >
              <Input.Password />
            </Form.Item>
          </>
        )}

        <Form.Item name="name" label="Имя" rules={[{ required: mode === 'create', message: 'Обязательно' }]}>
          <Input />
        </Form.Item>

        <Form.Item name="role" label="Роль" initialValue={mode === 'create' ? 'EMPLOYEE' : undefined}>
          <Select options={selectOptions(USER_ROLE)} />
        </Form.Item>

        {/* Здесь partnerId — это UUID партнёра, в отличие от кода в карточке партнёра. */}
        <Form.Item name="partnerId" label="Партнёр" extra="Пусто — пользователь без партнёра">
          <Select
            {...(selectProps as any)}
            allowClear
            showSearch
            placeholder="Не выбран"
            filterOption={(i: string, o: any) =>
              String(o?.label ?? '').toLowerCase().includes(i.toLowerCase())
            }
          />
        </Form.Item>

        <Form.Item name="currencyMarkup" label="Наценка на курс, %">
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>
        <Form.Item name="subPartnerCommission" label="Комиссия суб-партнёра, %">
          <InputNumber style={{ width: '100%' }} min={0} />
        </Form.Item>

        {mode === 'edit' && (
          <Form.Item name="isActive" label="Активен" valuePropName="checked">
            <Switch size="small" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
