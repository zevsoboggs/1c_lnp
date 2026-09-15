import { useEffect, useState } from 'react'
import { Modal, Form, Input, InputNumber, Switch, Select, Alert, Typography } from 'antd'
import { useSelect } from '@refinedev/antd'
import { TERMINAL_PROVIDERS, options } from '../../lib/apiEnums'

const { Text } = Typography

/**
 * Терминал = назначение провайдера партнёру.
 *
 * У каждого провайдера свои реквизиты, и лежат они в config:
 *
 *   KANYON  — числовой tspId и имя терминала (merchantId) в режиме direct;
 *   PAYSIDO — merchantId и secret;
 *   STYKPAY — keyId и secret, при необходимости свой apiUrl.
 *
 * Реквизиты необязательны: без них терминал работает на общих ключах из
 * окружения платформы. Свои нужны, когда у партнёра договор с провайдером
 * собственный.
 *
 * Секреты API наружу отдаёт замаскированными («••••b839»). Отправлять маску
 * обратно нельзя — она затрёт настоящий ключ, поэтому поля секретов при
 * открытии всегда пустые: пусто означает «не менять».
 */

/** Реквизиты, которые форма умеет заполнять, по провайдерам. */
const CREDENTIAL_FIELDS: Record<string, Array<{ name: string; label: string; secret?: boolean; hint?: string }>> = {
  PAYSIDO: [
    { name: 'secret', label: 'Секретный ключ', secret: true },
  ],
  STYKPAY: [
    { name: 'keyId', label: 'Идентификатор ключа (keyId)', hint: 'ak_live_… боевой, ak_test_… тестовый' },
    { name: 'secret', label: 'Секретный ключ', secret: true, hint: 'Целиком, вместе с приставкой sk_live_' },
    { name: 'apiUrl', label: 'Адрес API', hint: 'Пусто — общий адрес платформы' },
  ],
}

export function TerminalForm({
  open,
  mode,
  initial,
  providers,
  loading,
  onSubmit,
  onCancel,
}: {
  open: boolean
  mode: 'create' | 'edit'
  initial?: any
  /** Провайдеры, которые платформа умеет проводить; приходят из API. */
  providers?: string[]
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

  // Пока список не пришёл, показываем значения enum — иначе выбор пуст.
  const assignable = providers?.length ? providers : [...TERMINAL_PROVIDERS]

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
        // Не секреты подставляем как есть, секреты — никогда.
        keyId: cfg.keyId ?? cfg.key_id,
        apiUrl: cfg.apiUrl ?? cfg.api_url,
      })
      setProvider(initial.provider)
      setDirect(cfg.mode === 'direct' || cfg.tspId != null)
    } else {
      setProvider(assignable.includes('KANYON') ? 'KANYON' : assignable[0])
      setDirect(true)
    }
    // assignable пересобирается на каждый рендер — в зависимости не берём.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial, mode, form])

  const kanyonDirect = provider === 'KANYON' && direct
  const credentials = CREDENTIAL_FIELDS[provider] ?? []

  /** Что уже задано у терминала — по замаскированному ответу API. */
  const configured = (name: string) => {
    const cfg = initial?.config ?? {}
    const value = cfg[name] ?? cfg[name.replace(/[A-Z]/g, (c: string) => '_' + c.toLowerCase())]
    return value !== undefined && value !== null && value !== ''
  }

  const submit = async () => {
    const v = await form.validateFields()
    const { tspId, keyId, secret, apiUrl, ...rest } = v

    // Пустые поля не отправляем: на PATCH admin-api дописывает присланные
    // ключи к текущим, поэтому пропуск поля means «оставить как есть».
    const config: Record<string, unknown> = {}
    if (kanyonDirect) {
      config.mode = 'direct'
      config.tspId = Number(tspId)
    }
    for (const field of credentials) {
      const value = { keyId, secret, apiUrl }[field.name as 'keyId' | 'secret' | 'apiUrl']
      if (typeof value === 'string' && value.trim() !== '') {
        config[field.name] = value.trim()
      }
    }

    const hasConfig = Object.keys(config).length > 0

    if (mode === 'create') {
      onSubmit({
        ...rest,
        provider,
        config: hasConfig ? config : undefined,
        priority: rest.priority ?? 0,
      })
    } else {
      onSubmit({ ...rest, ...(hasConfig ? { config } : {}) })
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
            <Form.Item
              label="Провайдер"
              required
              extra="Перечислены только те, через кого платформа проводит платежи сейчас."
            >
              <Select value={provider} onChange={setProvider} options={options(assignable)} />
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

        {credentials.length > 0 && (
          <>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message={`Свои реквизиты ${provider}`}
              description="Нужны, только если у партнёра собственный договор с провайдером. Пусто — терминал работает на общих ключах платформы."
            />
            {credentials.map((field) => (
              <Form.Item
                key={field.name}
                name={field.name}
                label={field.label}
                extra={
                  field.secret && mode === 'edit' && configured(field.name)
                    ? 'Ключ задан. Пусто — оставить прежний.'
                    : field.hint
                }
              >
                {field.secret ? <Input.Password autoComplete="new-password" /> : <Input />}
              </Form.Item>
            ))}
          </>
        )}

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
