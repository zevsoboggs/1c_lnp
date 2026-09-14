import { useQuery } from '@tanstack/react-query'
import { Card, Space, Statistic, Typography, Alert, Descriptions, Tag, Divider } from 'antd'
import { WalletOutlined, BankOutlined, TeamOutlined } from '@ant-design/icons'
import { Toolbar } from '../../components/Toolbar'

const { Text, Title } = Typography

type Balances = {
  userInternalBalanceRubTotal?: number
  masterWallet?: { address?: string; usdt?: number; trx?: number; error?: string }
  sbpProviderFloat?: { balanceRub?: number; currency?: string; account?: string; error?: string }
}

const rub = (v?: number) =>
  v == null ? '—' : new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + ' ₽'
const num = (v?: number, digits = 6) =>
  v == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits }).format(v)

/**
 * Мастер-счёт мини-аппа: где лежат деньги платформы.
 *
 * Суммы приходят готовыми из мини-аппа (/api/admin/dashboard/balances):
 * кошелёк TRON, с которого уходят выплаты, остаток у СБП-провайдера и сколько
 * всего мы должны пользователям по их внутренним балансам.
 */
export const MiniappBalances = () => {
  const q = useQuery({
    queryKey: ['miniapp-balances'],
    queryFn: async () => {
      const r = await fetch('/api/miniapp/balances')
      const b = await r.json().catch(() => null)
      if (!r.ok || b?.success === false) throw new Error(b?.error ?? `Ошибка ${r.status}`)
      return b as Balances
    },
    refetchInterval: 60_000,
  })

  const d = q.data
  const mw = d?.masterWallet
  const sbp = d?.sbpProviderFloat

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card title="Мастер-счёт" size="small">
        <Toolbar loading={q.isFetching} onRefresh={() => q.refetch()} />

        {q.isError && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 12 }}
            message="Не удалось получить балансы"
            description={(q.error as Error)?.message}
          />
        )}

        <Space size={40} wrap style={{ marginTop: 12 }}>
          <Statistic
            title={<><WalletOutlined /> Мастер-кошелёк, USDT</>}
            value={mw?.usdt ?? 0}
            precision={2}
            suffix="USDT"
            loading={q.isLoading}
            valueStyle={{ fontWeight: 700, color: '#3f8600' }}
          />
          <Statistic
            title={<><BankOutlined /> Остаток у СБП-провайдера</>}
            value={sbp?.balanceRub ?? 0}
            precision={2}
            suffix="₽"
            loading={q.isLoading}
            valueStyle={{ fontWeight: 700 }}
          />
          <Statistic
            title={<><TeamOutlined /> Должны пользователям</>}
            value={d?.userInternalBalanceRubTotal ?? 0}
            precision={2}
            suffix="₽"
            loading={q.isLoading}
            valueStyle={{ color: '#d46b08' }}
          />
        </Space>
      </Card>

      <Card size="small" title="Мастер-кошелёк (TRON)" loading={q.isLoading}>
        {mw?.error ? (
          <Alert type="warning" showIcon message="Кошелёк недоступен" description={mw.error} />
        ) : (
          <Descriptions
            size="small"
            column={1}
            bordered
            items={[
              {
                key: 'a',
                label: 'Адрес',
                children: mw?.address ? (
                  <Text copyable strong style={{ fontFamily: 'ui-monospace, monospace' }}>
                    {mw.address}
                  </Text>
                ) : (
                  '—'
                ),
              },
              {
                key: 'u',
                label: 'Баланс USDT',
                children: <Text strong>{num(mw?.usdt, 6)} USDT</Text>,
              },
              {
                key: 't',
                label: 'Баланс TRX (газ)',
                children: (
                  <Space size={6}>
                    <Text>{num(mw?.trx, 6)} TRX</Text>
                    {/* На TRON без TRX не отправить перевод — это комиссия сети. */}
                    {(mw?.trx ?? 0) < 50 && <Tag color="warning">мало на комиссию</Tag>}
                  </Space>
                ),
              },
            ]}
          />
        )}
        <Divider style={{ margin: '12px 0 8px' }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          С этого кошелька уходят выплаты пользователям. TRX нужен на комиссию сети — если он
          кончится, переводы перестанут проходить даже при полном балансе USDT.
        </Text>
      </Card>

      <Card size="small" title="Счёт у СБП-провайдера" loading={q.isLoading}>
        {sbp?.error ? (
          <Alert type="warning" showIcon message="Провайдер недоступен" description={sbp.error} />
        ) : (
          <Descriptions
            size="small"
            column={1}
            bordered
            items={[
              {
                key: 'acc',
                label: 'Номер счёта',
                children: sbp?.account ? (
                  <Text copyable strong style={{ fontFamily: 'ui-monospace, monospace' }}>
                    {sbp.account}
                  </Text>
                ) : (
                  '—'
                ),
              },
              {
                key: 'b',
                label: 'Баланс',
                children: (
                  <Title level={5} style={{ margin: 0 }}>
                    {rub(sbp?.balanceRub)}
                  </Title>
                ),
              },
              { key: 'c', label: 'Валюта', children: sbp?.currency ?? '—' },
            ]}
          />
        )}
      </Card>
    </Space>
  )
}
