import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Card as AntCard,
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
  Modal,
  Form,
  InputNumber,
  DatePicker,
  Alert,
  Dropdown,
} from 'antd'
import {
  PlusOutlined,
  EyeOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MoreOutlined,
  StopOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { dt } from '../../lib/format'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { DangerConfirm } from '../../components/DangerAction'
import { vccApi, CARD_STATUS, type Card, type CardTxn } from '../../api/vcc'
import { RevealModal, AmountModal, ContactModal } from './CardActions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

const usd = (v: number | string | null | undefined, cur = 'USD') => {
  const n = Number(v)
  return Number.isFinite(n) ? `${n.toFixed(2)} ${cur}` : '—'
}

export const VccPage = () => {
  const { message } = App.useApp()
  const [form] = Form.useForm()

  const [status, setStatus] = useState<string>()
  const [search, setSearch] = useState<string>()
  const [creating, setCreating] = useState(false)
  const [revealing, setRevealing] = useState<Card | null>(null)
  const [amount, setAmount] = useState<{ card: Card; mode: 'topup' | 'withdraw' } | null>(null)
  const [contact, setContact] = useState<{ card: Card; field: 'email' | 'phone' } | null>(null)
  const [releasing, setReleasing] = useState<Card | null>(null)

  const [txCard, setTxCard] = useState<string>()
  const [txType, setTxType] = useState<string>()
  const [txRange, setTxRange] = useState<[Dayjs, Dayjs] | null>(null)

  const balance = useQuery({ queryKey: ['vcc-balance'], queryFn: vccApi.balance })

  const cards = useQuery({
    queryKey: ['vcc-cards', status, search],
    queryFn: () => vccApi.cards({ status, card_id: search, limit: 100 }),
  })

  const txns = useQuery({
    queryKey: ['vcc-txns', txCard, txType, txRange?.[0]?.format(), txRange?.[1]?.format()],
    queryFn: () =>
      vccApi.transactions({
        card_id: txCard,
        type: txType,
        date_from: txRange?.[0]?.format('YYYY-MM-DD'),
        date_to: txRange?.[1]?.format('YYYY-MM-DD'),
        limit: 100,
      }),
  })

  const refetchAll = () => {
    cards.refetch()
    balance.refetch()
  }

  const create = useMutation({
    mutationFn: async () => {
      const v = await form.validateFields()
      return vccApi.create({
        amount: String(v.amount),
        expdate: v.expdate ? v.expdate.format('YYYY-MM-DD') : undefined,
        network: v.network,
        callback_url: v.callback_url || undefined,
      })
    },
    onSuccess: () => {
      setCreating(false)
      form.resetFields()
      message.success('Карта выпущена')
      refetchAll()
    },
    onError: (e: Error) => message.error(e.message, 8),
  })

  const release = useMutation({
    mutationFn: () => vccApi.release(releasing!.card_id),
    onSuccess: () => {
      setReleasing(null)
      message.success('Карта деактивирована')
      refetchAll()
    },
    onError: (e: Error) => {
      setReleasing(null)
      message.error(e.message)
    },
  })

  const list = cards.data?.cards ?? []
  const active = list.filter((c) => c.status === '1').length
  const onCards = list.reduce((a, c) => a + (Number(c.balance) || 0), 0)

  const { onRow: onCardRow, menu: cardMenu } = useRowMenu<Card>((r) => [
    { key: 'reveal', label: 'Показать реквизиты', onClick: () => setRevealing(r) },
    { key: 'top', label: 'Пополнить', onClick: () => setAmount({ card: r, mode: 'topup' }) },
    { key: 'wd', label: 'Вывести', onClick: () => setAmount({ card: r, mode: 'withdraw' }) },
    { type: 'divider' },
    { key: 'tx', label: 'Покупки этой карты', onClick: () => setTxCard(r.card_id) },
    { key: 'em', label: 'Изменить email', onClick: () => setContact({ card: r, field: 'email' }) },
    { key: 'ph', label: 'Изменить телефон', onClick: () => setContact({ card: r, field: 'phone' }) },
    { type: 'divider' },
    { key: 'rel', label: 'Деактивировать', danger: true, onClick: () => setReleasing(r) },
  ])

  const { onRow: onTxRow, menu: txMenu } = useRowMenu<CardTxn>((r) => [
    r.card_id && {
      key: 'card',
      label: 'Все покупки этой карты',
      onClick: () => setTxCard(r.card_id),
    },
    r.merchant_name && {
      key: 'm',
      label: 'Копировать мерчанта',
      onClick: () => navigator.clipboard.writeText(r.merchant_name!),
    },
    r.txn_id && {
      key: 't',
      label: 'Копировать ID транзакции',
      onClick: () => navigator.clipboard.writeText(r.txn_id),
    },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {cardMenu}
      {txMenu}
      <AntCard title="Виртуальные карты" size="small">
        <Space size={32} wrap>
          <Statistic
            title="Баланс VCC-аккаунта"
            value={Number(balance.data?.balance ?? 0)}
            precision={2}
            suffix={balance.data?.currency ?? 'USD'}
            loading={balance.isFetching}
            valueStyle={{ fontWeight: 700 }}
          />
          <Statistic
            title="В обработке"
            value={Number(balance.data?.pending ?? 0)}
            precision={2}
            suffix={balance.data?.currency ?? 'USD'}
            valueStyle={{ color: '#d46b08' }}
          />
          <Statistic title="Карт всего" value={cards.data?.total ?? list.length} />
          <Statistic title="Активных" value={active} valueStyle={{ color: '#389e0d' }} />
          <Statistic title="На картах" value={onCards} precision={2} suffix="USD" />
        </Space>

        {Number(balance.data?.balance ?? 0) < 20 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
            message={`Баланс аккаунта низкий: ${usd(balance.data?.balance)} — выпуск и пополнение карт могут не пройти`}
          />
        )}
      </AntCard>

      <AntCard size="small">
        <Tabs
          items={[
            {
              key: 'cards',
              label: `Карты · ${list.length}`,
              children: (
                <>
                  <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
                    <Field label="Поиск по ID карты">
                      <Input.Search
                        allowClear
                        placeholder="card_id…"
                        style={{ width: 240 }}
                        onSearch={(v) => setSearch(v || undefined)}
                      />
                    </Field>
                    <Field label="Статус">
                      <Select
                        allowClear
                        placeholder="Все"
                        style={{ width: 180 }}
                        value={status}
                        onChange={setStatus}
                        options={Object.entries(CARD_STATUS).map(([value, { label }]) => ({
                          value,
                          label,
                        }))}
                      />
                    </Field>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setCreating(true)}
                    >
                      Выпустить карту
                    </Button>
                  </Space>

                  <Toolbar
                    total={cards.data?.total}
                    loading={cards.isFetching}
                    onRefresh={refetchAll}
                  />

                  <Table
                    dataSource={list}
                    loading={cards.isFetching}
                    rowKey="card_id"
                    size="small"
                    pagination={{ pageSize: 20 }}
                    scroll={{ x: 1100 }}
                    onRow={onCardRow}
                  >
                    {/* Номер приходит уже замаскированным с бэкенда: полный PAN
                        отдаётся только по кнопке «реквизиты». */}
                    <Table.Column
                      dataIndex="card_no"
                      title="Номер"
                      width={180}
                      fixed="left"
                      render={(v: string) => <Text code>{v}</Text>}
                    />
                    <Table.Column
                      dataIndex="status"
                      title="Статус"
                      width={140}
                      render={(v: string, r: Card) => (
                        <Tag color={CARD_STATUS[v]?.color ?? 'default'}>
                          {CARD_STATUS[v]?.label ?? r.status_display}
                        </Tag>
                      )}
                    />
                    <Table.Column
                      dataIndex="balance"
                      title="Баланс"
                      width={110}
                      align="right"
                      sorter={(a: Card, b: Card) => a.balance - b.balance}
                      render={(v: number, r: Card) => <Text strong>{usd(v, r.currency)}</Text>}
                    />
                    <Table.Column
                      dataIndex="used_amt"
                      title="Потрачено"
                      width={110}
                      align="right"
                      render={(v: number, r: Card) => (v == null ? '—' : usd(v, r.currency))}
                    />
                    <Table.Column dataIndex="exp_date" title="Срок" width={90} />
                    <Table.Column
                      dataIndex="card_id"
                      title="ID карты"
                      width={210}
                      render={(v: string) => <Text copyable style={{ fontSize: 11 }}>{v}</Text>}
                    />
                    <Table.Column
                      dataIndex="created_at"
                      title="Выпущена"
                      width={140}
                      render={(v: string) => dt(v)}
                    />
                    <Table.Column
                      title="Действия"
                      width={150}
                      fixed="right"
                      render={(_: unknown, r: Card) => (
                        <Space size={4}>
                          <Button
                            size="small"
                            icon={<EyeOutlined />}
                            title="Реквизиты"
                            onClick={() => setRevealing(r)}
                          />
                          <Button
                            size="small"
                            icon={<ArrowUpOutlined />}
                            title="Пополнить"
                            onClick={() => setAmount({ card: r, mode: 'topup' })}
                          />
                          <Button
                            size="small"
                            icon={<ArrowDownOutlined />}
                            title="Вывести"
                            onClick={() => setAmount({ card: r, mode: 'withdraw' })}
                          />
                          <Dropdown
                            menu={{
                              items: [
                                {
                                  key: 'email',
                                  label: 'Изменить email',
                                  onClick: () => setContact({ card: r, field: 'email' }),
                                },
                                {
                                  key: 'phone',
                                  label: 'Изменить телефон',
                                  onClick: () => setContact({ card: r, field: 'phone' }),
                                },
                                { type: 'divider' },
                                {
                                  key: 'release',
                                  label: 'Деактивировать',
                                  danger: true,
                                  icon: <StopOutlined />,
                                  onClick: () => setReleasing(r),
                                },
                              ],
                            }}
                          >
                            <Button size="small" icon={<MoreOutlined />} />
                          </Dropdown>
                        </Space>
                      )}
                    />
                  </Table>
                </>
              ),
            },
            {
              key: 'txns',
              label: `Покупки · ${txns.data?.transactions?.length ?? 0}`,
              children: (
                <>
                  <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
                    <Field label="Карта">
                      <Select
                        allowClear
                        showSearch
                        placeholder="Все карты"
                        style={{ width: 240 }}
                        value={txCard}
                        onChange={(v) => setTxCard(v ?? undefined)}
                        filterOption={(i, o) => String(o?.label ?? '').includes(i)}
                        options={list.map((c) => ({
                          value: c.card_id,
                          label: `${c.card_no} · ${usd(c.balance, c.currency)}`,
                        }))}
                      />
                    </Field>
                    <Field label="Тип">
                      <Select
                        allowClear
                        placeholder="Все"
                        style={{ width: 150 }}
                        value={txType}
                        onChange={(v) => setTxType(v ?? undefined)}
                        options={[
                          { value: 'A', label: 'Покупка' },
                          { value: 'R', label: 'Возврат' },
                        ]}
                      />
                    </Field>
                    <Field label="Период">
                      <DatePicker.RangePicker
                        format="DD.MM.YYYY"
                        style={{ width: 240 }}
                        value={txRange}
                        onChange={(v) => setTxRange(v?.[0] && v?.[1] ? [v[0], v[1]] : null)}
                      />
                    </Field>
                  </Space>

                  <Toolbar
                    total={txns.data?.transactions?.length}
                    loading={txns.isFetching}
                    onRefresh={() => txns.refetch()}
                  />

                  <Table
                    dataSource={txns.data?.transactions ?? []}
                    loading={txns.isFetching}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 20 }}
                    scroll={{ x: 1150 }}
                    onRow={onTxRow}
                  >
                    <Table.Column
                      dataIndex="txn_time"
                      title="Когда"
                      width={140}
                      defaultSortOrder="descend"
                      sorter={(a: CardTxn, b: CardTxn) =>
                        dayjs(a.txn_time).valueOf() - dayjs(b.txn_time).valueOf()
                      }
                      render={(v: string) => dt(v)}
                    />
                    <Table.Column
                      dataIndex="type"
                      title="Тип"
                      width={100}
                      render={(v: string, r: CardTxn) => (
                        <Tag color={v === 'R' ? 'purple' : 'blue'}>{r.type_display}</Tag>
                      )}
                    />
                    <Table.Column
                      dataIndex="status"
                      title="Статус"
                      width={110}
                      render={(v: string, r: CardTxn) => (
                        <Tag color={v === '1' ? 'success' : 'error'}>{r.status_display}</Tag>
                      )}
                    />
                    <Table.Column
                      dataIndex="merchant_name"
                      title="Мерчант"
                      width={260}
                      ellipsis
                      render={(v: string, r: CardTxn) => (
                        <Space direction="vertical" size={0}>
                          <Text style={{ fontSize: 12 }}>{v ?? '—'}</Text>
                          {r.merchant_country && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {r.merchant_country}
                              {r.mcc ? ` · MCC ${r.mcc}` : ''}
                            </Text>
                          )}
                        </Space>
                      )}
                    />
                    <Table.Column
                      title="Сумма покупки"
                      width={140}
                      align="right"
                      render={(_: unknown, r: CardTxn) => (
                        <Text>
                          {r.txn_amount} {r.txn_currency}
                        </Text>
                      )}
                    />
                    <Table.Column
                      title="Списано"
                      width={120}
                      align="right"
                      render={(_: unknown, r: CardTxn) => (
                        <Text strong>{usd(r.bill_amount, r.bill_currency)}</Text>
                      )}
                    />
                    <Table.Column
                      dataIndex="card_id"
                      title="Карта"
                      width={200}
                      render={(v: string) => {
                        const c = list.find((x) => x.card_id === v)
                        return c ? (
                          <a onClick={() => setTxCard(v)}>{c.card_no}</a>
                        ) : (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            {v}
                          </Text>
                        )
                      }}
                    />
                    <Table.Column
                      dataIndex="decline_reason"
                      title="Причина отказа"
                      ellipsis
                      render={(v: string) => (v ? <Text type="danger">{v}</Text> : '—')}
                    />
                  </Table>
                </>
              ),
            },
          ]}
        />
      </AntCard>

      <Modal
        open={creating}
        title="Выпустить виртуальную карту"
        okText="Выпустить"
        cancelText="Отмена"
        confirmLoading={create.isPending}
        onOk={() => create.mutate()}
        onCancel={() => {
          setCreating(false)
          form.resetFields()
        }}
        width={520}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Сумма спишется с баланса VCC-аккаунта"
          description={`Доступно сейчас: ${usd(balance.data?.balance)}. Выпуск карты — операция с реальными деньгами.`}
        />
        <Form form={form} layout="vertical" size="small">
          <Form.Item
            name="amount"
            label="Сумма на карте после выпуска"
            rules={[{ required: true, message: 'Обязательно' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0.01} step={1} precision={2} addonAfter="USD" />
          </Form.Item>
          <Form.Item
            name="expdate"
            label="Срок действия"
            extra="Больше 30 дней и меньше 4 лет. По умолчанию — год."
          >
            <DatePicker
              style={{ width: '100%' }}
              format="DD.MM.YYYY"
              disabledDate={(d) =>
                d.isBefore(dayjs().add(31, 'day')) || d.isAfter(dayjs().add(4, 'year'))
              }
            />
          </Form.Item>
          <Form.Item
            name="network"
            label="Сеть списания USDT"
            initialValue="trc20"
            extra="По умолчанию trc20"
          >
            <Select
              options={[
                { value: 'trc20', label: 'TRC20' },
                { value: 'bep20', label: 'BEP20' },
                { value: 'erc20', label: 'ERC20' },
              ]}
            />
          </Form.Item>
          <Form.Item name="callback_url" label="URL уведомлений">
            <Input placeholder="https://example.com/vcc-webhook" />
          </Form.Item>
        </Form>
      </Modal>

      <RevealModal card={revealing} onClose={() => setRevealing(null)} />

      <AmountModal
        card={amount?.card ?? null}
        mode={amount?.mode ?? 'topup'}
        onClose={() => setAmount(null)}
        onDone={refetchAll}
      />

      <ContactModal
        card={contact?.card ?? null}
        field={contact?.field ?? 'email'}
        onClose={() => setContact(null)}
        onDone={refetchAll}
      />

      <DangerConfirm
        open={!!releasing}
        title="Деактивировать карту?"
        what={`Карта ${releasing?.card_no} будет закрыта безвозвратно. Остаток ${usd(releasing?.balance, releasing?.currency)} вернётся на баланс аккаунта. Оплаты по ней перестанут проходить.`}
        confirmWord="ДЕАКТИВИРОВАТЬ"
        okText="Деактивировать"
        loading={release.isPending}
        onOk={() => release.mutate()}
        onCancel={() => setReleasing(null)}
      />
    </Space>
  )
}
