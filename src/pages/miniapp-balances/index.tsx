import { useQuery } from '@tanstack/react-query'
import { Card, Space, Statistic, Typography, Alert, Descriptions } from 'antd'
import { Toolbar } from '../../components/Toolbar'

const { Text } = Typography

type MasterWallet = { address?: string | null; usdt?: number | null; error?: string | null }

const usdtFmt = (v?: number | null) =>
  v == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 6 }).format(v)

/** Мастер-счёт мини-аппа: кошелёк выплат и его баланс USDT. Больше ничего. */
export const MiniappBalances = () => {
  const q = useQuery({
    queryKey: ['miniapp-master-wallet'],
    queryFn: async () => {
      const r = await fetch('/api/miniapp/balances')
      const b = await r.json().catch(() => null)
      if (!r.ok || b?.success === false) throw new Error(b?.error ?? `Ошибка ${r.status}`)
      return b as MasterWallet
    },
    refetchInterval: 60_000,
  })

  const w = q.data

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card title="Мастер-счёт" size="small">
        <Toolbar loading={q.isFetching} onRefresh={() => q.refetch()} />

        {q.isError && (
          <Alert
            type="error"
            showIcon
            style={{ marginTop: 12 }}
            message="Не удалось получить баланс"
            description={(q.error as Error)?.message}
          />
        )}
        {w?.error && (
          <Alert
            type="warning"
            showIcon
            style={{ marginTop: 12 }}
            message="Кошелёк недоступен"
            description={w.error}
          />
        )}

        <div style={{ marginTop: 16 }}>
          <Statistic
            title="Баланс мастер-кошелька"
            value={w?.usdt ?? 0}
            precision={2}
            suffix="USDT"
            loading={q.isLoading}
            valueStyle={{ fontWeight: 700, fontSize: 34, color: '#3f8600' }}
          />
        </div>

        <Descriptions
          size="small"
          column={1}
          bordered
          style={{ marginTop: 16 }}
          items={[
            {
              key: 'a',
              label: 'Счёт (адрес кошелька)',
              children: w?.address ? (
                <Text copyable strong style={{ fontFamily: 'ui-monospace, monospace' }}>
                  {w.address}
                </Text>
              ) : (
                <Text type="secondary">—</Text>
              ),
            },
            {
              key: 'u',
              label: 'Баланс, точно',
              children: <Text strong>{usdtFmt(w?.usdt)} USDT</Text>,
            },
          ]}
        />
      </Card>
    </Space>
  )
}
