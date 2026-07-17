import { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, Switch, Select, Divider, Alert, Typography } from 'antd'
import { TERMINAL_PROVIDERS, options } from '../../lib/apiEnums'

const { Text } = Typography

export type PartnerFormValues = Record<string, unknown>

/**
 * Создание и правка партнёра.
 *
 * Важно: на создании `partnerId` — человекочитаемый код (слаг), а НЕ UUID.
 * В /users, /terminals и /webhooks поле с тем же именем означает уже UUID.
 * Поэтому здесь оно подписано явно.
 */
export function PartnerForm({
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
  onSubmit: (values: PartnerFormValues) => void
  onCancel: () => void
}) {
  const [form] = Form.useForm()
  const [autoId, setAutoId] = useState(true)

  useEffect(() => {
    if (!open) return
    form.resetFields()
    if (mode === 'edit' && initial) form.setFieldsValue(initial)
    setAutoId(true)
  }, [open, initial, mode, form])

  const submit = async () => {
    const v = await form.validateFields()
    if (mode === 'create') {
      onSubmit({ ...v, useSystemPartnerId: autoId || undefined })
      return
    }
    // PATCH молча игнорирует поля неверного типа: числа должны уйти числами,
    // булевы — булевыми, иначе API ответит успехом, ничего не изменив.
    const patch: PartnerFormValues = {}
    for (const [k, val] of Object.entries(v)) {
      if (val === undefined) continue
      patch[k] = val
    }
    onSubmit(patch)
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Новый партнёр' : `Партнёр: ${initial?.name ?? ''}`}
      okText={mode === 'create' ? 'Создать' : 'Сохранить'}
      cancelText="Отмена"
      onOk={submit}
      onCancel={onCancel}
      confirmLoading={loading}
      width={620}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" size="small">
        <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Обязательно' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, message: 'Обязательно' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="phone" label="Телефон">
          <Input />
        </Form.Item>

        {mode === 'create' && (
          <>
            <Form.Item label="Код партнёра">
              <Switch
                size="small"
                checked={autoId}
                onChange={setAutoId}
                style={{ marginRight: 8 }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                сгенерировать автоматически
              </Text>
            </Form.Item>
            {!autoId && (
              <Form.Item
                name="partnerId"
                label="Код (partnerId)"
                rules={[{ required: true, message: 'Обязательно, если не генерируем' }]}
                extra="Человекочитаемый код, не UUID. Должен быть уникальным."
              >
                <Input placeholder="partner-xxxx" />
              </Form.Item>
            )}
            <Form.Item name="paymentProvider" label="Провайдер по умолчанию" initialValue="KANYON">
              <Select options={options(TERMINAL_PROVIDERS)} />
            </Form.Item>
            <Form.Item name="providerMerchantId" label="Merchant ID у провайдера">
              <Input />
            </Form.Item>

            <Divider orientation="left" style={{ fontSize: 12 }}>
              Владелец (необязательно)
            </Divider>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="Email и пароль нужны только вместе — если заполнить одно, пользователь молча не создастся."
            />
            <Form.Item name="userEmail" label="Email пользователя">
              <Input />
            </Form.Item>
            <Form.Item name="userPassword" label="Пароль">
              <Input.Password />
            </Form.Item>
            <Form.Item name="userName" label="Имя" extra="По умолчанию — название партнёра">
              <Input />
            </Form.Item>
          </>
        )}

        {mode === 'edit' && (
          <>
            <Divider orientation="left" style={{ fontSize: 12 }}>
              Комиссии, %
            </Divider>
            <Form.Item name="platformCommission" label="Комиссия платформы">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="subPartnerCommission" label="Комиссия суб-партнёра">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="refundFeePercent" label="Комиссия за возврат">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="platformPosMarkup" label="POS-наценка платформы">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>

            <Divider orientation="left" style={{ fontSize: 12 }}>
              Лимиты и доступ
            </Divider>
            <Form.Item name="rateLimitPerMinute" label="Запросов в минуту">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="rateLimitPerHour" label="Запросов в час">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
            <Form.Item name="defaultProvider" label="Провайдер по умолчанию">
              <Select allowClear options={options(TERMINAL_PROVIDERS)} />
            </Form.Item>
            <Form.Item name="isActive" label="Активен" valuePropName="checked">
              <Switch size="small" />
            </Form.Item>
            <Form.Item name="apiBlocked" label="API заблокирован" valuePropName="checked">
              <Switch size="small" />
            </Form.Item>
            <Form.Item
              name="isBlocked"
              label="Партнёр заблокирован"
              valuePropName="checked"
              extra="При разблокировке причина блокировки очищается."
            >
              <Switch size="small" />
            </Form.Item>
            <Form.Item name="blockedReason" label="Причина блокировки">
              <Input.TextArea rows={2} />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  )
}
