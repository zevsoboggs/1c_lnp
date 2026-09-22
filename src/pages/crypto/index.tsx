import { useState } from 'react'
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
  Modal,
  InputNumber,
  Tooltip,
} from 'antd'
import { PlusOutlined, MinusOutlined, WalletOutlined } from '@ant-design/icons'
import { dt } from '../../lib/format'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { StatusTag } from '../../components/StatusTag'
import { DataTable } from '../../components/DataTable'
import { PartnerSelect } from '../../components/PartnerSelect'
import { useRowMenu } from '../../components/useRowMenu'
import { canWrite } from '../../api/accessControl'
import {
  cryptoApi,
  type CryptoCompanyWallet,
  type CryptoInvoice,
  type CryptoLedgerEntry,
  type CryptoPartnerBalance,
  type CryptoPayout,
} from '../../api/crypto'

const { Text } = Typography

/** USDT без хвостовых нулей: 25.037, а не 25.037000. */
const usdt = (v: number | null | undefined) =>
  v == null ? '—' : `${Number(v).toFixed(6).replace(/\.?0+$/, '')} USDT`
const short = (a: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

const INVOICE_STATUS = [
  { value: 'PENDING', label: 'Ждёт оплаты', color: 'processing' },
  { value: 'PAID', label: 'Оплачен', color: 'success' },
  { value: 'EXPIRED', label: 'Истёк', color: 'default' },
  { value: 'CANCELLED', label: 'Отменён', color: 'warning' },
]

const PAYOUT_STATUS = [
  { value: 'PENDING', label: 'В обработке', color: 'processing' },
  { value: 'COMPLETED', label: 'Прошла', color: 'success' },
  { value: 'FAILED', label: 'Не прошла', color: 'error' },
]

const LEDGER_TYPE: Record<string, { label: string; color: string }> = {
  INVOICE_PAID: { label: 'Оплата счёта', color: 'green' },
  PAYOUT: { label: 'Выплата', color: 'default' },
  PAYOUT_REVERSAL: { label: 'Возврат списания', color: 'blue' },
  ADJUSTMENT: { label: 'Корректировка', color: 'purple' },
}

/**
 * Криптоплатежи: сводка по кошелькам компании против обязательств перед
 * партнёрами, счета, выплаты, проводки и балансы. Наценка и комиссия за
 * вывод правятся в карточке партнёра.
 */
export const CryptoPage = () => {
  const { message } = App.useApp()
  const write = canWrite('crypto')

  const [partner, setPartner] = useState<string>()
  const [invStatus, setInvStatus] = useState<string>()
  const [invSearch, setInvSearch] = useState<string>()
  const [payStatus, setPayStatus] = useState<string>()
  const [ledgerType, setLedgerType] = useState<string>()
  const [adjusting, setAdjusting] = useState<{ partnerId: string; name: string | null } | null>(null)

  const overview = useQuery({ queryKey: ['crypto-overview'], queryFn: cryptoApi.overview })
  const invoices = useQuery({
    queryKey: ['crypto-invoices', partner, invStatus, invSearch],
    queryFn: () => cryptoApi.invoices({ partnerId: partner, status: invStatus, search: invSearch, limit: 200 }),
  })
  const payouts = useQuery({
    queryKey: ['crypto-payouts', partner, payStatus],
    queryFn: () => cryptoApi.payouts({ partnerId: partner, status: payStatus, limit: 200 }),
  })
  const ledger = useQuery({
    queryKey: ['crypto-ledger', partner, ledgerType],
    queryFn: () => cryptoApi.ledger({ partnerId: partner, type: ledgerType, limit: 200 }),
  })
  const balances = useQuery({ queryKey: ['crypto-balances'], queryFn: cryptoApi.balances })

  const refetchAll = () => {
    overview.refetch()
    invoices.refetch()
    payouts.refetch()
    ledger.refetch()
    balances.refetch()
  }

  const o = overview.data
  const surplusLow = o?.surplus != null && o.surplus < 0

  const { onRow: onInvoiceRow, menu: invoiceMenu } = useRowMenu<CryptoInvoice>((r) => [
    { key: 'addr', label: 'Копировать адрес', onClick: () => navigator.clipboard.writeText(r.address) },
    { key: 'num', label: 'Копировать номер', onClick: () => navigator.clipboard.writeText(r.number) },
    r.depositOperationId && {
      key: 'dep',
      label: 'Копировать id депозита',
      onClick: () => navigator.clipboard.writeText(r.depositOperationId!),
    },
    { type: 'divider' as const },
    { key: 'ledger', label: 'Проводки партнёра', onClick: () => setPartner(r.partnerId) },
  ])

  const { onRow: onBalanceRow, menu: balanceMenu } = useRowMenu<CryptoPartnerBalance>((r) => [
    write && { key: 'adj', label: 'Корректировка баланса', onClick: () => setAdjusting({ partnerId: r.partnerId, name: r.partnerName }) },
    { key: 'filter', label: 'Показать операции партнёра', onClick: () => setPartner(r.partnerId) },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {invoiceMenu}
      {balanceMenu}

      <Card title="Криптоплатежи (USDT)" size="small">
        {o && !o.configured && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="Процессинг не настроен"
            description={o.error ?? 'На сервере не заданы CRYPTO_PROCESSING_API_KEY и CRYPTO_PROCESSING_ACCOUNT.'}
          />
        )}
        {o?.configured && o.error && (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={`Кошельки компании не прочитались: ${o.error}`} />
        )}

        <Space size={32} wrap>
          <Statistic
            title="USDT на кошельках компании"
            value={o?.usdtOnWallets ?? 0}
            precision={2}
            suffix="USDT"
            loading={overview.isFetching}
            valueStyle={{ fontWeight: 700 }}
          />
          <Statistic
            title="Должны партнёрам"
            value={o?.liabilities ?? 0}
            precision={2}
            suffix="USDT"
            loading={overview.isFetching}
            valueStyle={{ color: '#b25e09' }}
          />
          <Statistic
            title="Наше сверх обязательств"
            value={o?.surplus ?? 0}
            precision={2}
            suffix="USDT"
            loading={overview.isFetching}
            valueStyle={{ color: surplusLow ? '#c93838' : '#1a7f37' }}
          />
          <Statistic title="Партнёров с балансом" value={o?.partnersWithBalance ?? 0} />
          <Statistic title="Ждут оплаты" value={o?.counts?.PENDING ?? 0} valueStyle={{ color: '#1668dc' }} />
          <Statistic title="Оплачено" value={o?.counts?.PAID ?? 0} valueStyle={{ color: '#1a7f37' }} />
        </Space>

        {surplusLow && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 12 }}
            message="На кошельках меньше, чем должны партнёрам — выплаты могут не пройти. Пополните кошелёк компании."
          />
        )}

        {o && o.wallets.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <Text strong>Кошельки компании</Text>
            <Table
              size="small"
              pagination={false}
              rowKey="network"
              dataSource={o.wallets}
              style={{ marginTop: 8 }}
              columns={[
                { title: 'Сеть', dataIndex: 'label', width: 180, render: (v: string, r: CryptoCompanyWallet) => `${v}${r.usdtNetwork ? ` · ${r.usdtNetwork}` : ''}` },
                {
                  title: 'Адрес',
                  dataIndex: 'address',
                  render: (v: string | null) => (v ? <Text copyable code style={{ fontSize: 11 }}>{v}</Text> : '—'),
                },
                {
                  title: 'Остатки',
                  dataIndex: 'balances',
                  render: (list: CryptoCompanyWallet['balances'], r: CryptoCompanyWallet) =>
                    r.stale ? (
                      <Tag color="warning">остаток не прочитан</Tag>
                    ) : (
                      <Space size={4} wrap>
                        {list.map((b) => (
                          <Tag key={b.symbol} color={b.isUsdt ? 'green' : 'default'}>
                            {b.symbol}: {Number(b.amount).toFixed(b.isUsdt ? 2 : 4)}
                          </Tag>
                        ))}
                      </Space>
                    ),
                },
              ]}
            />
          </div>
        )}
      </Card>

      <Card size="small">
        <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
          <Field label="Партнёр">
            <PartnerSelect value={partner} onChange={(v) => setPartner(v)} />
          </Field>
          <Toolbar loading={overview.isFetching} onRefresh={refetchAll} />
        </Space>

        <Tabs
          items={[
            {
              key: 'invoices',
              label: `Счета · ${invoices.data?.pagination.total ?? 0}`,
              children: (
                <>
                  <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
                    <Field label="Статус">
                      <Select allowClear placeholder="Все" style={{ width: 160 }} value={invStatus} onChange={setInvStatus} options={INVOICE_STATUS.map(({ value, label }) => ({ value, label }))} />
                    </Field>
                    <Field label="Поиск">
                      <Input.Search allowClear placeholder="номер, адрес, внешний id" style={{ width: 260 }} onSearch={(v) => setInvSearch(v || undefined)} />
                    </Field>
                  </Space>

                  <DataTable dataSource={invoices.data?.invoices ?? []} loading={invoices.isFetching} rowKey="id" size="small" pagination={{ pageSize: 25 }} scroll={{ x: 1300 }} onRow={onInvoiceRow}>
                    <Table.Column dataIndex="createdAt" title="Создан" width={140} fixed="left" render={(v: string) => dt(v)} />
                    <Table.Column dataIndex="number" title="Номер" width={180} render={(v: string) => <Text code>{v}</Text>} />
                    <Table.Column dataIndex="partnerName" title="Партнёр" width={200} render={(v: string | null) => v ?? '—'} />
                    <Table.Column dataIndex="status" title="Статус" width={120} render={(v: string) => <StatusTag list={INVOICE_STATUS} value={v} />} />
                    <Table.Column
                      dataIndex="expectedAmountText"
                      title="К оплате"
                      width={130}
                      align="right"
                      render={(v: string, r: CryptoInvoice) => (
                        <Tooltip title={`Запрошено ${usdt(r.amount)}`}>
                          <Text strong>{v} USDT</Text>
                        </Tooltip>
                      )}
                    />
                    <Table.Column dataIndex="feeAmount" title="Наша наценка" width={130} align="right" render={(v: number, r: CryptoInvoice) => `${usdt(v)} (${r.feePercent}%)`} />
                    <Table.Column dataIndex="netAmount" title="Партнёру" width={120} align="right" render={(v: number) => usdt(v)} />
                    <Table.Column dataIndex="usdtNetwork" title="Сеть" width={90} />
                    <Table.Column dataIndex="description" title="Назначение" ellipsis render={(v: string | null) => v ?? <Text type="secondary">—</Text>} />
                    <Table.Column dataIndex="paidAt" title="Оплачен" width={140} render={(v: string | null, r: CryptoInvoice) => (v ? `${dt(v)} · ${usdt(r.paidAmount)}` : '—')} />
                    <Table.Column dataIndex="expiresAt" title="Действует до" width={140} render={(v: string) => dt(v)} />
                  </DataTable>
                </>
              ),
            },
            {
              key: 'payouts',
              label: `Выплаты · ${payouts.data?.pagination.total ?? 0}`,
              children: (
                <>
                  <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
                    <Field label="Статус">
                      <Select allowClear placeholder="Все" style={{ width: 160 }} value={payStatus} onChange={setPayStatus} options={PAYOUT_STATUS.map(({ value, label }) => ({ value, label }))} />
                    </Field>
                  </Space>

                  <DataTable dataSource={payouts.data?.payouts ?? []} loading={payouts.isFetching} rowKey="id" size="small" pagination={{ pageSize: 25 }} scroll={{ x: 1200 }}>
                    <Table.Column dataIndex="createdAt" title="Создана" width={140} fixed="left" render={(v: string) => dt(v)} />
                    <Table.Column dataIndex="partnerName" title="Партнёр" width={200} render={(v: string | null) => v ?? '—'} />
                    <Table.Column dataIndex="status" title="Статус" width={120} render={(v: string, r: CryptoPayout) => (
                      <Space direction="vertical" size={0}>
                        <StatusTag list={PAYOUT_STATUS} value={v} />
                        {r.error && <Text type="danger" style={{ fontSize: 11 }}>{r.error}</Text>}
                      </Space>
                    )} />
                    <Table.Column dataIndex="amount" title="Сумма" width={120} align="right" render={(v: number) => <Text strong>{usdt(v)}</Text>} />
                    <Table.Column dataIndex="fee" title="Комиссия" width={110} align="right" render={(v: number) => usdt(v)} />
                    <Table.Column dataIndex="total" title="Списано" width={120} align="right" render={(v: number) => usdt(v)} />
                    <Table.Column dataIndex="address" title="Адрес" width={160} render={(v: string) => <Text copyable={{ text: v }} code style={{ fontSize: 11 }}>{short(v)}</Text>} />
                    <Table.Column dataIndex="networkLabel" title="Сеть" width={110} />
                    <Table.Column dataIndex="attempts" title="Попыток" width={90} align="center" />
                    <Table.Column dataIndex="processingId" title="Перевод у процессинга" width={200} render={(v: string | null) => (v ? <Text copyable style={{ fontSize: 11 }}>{v}</Text> : '—')} />
                    <Table.Column dataIndex="note" title="Комментарий" ellipsis render={(v: string | null) => v ?? '—'} />
                  </DataTable>
                </>
              ),
            },
            {
              key: 'balances',
              label: `Балансы · ${balances.data?.balances.length ?? 0}`,
              children: (
                <>
                  <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
                    {write && (
                      <Button icon={<PlusOutlined />} onClick={() => setAdjusting({ partnerId: partner ?? '', name: null })}>
                        Корректировка баланса
                      </Button>
                    )}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Остаток каждого партнёра — сумма его проводок. Правится только корректировкой.
                    </Text>
                  </Space>

                  <DataTable dataSource={balances.data?.balances ?? []} loading={balances.isFetching} rowKey="partnerId" size="small" pagination={false} onRow={onBalanceRow}>
                    <Table.Column dataIndex="partnerName" title="Партнёр" render={(v: string | null, r: CryptoPartnerBalance) => v ?? r.partnerId} />
                    <Table.Column
                      dataIndex="balance"
                      title="Баланс"
                      width={180}
                      align="right"
                      sorter={(a: CryptoPartnerBalance, b: CryptoPartnerBalance) => a.balance - b.balance}
                      render={(v: number) => <Text strong style={{ color: v < 0 ? '#c93838' : undefined }}>{usdt(v)}</Text>}
                    />
                    {write && (
                      <Table.Column
                        title="Действия"
                        width={160}
                        render={(_: unknown, r: CryptoPartnerBalance) => (
                          <Button size="small" icon={<WalletOutlined />} onClick={() => setAdjusting({ partnerId: r.partnerId, name: r.partnerName })}>
                            Корректировка
                          </Button>
                        )}
                      />
                    )}
                  </DataTable>
                </>
              ),
            },
            {
              key: 'ledger',
              label: `Проводки · ${ledger.data?.pagination.total ?? 0}`,
              children: (
                <>
                  <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
                    <Field label="Тип">
                      <Select allowClear placeholder="Все" style={{ width: 200 }} value={ledgerType} onChange={setLedgerType} options={Object.entries(LEDGER_TYPE).map(([value, { label }]) => ({ value, label }))} />
                    </Field>
                  </Space>

                  <DataTable dataSource={ledger.data?.entries ?? []} loading={ledger.isFetching} rowKey="id" size="small" pagination={{ pageSize: 25 }} scroll={{ x: 1000 }}>
                    <Table.Column dataIndex="createdAt" title="Дата" width={140} fixed="left" render={(v: string) => dt(v)} />
                    <Table.Column dataIndex="partnerName" title="Партнёр" width={200} render={(v: string | null, r: CryptoLedgerEntry) => v ?? r.partnerId} />
                    <Table.Column dataIndex="type" title="Тип" width={150} render={(v: string) => <Tag color={LEDGER_TYPE[v]?.color ?? 'default'}>{LEDGER_TYPE[v]?.label ?? v}</Tag>} />
                    <Table.Column dataIndex="amount" title="Сумма" width={140} align="right" render={(v: number) => <Text style={{ color: v >= 0 ? '#1a7f37' : undefined }}>{v >= 0 ? '+' : ''}{usdt(v)}</Text>} />
                    <Table.Column dataIndex="balanceAfter" title="Остаток" width={140} align="right" render={(v: number) => usdt(v)} />
                    <Table.Column dataIndex="comment" title="Комментарий" ellipsis render={(v: string | null) => v ?? '—'} />
                  </DataTable>
                </>
              ),
            },
          ]}
        />
      </Card>

      <AdjustModal
        target={adjusting}
        onClose={() => setAdjusting(null)}
        onDone={() => {
          message.success('Корректировка проведена')
          refetchAll()
        }}
      />
    </Space>
  )
}

/**
 * Корректировка баланса партнёра: встречная проводка с обязательной причиной.
 * Отрицательная сумма уводит баланс в минус — так и задумано, если оператор
 * закрывает ошибочное зачисление.
 */
function AdjustModal({
  target,
  onClose,
  onDone,
}: {
  target: { partnerId: string; name: string | null } | null
  onClose: () => void
  onDone: () => void
}) {
  const { message } = App.useApp()
  const [partnerId, setPartnerId] = useState<string | undefined>(undefined)
  const [amount, setAmount] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [sign, setSign] = useState<1 | -1>(1)

  const effectivePartner = partnerId ?? (target?.partnerId || undefined)

  const run = useMutation({
    mutationFn: () => cryptoApi.adjust({ partnerId: effectivePartner!, amount: sign * Math.abs(amount ?? 0), comment: comment.trim() }),
    onSuccess: (r) => {
      message.info(`Баланс партнёра теперь ${usdt(r.balance)}`)
      reset()
      onDone()
      onClose()
    },
    onError: (e: Error) => message.error(e.message, 8),
  })

  const reset = () => {
    setPartnerId(undefined)
    setAmount(null)
    setComment('')
    setSign(1)
  }

  return (
    <Modal
      open={!!target}
      title={`Корректировка баланса${target?.name ? ` · ${target.name}` : ''}`}
      okText={sign > 0 ? 'Зачислить' : 'Списать'}
      okButtonProps={{ danger: sign < 0, disabled: !effectivePartner || !amount || comment.trim() === '' }}
      confirmLoading={run.isPending}
      onOk={() => run.mutate()}
      onCancel={() => {
        reset()
        onClose()
      }}
      destroyOnClose
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {!target?.partnerId && (
          <div>
            <Text style={{ display: 'block', marginBottom: 4 }}>Партнёр</Text>
            <PartnerSelect value={partnerId} onChange={(v) => setPartnerId(v)} />
          </div>
        )}
        <div>
          <Text style={{ display: 'block', marginBottom: 4 }}>Направление</Text>
          <Space>
            <Button type={sign > 0 ? 'primary' : 'default'} icon={<PlusOutlined />} onClick={() => setSign(1)}>
              Зачислить
            </Button>
            <Button type={sign < 0 ? 'primary' : 'default'} danger={sign < 0} icon={<MinusOutlined />} onClick={() => setSign(-1)}>
              Списать
            </Button>
          </Space>
        </div>
        <div>
          <Text style={{ display: 'block', marginBottom: 4 }}>Сумма</Text>
          <InputNumber style={{ width: '100%' }} min={0.000001} step={1} precision={6} value={amount} onChange={setAmount} addonAfter="USDT" />
        </div>
        <div>
          <Text style={{ display: 'block', marginBottom: 4 }}>Причина — попадёт в проводку и в аудит</Text>
          <Input.TextArea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Например: депозит 25 USDT вместо 25.037 по счёту CR-…" />
        </div>
        <Alert
          type="warning"
          showIcon
          message="Проводка не редактируется и не удаляется. Ошибку можно исправить только встречной корректировкой."
        />
      </Space>
    </Modal>
  )
}
