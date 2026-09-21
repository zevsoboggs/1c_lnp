import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Card,
  Table,
  Space,
  Statistic,
  Typography,
  Tag,
  Select,
  Input,
  Button,
  Tabs,
  App,
  Alert,
  Form,
  InputNumber,
  Switch,
  Progress,
  Tooltip,
} from 'antd'
import {
  ThunderboltOutlined,
  PlusOutlined,
  ClockCircleOutlined,
  StopOutlined,
  EditOutlined,
  DeleteOutlined,
  WalletOutlined,
  ApiOutlined,
} from '@ant-design/icons'
import { dt } from '../../lib/format'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { StatusTag } from '../../components/StatusTag'
import { DataTable } from '../../components/DataTable'
import { useRowMenu } from '../../components/useRowMenu'
import { canWrite } from '../../api/accessControl'
import {
  energyApi,
  ORDER_STATUS,
  PERIODS,
  PROVIDERS,
  rentCost,
  burnCost,
  isTronAddress,
  type EnergyOrder,
  type EnergyAddress,
  type EnergySettings,
} from '../../api/energy'
import { RentModal, ExtendModal, CancelModal, AddressModal, RemoveAddressModal, TopupModal } from './Forms'

const { Text } = Typography

const num = (v: number | null | undefined) => (v == null ? '—' : new Intl.NumberFormat('ru-RU').format(v))
const trx = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(2)} TRX`)
const periodLabel = (p: string) => PERIODS.find((x) => x.value === p)?.label ?? p
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** Сколько осталось до конца аренды — человеком. */
function left(expiresAt: string | null): string {
  if (!expiresAt) return '—'
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'истекла'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h >= 48) return `${Math.floor(h / 24)} дн.`
  return h > 0 ? `${h} ч ${m} мин` : `${m} мин`
}

export const EnergyPage = () => {
  const write = canWrite('energy')

  const [status, setStatus] = useState<string>()
  const [search, setSearch] = useState<string>()
  const [searchText, setSearchText] = useState('')
  const [tab, setTab] = useState('orders')

  const [renting, setRenting] = useState<{ preset: EnergyAddress | null } | null>(null)
  const [extending, setExtending] = useState<EnergyOrder | null>(null)
  const [cancelling, setCancelling] = useState<EnergyOrder | null>(null)
  const [addressForm, setAddressForm] = useState<{ editing: EnergyAddress | null } | null>(null)
  const [removing, setRemoving] = useState<EnergyAddress | null>(null)
  const [topup, setTopup] = useState(false)

  const overview = useQuery({ queryKey: ['energy-overview'], queryFn: energyApi.overview })
  const orders = useQuery({
    queryKey: ['energy-orders', status, search],
    queryFn: () => energyApi.orders({ status, search }),
  })
  const addresses = useQuery({ queryKey: ['energy-addresses'], queryFn: energyApi.addresses })

  const refetchAll = () => {
    overview.refetch()
    orders.refetch()
    addresses.refetch()
  }

  const list = orders.data ?? []
  const addrList = addresses.data ?? []

  const { onRow: onOrderRow, menu: orderMenu } = useRowMenu<EnergyOrder>((r) => [
    write &&
      r.status === 'ACTIVE' && { key: 'ext', label: 'Продлить', onClick: () => setExtending(r) },
    write && {
      key: 'again',
      label: 'Арендовать ещё на этот адрес',
      onClick: () =>
        setRenting({
          preset: addrList.find((a) => a.address === r.address) ?? null,
        }),
    },
    { key: 'addr', label: 'Копировать адрес', onClick: () => navigator.clipboard.writeText(r.address) },
    r.txHash && {
      key: 'tx',
      label: 'Копировать hash транзакции',
      onClick: () => navigator.clipboard.writeText(r.txHash!),
    },
    write &&
      (r.status === 'ACTIVE' || r.status === 'PENDING') && { type: 'divider' as const },
    write &&
      (r.status === 'ACTIVE' || r.status === 'PENDING') && {
        key: 'cancel',
        label: 'Отменить аренду',
        danger: true,
        onClick: () => setCancelling(r),
      },
  ])

  const { onRow: onAddrRow, menu: addrMenu } = useRowMenu<EnergyAddress>((r) => [
    write && { key: 'rent', label: 'Арендовать энергию', onClick: () => setRenting({ preset: r }) },
    write && { key: 'edit', label: 'Изменить', onClick: () => setAddressForm({ editing: r }) },
    { key: 'copy', label: 'Копировать адрес', onClick: () => navigator.clipboard.writeText(r.address) },
    {
      key: 'orders',
      label: 'Аренды этого адреса',
      onClick: () => {
        setSearchText(r.address)
        setSearch(r.address)
        setTab('orders')
      },
    },
    write && { type: 'divider' as const },
    write && { key: 'rm', label: 'Удалить из справочника', danger: true, onClick: () => setRemoving(r) },
  ])

  const o = overview.data
  const lowBalance = o != null && o.balanceTrx < 100

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {orderMenu}
      {addrMenu}

      <Alert
        type="info"
        showIcon
        message="Раздел в разработке: данные демонстрационные, к провайдеру энергии ничего не отправляется."
      />

      <Card title="Аренда энергии TRON" size="small">
        <Space size={32} wrap>
          <Statistic
            title="Баланс у провайдера"
            value={o?.balanceTrx ?? 0}
            precision={2}
            suffix="TRX"
            loading={overview.isFetching}
            valueStyle={{ fontWeight: 700, color: lowBalance ? '#c93838' : undefined }}
          />
          <Statistic
            title="Энергии в аренде сейчас"
            value={o?.rentedNow ?? 0}
            loading={overview.isFetching}
            valueStyle={{ color: '#1668dc' }}
          />
          <Statistic title="Аренд сегодня" value={o?.ordersToday ?? 0} loading={overview.isFetching} />
          <Statistic
            title="Потрачено сегодня"
            value={o?.spentTodayTrx ?? 0}
            precision={2}
            suffix="TRX"
            loading={overview.isFetching}
            valueStyle={{ color: '#b25e09' }}
          />
          <Statistic
            title="Сэкономлено за 30 дней"
            value={o?.savedMonthTrx ?? 0}
            precision={2}
            suffix="TRX"
            loading={overview.isFetching}
            valueStyle={{ color: '#1a7f37' }}
          />
        </Space>

        <Space wrap style={{ marginTop: 12 }}>
          {write && (
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => setRenting({ preset: null })}>
              Арендовать энергию
            </Button>
          )}
          {write && (
            <Button icon={<WalletOutlined />} onClick={() => setTopup(true)}>
              Пополнить баланс
            </Button>
          )}
        </Space>

        {lowBalance && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
            message={`Баланс у провайдера ${trx(o?.balanceTrx)} — автоаренда может не пройти. Пополните.`}
          />
        )}
      </Card>

      <Card size="small">
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'orders',
              label: `Аренды · ${list.length}`,
              children: (
                <>
                  <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
                    <Field label="Поиск">
                      <Input.Search
                        allowClear
                        placeholder="адрес, подпись или № заказа"
                        style={{ width: 280 }}
                        value={searchText}
                        onChange={(e) => {
                          setSearchText(e.target.value)
                          if (!e.target.value) setSearch(undefined)
                        }}
                        onSearch={(v) => setSearch(v || undefined)}
                      />
                    </Field>
                    <Field label="Статус">
                      <Select
                        allowClear
                        placeholder="Все"
                        style={{ width: 160 }}
                        value={status}
                        onChange={setStatus}
                        options={ORDER_STATUS.map(({ value, label }) => ({ value, label }))}
                      />
                    </Field>
                  </Space>

                  <Toolbar total={list.length} loading={orders.isFetching} onRefresh={refetchAll} />

                  <DataTable
                    dataSource={list}
                    loading={orders.isFetching}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 20 }}
                    scroll={{ x: 1200 }}
                    onRow={onOrderRow}
                  >
                    <Table.Column
                      dataIndex="createdAt"
                      title="Создана"
                      width={140}
                      fixed="left"
                      render={(v: string) => dt(v)}
                    />
                    <Table.Column
                      dataIndex="status"
                      title="Статус"
                      width={110}
                      render={(v: string) => <StatusTag list={ORDER_STATUS} value={v} />}
                    />
                    <Table.Column
                      dataIndex="address"
                      title="Адрес"
                      width={240}
                      render={(v: string, r: EnergyOrder) => (
                        <Space direction="vertical" size={0}>
                          {r.label && <Text>{r.label}</Text>}
                          <Tooltip title={v}>
                            <Text code copyable={{ text: v }} style={{ fontSize: 11 }}>
                              {short(v)}
                            </Text>
                          </Tooltip>
                        </Space>
                      )}
                    />
                    <Table.Column
                      dataIndex="energy"
                      title="Энергия"
                      width={110}
                      align="right"
                      sorter={(a: EnergyOrder, b: EnergyOrder) => a.energy - b.energy}
                      render={(v: number, r: EnergyOrder) => (
                        <Space direction="vertical" size={0} style={{ alignItems: 'flex-end' }}>
                          <Text strong>{num(v)}</Text>
                          {r.bandwidth > 0 && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              + {num(r.bandwidth)} bw
                            </Text>
                          )}
                        </Space>
                      )}
                    />
                    <Table.Column dataIndex="period" title="Срок" width={90} render={periodLabel} />
                    <Table.Column
                      dataIndex="expiresAt"
                      title="Осталось"
                      width={110}
                      render={(v: string | null, r: EnergyOrder) =>
                        r.status === 'ACTIVE' ? (
                          <Space size={4}>
                            <ClockCircleOutlined style={{ color: '#1668dc' }} />
                            {left(v)}
                          </Space>
                        ) : (
                          '—'
                        )
                      }
                    />
                    <Table.Column
                      dataIndex="costTrx"
                      title="Стоимость"
                      width={110}
                      align="right"
                      sorter={(a: EnergyOrder, b: EnergyOrder) => a.costTrx - b.costTrx}
                      render={(v: number, r: EnergyOrder) => (
                        <Tooltip title={`Без аренды сгорело бы ${trx(burnCost(r.energy))}`}>
                          <Text>{trx(v)}</Text>
                        </Tooltip>
                      )}
                    />
                    <Table.Column
                      dataIndex="source"
                      title="Источник"
                      width={100}
                      render={(v: string) => (
                        <Tag color={v === 'AUTO' ? 'blue' : 'default'}>{v === 'AUTO' ? 'Авто' : 'Вручную'}</Tag>
                      )}
                    />
                    <Table.Column
                      dataIndex="comment"
                      title="Комментарий"
                      ellipsis
                      render={(v: string | null) => v ?? <Text type="secondary">—</Text>}
                    />
                    <Table.Column
                      dataIndex="txHash"
                      title="Транзакция"
                      width={130}
                      render={(v: string | null) =>
                        v ? (
                          <Text copyable={{ text: v }} style={{ fontSize: 11 }}>
                            {v.slice(0, 10)}…
                          </Text>
                        ) : (
                          '—'
                        )
                      }
                    />
                    {write && (
                      <Table.Column
                        title="Действия"
                        width={100}
                        fixed="right"
                        render={(_: unknown, r: EnergyOrder) => (
                          <Space size={4}>
                            <Button
                              size="small"
                              icon={<ClockCircleOutlined />}
                              title="Продлить"
                              disabled={r.status !== 'ACTIVE'}
                              onClick={() => setExtending(r)}
                            />
                            <Button
                              size="small"
                              danger
                              icon={<StopOutlined />}
                              title="Отменить"
                              disabled={r.status !== 'ACTIVE' && r.status !== 'PENDING'}
                              onClick={() => setCancelling(r)}
                            />
                          </Space>
                        )}
                      />
                    )}
                  </DataTable>
                </>
              ),
            },
            {
              key: 'addresses',
              label: `Адреса · ${addrList.length}`,
              children: (
                <>
                  <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
                    {write && (
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => setAddressForm({ editing: null })}
                      >
                        Добавить адрес
                      </Button>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Кошельки, с которых уходят USDT. Для каждого можно включить автоаренду по порогу.
                    </Text>
                  </Space>

                  <Toolbar total={addrList.length} loading={addresses.isFetching} onRefresh={refetchAll} />

                  <DataTable
                    dataSource={addrList}
                    loading={addresses.isFetching}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    scroll={{ x: 1100 }}
                    onRow={onAddrRow}
                  >
                    <Table.Column dataIndex="label" title="Подпись" width={220} fixed="left" />
                    <Table.Column
                      dataIndex="address"
                      title="Адрес"
                      width={330}
                      render={(v: string) => (
                        <Text code copyable={{ text: v }} style={{ fontSize: 11 }}>
                          {v}
                        </Text>
                      )}
                    />
                    <Table.Column
                      dataIndex="energyNow"
                      title="Энергии сейчас"
                      width={190}
                      render={(v: number, r: EnergyAddress) => {
                        const low = r.autoRent && v < r.threshold
                        const pct = r.autoRent && r.threshold > 0 ? Math.min(100, Math.round((v / r.threshold) * 100)) : 100
                        return (
                          <Space direction="vertical" size={0} style={{ width: '100%' }}>
                            <Text strong style={{ color: low ? '#c93838' : undefined }}>
                              {num(v)}
                            </Text>
                            {r.autoRent && (
                              <Progress
                                percent={pct}
                                size="small"
                                showInfo={false}
                                status={low ? 'exception' : 'normal'}
                              />
                            )}
                          </Space>
                        )
                      }}
                    />
                    <Table.Column
                      dataIndex="autoRent"
                      title="Автоаренда"
                      width={220}
                      render={(v: boolean, r: EnergyAddress) =>
                        v ? (
                          <Space direction="vertical" size={0}>
                            <Tag color="success">Включена</Tag>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              ниже {num(r.threshold)} → +{num(r.amount)} на {periodLabel(r.period)}
                            </Text>
                          </Space>
                        ) : (
                          <Tag>Выключена</Tag>
                        )
                      }
                    />
                    <Table.Column
                      dataIndex="lastRentAt"
                      title="Последняя аренда"
                      width={140}
                      render={(v: string | null) => (v ? dt(v) : '—')}
                    />
                    {write && (
                      <Table.Column
                        title="Действия"
                        width={130}
                        fixed="right"
                        render={(_: unknown, r: EnergyAddress) => (
                          <Space size={4}>
                            <Button
                              size="small"
                              icon={<ThunderboltOutlined />}
                              title="Арендовать"
                              onClick={() => setRenting({ preset: r })}
                            />
                            <Button
                              size="small"
                              icon={<EditOutlined />}
                              title="Изменить"
                              onClick={() => setAddressForm({ editing: r })}
                            />
                            <Button
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              title="Удалить"
                              onClick={() => setRemoving(r)}
                            />
                          </Space>
                        )}
                      />
                    )}
                  </DataTable>
                </>
              ),
            },
            {
              key: 'settings',
              label: 'Провайдер',
              children: <SettingsTab write={write} onSaved={refetchAll} />,
            },
          ]}
        />
      </Card>

      <RentModal
        open={!!renting}
        addresses={addrList}
        preset={renting?.preset}
        onClose={() => setRenting(null)}
        onDone={refetchAll}
      />
      <ExtendModal order={extending} onClose={() => setExtending(null)} onDone={refetchAll} />
      <CancelModal order={cancelling} onClose={() => setCancelling(null)} onDone={refetchAll} />
      <AddressModal
        open={!!addressForm}
        editing={addressForm?.editing ?? null}
        onClose={() => setAddressForm(null)}
        onDone={refetchAll}
      />
      <RemoveAddressModal address={removing} onClose={() => setRemoving(null)} onDone={refetchAll} />
      <TopupModal open={topup} onClose={() => setTopup(false)} />
    </Space>
  )
}

/** Подключение к провайдеру и лимиты автоаренды. */
function SettingsTab({ write, onSaved }: { write: boolean; onSaved: () => void }) {
  const { message } = App.useApp()
  const [form] = Form.useForm<EnergySettings>()
  const settings = useQuery({ queryKey: ['energy-settings'], queryFn: energyApi.settings })

  useEffect(() => {
    if (settings.data) form.setFieldsValue(settings.data)
  }, [settings.data, form])

  const save = useMutation({
    mutationFn: async () => energyApi.saveSettings(await form.validateFields()),
    onSuccess: () => {
      message.success('Настройки сохранены')
      settings.refetch()
      onSaved()
    },
    onError: (e: Error) => {
      if (e.message) message.error(e.message, 8)
    },
  })

  const test = useMutation({
    mutationFn: () =>
      energyApi.testConnection({
        provider: form.getFieldValue('provider'),
        apiKey: form.getFieldValue('apiKey') ?? '',
      }),
    onSuccess: (r) => message.success(`Провайдер отвечает, баланс ${trx(r.balanceTrx)}`),
    onError: (e: Error) => message.error(e.message, 8),
  })

  const provider = Form.useWatch('provider', form)
  const providerLabel = PROVIDERS.find((p) => p.value === provider)?.label ?? 'провайдера'

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      disabled={!write}
      style={{ maxWidth: 640 }}
    >
      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        Подключение
      </Text>
      <Space size={16} wrap align="start">
        <Form.Item name="provider" label="Провайдер" rules={[{ required: true }]}>
          <Select style={{ width: 200 }} options={PROVIDERS} />
        </Form.Item>
        <Form.Item
          name="apiKey"
          label={`API-ключ ${providerLabel}`}
          rules={[{ required: true, message: 'Без ключа аренда не пройдёт' }]}
          style={{ minWidth: 320 }}
        >
          <Input.Password placeholder="Из личного кабинета провайдера" autoComplete="off" />
        </Form.Item>
      </Space>
      <Form.Item
        name="payerAddress"
        label="Адрес-плательщик"
        tooltip="Кошелёк, с которого провайдер списывает TRX за аренду"
        rules={[
          { required: true, message: 'Укажите адрес' },
          {
            validator: (_, v) =>
              !v || isTronAddress(v) ? Promise.resolve() : Promise.reject(new Error('Адрес TRON: T…, 34 символа')),
          },
        ]}
      >
        <Input placeholder="T…" />
      </Form.Item>
      <Form.Item>
        <Button icon={<ApiOutlined />} loading={test.isPending} onClick={() => test.mutate()}>
          Проверить подключение
        </Button>
      </Form.Item>

      <Text strong style={{ display: 'block', marginBottom: 8 }}>
        Лимиты и уведомления
      </Text>
      <Space size={16} wrap align="start">
        <Form.Item
          name="dailyLimitTrx"
          label="Лимит расходов в день"
          tooltip="Автоаренда остановится, когда за сутки потрачено больше"
          rules={[{ required: true }]}
        >
          <InputNumber min={0} step={50} style={{ width: 180 }} addonAfter="TRX" />
        </Form.Item>
        <Form.Item name="lowBalanceTrx" label="Предупреждать при балансе ниже" rules={[{ required: true }]}>
          <InputNumber min={0} step={10} style={{ width: 180 }} addonAfter="TRX" />
        </Form.Item>
      </Space>
      <Space size={16} wrap align="start">
        <Form.Item name="notifyTelegram" label="Уведомления в Telegram" valuePropName="checked">
          <Switch checkedChildren="Вкл" unCheckedChildren="Выкл" />
        </Form.Item>
        <Form.Item
          name="notifyEmail"
          label="Почта для уведомлений"
          rules={[{ type: 'email', message: 'Похоже на опечатку' }]}
          style={{ minWidth: 280 }}
        >
          <Input placeholder="ops@example.com" />
        </Form.Item>
      </Space>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={`Ориентир по ценам: перевод USDT (65 000 энергии) на час — ${trx(rentCost(65_000, '1h'))}, на день — ${trx(rentCost(65_000, '1d'))}; без аренды сгорает ${trx(burnCost(65_000))}.`}
      />

      {write && (
        <Button type="primary" loading={save.isPending} onClick={() => save.mutate()}>
          Сохранить
        </Button>
      )}
    </Form>
  )
}
