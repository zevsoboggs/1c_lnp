import { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, Switch, Select, Alert, Typography } from 'antd'
import { useSelect } from '@refinedev/antd'
import { TERMINAL_PROVIDERS, options } from '../../lib/apiEnums'

const { Text } = Typography

/**
 * Терминал = назначение провайдера партнёру.
 *
 * KANYON в режиме direct требует числовой config.tspId и merchantId (имя
 * терминала) — бэкенд это проверяет только на POST, но не на PATCH, поэтому
 * форма держит правило сама в обоих режимах.
 */
export function TerminalForm({
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
  const [provider, setProvider] = useState<string>('KANYON')
  const [direct, setDirect] = useState(true)

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
      const cfg = initial.config ?? {}
      form.setFieldsValue({
        merchantId: initial.merchantId,
        isDefault: initial.isDefault,
        isActive: initial.isActive,
        priority: initial.priority,
        tspId: cfg.tspId,
      })
      setProvider(initial.provider)
      setDirect(cfg.mode === 'direct' || cfg.tspId != null)
    } else {
      setProvider('KANYON')
      setDirect(true)
    }
  }, [open, initial, mode, form])

  const kanyonDirect = provider === 'KANYON' && direct

  const submit = async () => {
    const v = await form.validateFields()
    const { tspId, ...rest } = v

    // config заменяется целиком, а не мержится — собираем его явно.
    const config = kanyonDirect ? { mode: 'direct', tspId: Number(tspId) } : undefined

    if (mode === 'create') {
      onSubmit({
        ...rest,
        provider,
        config,
        priority: rest.priority ?? 0,
      })
    } else {
      onSubmit({ ...rest, ...(config ? { config } : {}) })
    }
  }

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Назначить терминал' : `Терминал ${initial?.provider ?? ''}`}
      okText={mode === 'create' ? 'Назначить' : 'Сохранить'}
      cancelText="Отмена"
      onOk={submit}
      onCancel={onCancel}
      confirmLoading={loading}
      width={540}
      destroyOnHidden
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 12 }}
        message="Терминал определяет, через кого пойдут платежи партнёра."
      />

      <Form form={form} layout="vertical" size="small">
        {mode === 'create' && (
          <>
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
            <Form.Item label="Провайдер" required>
              <Select value={provider} onChange={setProvider} options={options(TERMINAL_PROVIDERS)} />
            </Form.Item>
          </>
        )}

        {provider === 'KANYON' && (
          <Form.Item label="Режим KANYON">
            <Switch size="small" checked={direct} onChange={setDirect} style={{ marginRight: 8 }} />
            <Text type="secondary" style={{ fontSize: 12 }}>
              прямой (direct) — требует tspId и имя терминала
            </Text>
          </Form.Item>
        )}

        {kanyonDirect && (
          <Form.Item
            name="tspId"
            label="config.tspId"
            rules={[
              { required: true, message: 'Для прямого KANYON нужен tspId' },
              {
                validator: (_, v) =>
                  v == null || (Number.isFinite(Number(v)) && Number(v) > 0)
                    ? Promise.resolve()
                    : Promise.reject(new Error('tspId должен быть числом больше нуля')),
              },
            ]}
          >
            <InputNumber style={{ width: '100%' }} min={1} />
          </Form.Item>
        )}

        <Form.Item
          name="merchantId"
          label={kanyonDirect ? 'Имя терминала (merchantId)' : 'Merchant ID'}
          rules={[{ required: kanyonDirect, message: 'Для KANYON имя терминала обязательно' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item name="priority" label="Приоритет" initialValue={0}>
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="isDefault"
          label="По умолчанию"
          valuePropName="checked"
          extra="Снимет признак с остальных терминалов партнёра и перезапишет его defaultProvider."
        >
          <Switch size="small" />
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
