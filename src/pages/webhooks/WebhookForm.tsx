import { useEffect } from 'react'
import { Modal, Form, Input, Select, Alert, Space, Button } from 'antd'
import { useSelect } from '@refinedev/antd'
import { WEBHOOK_EVENTS, WEBHOOK_STATUS, options } from '../../lib/apiEnums'

const INVOICE = WEBHOOK_EVENTS.filter((e) => e.startsWith('INVOICE_'))
const REFUND = WEBHOOK_EVENTS.filter((e) => e.startsWith('REFUND_'))

export function WebhookForm({
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
      form.setFieldsValue({ url: initial.url, events: initial.events, status: initial.status })
    }
  }, [open, initial, mode, form])

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Новый вебхук' : 'Изменить вебхук'}
      okText={mode === 'create' ? 'Создать' : 'Сохранить'}
      cancelText="Отмена"
      onOk={async () => onSubmit(await form.validateFields())}
      onCancel={onCancel}
      confirmLoading={loading}
      width={620}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="Требования к URL"
        description={
          <span>
            Только <b>https</b>, доменное имя (не IP), без логина/пароля в адресе. Сервисы-перехватчики
            (webhook.site, ngrok, requestbin и подобные) запрещены. Если у партнёра есть
            подтверждённые домены, адрес должен быть на одном из них.
          </span>
        }
      />

      <Form form={form} layout="vertical" size="small">
        {mode === 'create' && (
          // Здесь partnerId — UUID партнёра, не человекочитаемый код.
          <Form.Item
            name="partnerId"
            label="Партнёр"
            rules={[{ required: true, message: 'Обязательно' }]}
          >
            <Select
              {...(selectProps as any)}
              showSearch
              placeholder="Выберите партнёра"
              filterOption={(i: string, o: any) =>
                String(o?.label ?? '').toLowerCase().includes(i.toLowerCase())
              }
            />
          </Form.Item>
        )}

        <Form.Item
          name="url"
          label="URL"
          rules={[
            { required: true, message: 'Обязательно' },
            {
              validator: (_, v) =>
                !v || v.startsWith('https://')
                  ? Promise.resolve()
                  : Promise.reject(new Error('Адрес должен начинаться с https://')),
            },
          ]}
        >
          <Input placeholder="https://example.com/webhooks/lovepay" />
        </Form.Item>

        <Form.Item
          name="events"
          label="События"
          rules={[{ required: true, message: 'Выберите хотя бы одно' }]}
          extra={
            <Space size={4} style={{ marginTop: 4 }}>
              <Button size="small" type="link" onClick={() => form.setFieldValue('events', [...INVOICE])}>
                только счета
              </Button>
              <Button size="small" type="link" onClick={() => form.setFieldValue('events', [...REFUND])}>
                только возвраты
              </Button>
              <Button
                size="small"
                type="link"
                onClick={() => form.setFieldValue('events', [...WEBHOOK_EVENTS])}
              >
                все
              </Button>
            </Space>
          }
        >
          <Select
            mode="multiple"
            allowClear
            placeholder="Выберите события"
            options={options(WEBHOOK_EVENTS)}
            maxTagCount={6}
          />
        </Form.Item>

        {mode === 'edit' && (
          <Form.Item name="status" label="Статус">
            <Select options={WEBHOOK_STATUS} />
          </Form.Item>
        )}
      </Form>
    </Modal>
  )
}
