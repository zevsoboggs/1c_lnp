import { useQuery } from '@tanstack/react-query'
import { Badge, Tooltip, Space, Typography } from 'antd'

const { Text } = Typography

type Ping = {
  status: 'ok' | 'degraded'
  latencyMs: number
  checks: Record<string, { ok: boolean; error?: string }>
}

/** Индикатор /v1/ping: БД и Redis прода. Опрашивается раз в 30 секунд. */
export function HealthBadge() {
  const { data, isError } = useQuery<Ping>({
    queryKey: ['ping'],
    queryFn: async () => {
      const r = await fetch('/admin-api/v1/ping')
      // 503 — это валидный ответ ping: degraded, а не сбой запроса.
      const b = await r.json()
      if (!b || typeof b.status !== 'string') throw new Error('ping недоступен')
      return b as Ping
    },
    refetchInterval: 30_000,
    retry: 1,
  })

  const failed = data ? Object.entries(data.checks).filter(([, v]) => !v.ok) : []
  const status = isError ? 'default' : data?.status === 'ok' ? 'success' : 'error'
  const text = isError ? 'нет связи' : data ? (data.status === 'ok' ? 'всё живо' : 'сбой') : '…'

  const tip = isError
    ? 'Не удалось получить /v1/ping'
    : data
      ? [
          ...Object.entries(data.checks).map(
            ([k, v]) => `${k}: ${v.ok ? 'ok' : `сбой${v.error ? ` — ${v.error}` : ''}`}`,
          ),
          `задержка ${data.latencyMs} мс`,
        ].join('\n')
      : ''

  return (
    <Tooltip title={<span style={{ whiteSpace: 'pre-line' }}>{tip}</span>} placement="right">
      <Space size={6} style={{ padding: '8px 12px', cursor: 'default' }}>
        <Badge status={status as any} />
        <Text style={{ fontSize: 11, color: '#7a7259' }}>
          {text}
          {failed.length > 0 && `: ${failed.map(([k]) => k).join(', ')}`}
          {data?.status === 'ok' && ` · ${data.latencyMs} мс`}
        </Text>
      </Space>
    </Tooltip>
  )
}
