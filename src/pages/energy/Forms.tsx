import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Modal,
  Form,
  Input,
  AutoComplete,
  InputNumber,
  Select,
  Switch,
  Space,
  Typography,
  Alert,
  Descriptions,
  Segmented,
  App,
  Button,
} from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { DangerConfirm } from '../../components/DangerAction'
import {
  energyApi,
  PERIODS,
  ENERGY_PER_TRANSFER,
  rentCost,
  burnCost,
  isTronAddress,
  type Period,
  type EnergyOrder,
  type EnergyAddress,
} from '../../api/energy'

const { Text, Paragraph } = Typography

const num = (v: number) => new Intl.NumberFormat('ru-RU').format(v)
const trx = (v: number) => `${v.toFixed(2)} TRX`

const addressRule = {
  validator: (_: unknown, v: string) =>
    !v || isTronAddress(v) ? Promise.resolve() : Promise.reject(new Error('Адрес TRON: начинается с T, 34 символа')),
}

/** Сколько энергии нужно на N переводов — считаем за оператора. */
function Estimate({ energy, period }: { energy: number; period: Period }) {
  const cost = rentCost(energy, period)
  const burn = burnCost(energy)
  return (
    <Descriptions
      size="small"
      column={1}
      bordered
      items={[
        { key: 'e', label: 'Энергии', children: num(energy) },
        { key: 'c', label: 'Стоимость аренды', children: <Text strong>{trx(cost)}</Text> },
        { key: 'b', label: 'Без аренды сгорело бы', children: <Text delete>{trx(burn)}</Text> },
        {
          key: 's',
          label: 'Экономия',
          children: <Text style={{ color: '#1a7f37' }}>{trx(Math.max(0, burn - cost))}</Text>,
        },
      ]}
    />
  )
}

/** Арендовать энергию на адрес: вручную, разово. */
export function RentModal({
  open,
  addresses,
  preset,
  onClose,
  onDone,
}: {
  open: boolean
  addresses: EnergyAddress[]
  /** Адрес, с которого открыли форму — подставляется сразу. */
  preset?: EnergyAddress | null
  onClose: () => void
  onDone: () => void
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [mode, setMode] = useState<'transfers' | 'raw'>('transfers')

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        address: preset?.address ?? '',
        transfers: 1,
        recipient: 'existing',
        energy: ENERGY_PER_TRANSFER.existing,
        bandwidth: 0,
        period: preset?.period ?? '1h',
        comment: '',
      })
      setMode('transfers')
    }
  }, [open, preset, form])

  const transfers = Form.useWatch('transfers', form) as number | undefined
  const recipient = Form.useWatch('recipient', form) as 'existing' | 'fresh' | undefined
  const rawEnergy = Form.useWatch('energy', form) as number | undefined
  const period = (Form.useWatch('period', form) as Period | undefined) ?? '1h'

  const energy = useMemo(() => {
    if (mode === 'raw') return Math.max(0, Math.round(rawEnergy ?? 0))
    const per = ENERGY_PER_TRANSFER[recipient ?? 'existing']
    return Math.max(0, Math.round(transfers ?? 0)) * per
  }, [mode, rawEnergy, transfers, recipient])

  const rent = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      return energyApi.rent({
        address: v.address.trim(),
        energy,
        bandwidth: v.bandwidth || 0,
        period: v.period,
        comment: v.comment,
      })
    },
    onSuccess: (o) => {
      message.success(`Энергия арендована: ${num(o.energy)} на ${PERIODS.find((p) => p.value === o.period)?.label}`)
      onDone()
      onClose()
    },
    onError: (e: Error) => {
      if (e.message) message.error(e.message, 8)
    },
  })

  return (
    <Modal
      open={open}
      title="Арендовать энергию"
      okText={`Арендовать за ${trx(rentCost(energy, period))}`}
      okButtonProps={{ disabled: energy <= 0 }}
      confirmLoading={rent.isPending}
      onOk={() => rent.mutate()}
      onCancel={onClose}
      destroyOnClose
      width={560}
    >
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 8 }}>
        <Form.Item
          name="address"
          label="Адрес получателя энергии"
          rules={[{ required: true, message: 'Укажите адрес' }, addressRule]}
        >
          {/* Можно вписать любой адрес — справочник только подсказывает. */}
          <AutoComplete
            allowClear
            placeholder="T… или выберите из справочника"
            options={addresses.map((a) => ({ value: a.address, label: `${a.label} · ${a.address}` }))}
            filterOption={(input, opt) => String(opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        </Form.Item>

        <Form.Item label="Сколько энергии">
          <Segmented
            value={mode}
            onChange={(v) => setMode(v as 'transfers' | 'raw')}
            options={[
              { value: 'transfers', label: 'По числу переводов' },
              { value: 'raw', label: 'Точное число' },
            ]}
            style={{ marginBottom: 8 }}
          />
          {mode === 'transfers' ? (
            <Space wrap>
              <Form.Item name="transfers" noStyle rules={[{ required: true }]}>
                <InputNumber min={1} max={500} style={{ width: 120 }} addonAfter="перев." />
              </Form.Item>
              <Form.Item name="recipient" noStyle>
                <Select
                  style={{ width: 300 }}
                  options={[
                    { value: 'existing', label: `Получатель уже держал USDT · ${num(ENERGY_PER_TRANSFER.existing)}` },
                    { value: 'fresh', label: `Новый адрес без USDT · ${num(ENERGY_PER_TRANSFER.fresh)}` },
                  ]}
                />
              </Form.Item>
            </Space>
          ) : (
            <Form.Item name="energy" noStyle rules={[{ required: true }]}>
              <InputNumber min={1_000} max={50_000_000} step={1_000} style={{ width: 220 }} addonAfter="энергии" />
            </Form.Item>
          )}
        </Form.Item>

        <Space size={16} wrap align="start">
          <Form.Item name="period" label="Срок аренды" rules={[{ required: true }]}>
            <Select style={{ width: 160 }} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
          </Form.Item>
          <Form.Item name="bandwidth" label="Bandwidth (необязательно)" tooltip="Нужен, если на адресе нет TRX на комиссию за байты">
            <InputNumber min={0} max={100_000} step={100} style={{ width: 160 }} />
          </Form.Item>
        </Space>

        <Form.Item name="comment" label="Комментарий">
          <Input placeholder="За что аренда — увидит только команда" maxLength={120} />
        </Form.Item>

        <Estimate energy={energy} period={period} />
      </Form>
    </Modal>
  )
}

/** Продлить действующую аренду. */
export function ExtendModal({
  order,
  onClose,
  onDone,
}: {
  order: EnergyOrder | null
  onClose: () => void
  onDone: () => void
}) {
  const { message } = App.useApp()
  const [period, setPeriod] = useState<Period>('1d')

  const run = useMutation({
    mutationFn: () => energyApi.extend(order!.id, period),
    onSuccess: () => {
      message.success('Аренда продлена')
      onDone()
      onClose()
    },
    onError: (e: Error) => message.error(e.message, 8),
  })

  const cost = order ? rentCost(order.energy, period) : 0

  return (
    <Modal
      open={!!order}
      title="Продлить аренду"
      okText={`Продлить за ${trx(cost)}`}
      confirmLoading={run.isPending}
      onOk={() => run.mutate()}
      onCancel={onClose}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Paragraph style={{ marginBottom: 0 }}>
          Адрес <Text code>{order?.address}</Text>, энергии <Text strong>{order && num(order.energy)}</Text>.
          Срок прибавится к текущему.
        </Paragraph>
        <div>
          <Text style={{ display: 'block', marginBottom: 4 }}>На сколько</Text>
          <Select
            style={{ width: '100%' }}
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((p) => ({ value: p.value, label: p.label }))}
          />
        </div>
      </Space>
    </Modal>
  )
}

/** Отмена активной аренды — деньги провайдер не возвращает. */
export function CancelModal({
  order,
  onClose,
  onDone,
}: {
  order: EnergyOrder | null
  onClose: () => void
  onDone: () => void
}) {
  const { message } = App.useApp()
  const run = useMutation({
    mutationFn: () => energyApi.cancel(order!.id),
    onSuccess: () => {
      message.success('Аренда отменена')
      onDone()
      onClose()
    },
    onError: (e: Error) => {
      message.error(e.message)
      onClose()
    },
  })

  return (
    <DangerConfirm
      open={!!order}
      title="Отменить аренду?"
      what={`Энергия ${order ? num(order.energy) : ''} с адреса ${order?.address ?? ''} будет отозвана. Оплаченные ${order ? trx(order.costTrx) : ''} провайдер не вернёт.`}
      okText="Отменить аренду"
      loading={run.isPending}
      onOk={() => run.mutate()}
      onCancel={onClose}
    />
  )
}

/** Адрес в справочнике: подпись и правила автоаренды. */
export function AddressModal({
  open,
  editing,
  onClose,
  onDone,
}: {
  open: boolean
  editing: EnergyAddress | null
  onClose: () => void
  onDone: () => void
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm()

  useEffect(() => {
    if (open) {
      form.setFieldsValue(
        editing ?? {
          label: '',
          address: '',
          autoRent: true,
          threshold: 70_000,
          amount: ENERGY_PER_TRANSFER.fresh,
          period: '1d',
        },
      )
    }
  }, [open, editing, form])

  const autoRent = Form.useWatch('autoRent', form) as boolean | undefined
  const amount = (Form.useWatch('amount', form) as number | undefined) ?? 0
  const period = (Form.useWatch('period', form) as Period | undefined) ?? '1d'

  const save = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      return energyApi.saveAddress({
        id: editing?.id,
        label: v.label.trim(),
        address: v.address.trim(),
        autoRent: !!v.autoRent,
        threshold: v.autoRent ? v.threshold : 0,
        amount: v.amount,
        period: v.period,
      })
    },
    onSuccess: () => {
      message.success(editing ? 'Адрес обновлён' : 'Адрес добавлен')
      onDone()
      onClose()
    },
    onError: (e: Error) => {
      if (e.message) message.error(e.message, 8)
    },
  })

  return (
    <Modal
      open={open}
      title={editing ? 'Адрес' : 'Новый адрес'}
      okText={editing ? 'Сохранить' : 'Добавить'}
      confirmLoading={save.isPending}
      onOk={() => save.mutate()}
      onCancel={onClose}
      destroyOnClose
    >
      <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 8 }}>
        <Form.Item name="label" label="Подпись" rules={[{ required: true, message: 'Как называть этот кошелёк' }]}>
          <Input placeholder="Горячий кошелёк выплат" maxLength={60} />
        </Form.Item>
        <Form.Item name="address" label="Адрес TRON" rules={[{ required: true, message: 'Укажите адрес' }, addressRule]}>
          <Input placeholder="T…" disabled={!!editing} />
        </Form.Item>

        <Form.Item name="autoRent" label="Автоаренда" valuePropName="checked" style={{ marginBottom: 8 }}>
          <Switch checkedChildren="Вкл" unCheckedChildren="Выкл" />
        </Form.Item>
        <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
          Когда энергии на адресе станет меньше порога, система сама докупит указанный объём. Без автоаренды
          адрес просто удобно выбирать в форме ручной аренды.
        </Paragraph>

        <Space size={16} wrap align="start">
          {autoRent && (
            <Form.Item name="threshold" label="Порог" rules={[{ required: true }]}>
              <InputNumber min={0} step={5_000} style={{ width: 150 }} addonAfter="энергии" />
            </Form.Item>
          )}
          <Form.Item name="amount" label="Докупать по" rules={[{ required: true }]}>
            <InputNumber min={1_000} step={5_000} style={{ width: 170 }} addonAfter="энергии" />
          </Form.Item>
          <Form.Item name="period" label="На срок" rules={[{ required: true }]}>
            <Select style={{ width: 130 }} options={PERIODS.map((p) => ({ value: p.value, label: p.label }))} />
          </Form.Item>
        </Space>

        <Alert
          type="info"
          showIcon
          message={`Одна аренда обойдётся в ${trx(rentCost(amount, period))} — вместо ${trx(burnCost(amount))} сожжённых TRX`}
        />
      </Form>
    </Modal>
  )
}

/** Удаление адреса из справочника — аренды на нём остаются. */
export function RemoveAddressModal({
  address,
  onClose,
  onDone,
}: {
  address: EnergyAddress | null
  onClose: () => void
  onDone: () => void
}) {
  const { message } = App.useApp()
  const run = useMutation({
    mutationFn: () => energyApi.removeAddress(address!.id),
    onSuccess: () => {
      message.success('Адрес удалён из справочника')
      onDone()
      onClose()
    },
    onError: (e: Error) => message.error(e.message),
  })

  return (
    <DangerConfirm
      open={!!address}
      title="Удалить адрес?"
      what={`«${address?.label ?? ''}» пропадёт из справочника, автоаренда для него остановится. Уже арендованная энергия на адресе останется до конца срока.`}
      okText="Удалить"
      loading={run.isPending}
      onOk={() => run.mutate()}
      onCancel={onClose}
    />
  )
}

/** Пополнение баланса у провайдера: показываем куда слать TRX. */
export function TopupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp()
  const deposit = useQuery({ queryKey: ['energy-deposit'], queryFn: energyApi.depositAddress, enabled: open })
  const [amount, setAmount] = useState<number | null>(500)

  const copy = async () => {
    if (!deposit.data) return
    await navigator.clipboard.writeText(deposit.data.address)
    message.success('Адрес скопирован')
  }

  return (
    <Modal open={open} title="Пополнить баланс провайдера" footer={null} onCancel={onClose} destroyOnClose>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Paragraph style={{ marginBottom: 0 }}>
          Переведите TRX на адрес провайдера в сети TRON. Баланс обновится после подтверждения сети — обычно
          в течение минуты.
        </Paragraph>
        <div>
          <Text style={{ display: 'block', marginBottom: 4 }}>Сумма (для расчёта, не ограничение)</Text>
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            step={50}
            value={amount}
            onChange={setAmount}
            addonAfter="TRX"
          />
        </div>
        <div>
          <Text style={{ display: 'block', marginBottom: 4 }}>Адрес для пополнения</Text>
          <Space.Compact style={{ width: '100%' }}>
            <Input readOnly value={deposit.data?.address ?? (deposit.isFetching ? 'Запрашиваем…' : '')} />
            <Button icon={<CopyOutlined />} onClick={copy} disabled={!deposit.data}>
              Копировать
            </Button>
          </Space.Compact>
        </div>
        {amount != null && amount > 0 && (
          <Alert
            type="info"
            showIcon
            message={`${trx(amount)} хватит примерно на ${num(Math.floor((amount * 1_000_000) / 85 / ENERGY_PER_TRANSFER.existing))} переводов USDT при аренде на день`}
          />
        )}
        <Alert
          type="warning"
          showIcon
          message="Только TRX и только сеть TRON. Отправленное в другой сети провайдер не зачислит."
        />
      </Space>
    </Modal>
  )
}
