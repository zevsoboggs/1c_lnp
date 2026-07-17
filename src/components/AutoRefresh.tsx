import { useEffect, useState } from 'react'
import { Switch, Space, Typography, Tooltip } from 'antd'

const { Text } = Typography

const KEY = 'lnp:autorefresh'

/**
 * Тумблер автообновления списка.
 *
 * Выбор запоминается: оператор, который следит за платежами в реальном
 * времени, не должен включать это заново на каждой странице.
 */
export function useAutoRefresh(intervalMs = 5000) {
  const [on, setOn] = useState(() => localStorage.getItem(KEY) !== 'off')

  useEffect(() => {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  }, [on])

  return {
    enabled: on,
    setEnabled: setOn,
    /** Кладётся в queryOptions таблицы. */
    refetchInterval: on ? intervalMs : (false as const),
    intervalMs,
  }
}

/** Индикатор «когда обновлялось» + переключатель. */
export function AutoRefreshSwitch({
  enabled,
  onChange,
  isFetching,
  updatedAt,
  intervalMs = 5000,
}: {
  enabled: boolean
  onChange: (v: boolean) => void
  isFetching: boolean
  /** dataUpdatedAt из react-query. */
  updatedAt?: number
  intervalMs?: number
}) {
  // Тикаем раз в секунду, чтобы «N с назад» не застывало между обновлениями.
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const ago = updatedAt ? Math.max(0, Math.round((Date.now() - updatedAt) / 1000)) : null

  return (
    <Space size={6}>
      <Tooltip title={`Список сам перечитывается каждые ${intervalMs / 1000} секунд`}>
        <Switch size="small" checked={enabled} onChange={onChange} />
      </Tooltip>
      <Text type="secondary" style={{ fontSize: 12 }}>
        Авто
      </Text>
      {enabled && (
        <Text type="secondary" style={{ fontSize: 11, minWidth: 86 }}>
          {isFetching ? (
            <span style={{ color: '#0D5AA7' }}>обновляется…</span>
          ) : ago === null ? (
            ''
          ) : ago < 2 ? (
            'только что'
          ) : (
            `${ago} с назад`
          )}
        </Text>
      )}
    </Space>
  )
}
