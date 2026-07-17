import { Tooltip } from 'antd'

/**
 * Мини-график ряда значений. Пик подсвечен — именно он объясняет всплеск
 * оборота, из-за которого AML-Guard поднимает флаг.
 */
export function Sparkline({
  data,
  width = 460,
  height = 60,
  labels,
}: {
  data: number[]
  width?: number
  height?: number
  labels?: string[]
}) {
  if (!data.length) return null

  const max = Math.max(...data, 1)
  const barW = width / data.length
  const peak = data.indexOf(max)

  return (
    <svg width={width} height={height} role="img" aria-label="Оборот по дням">
      {data.map((v, i) => {
        const h = Math.max(1, (v / max) * (height - 2))
        const isPeak = i === peak
        return (
          <Tooltip key={i} title={`${labels?.[i] ?? i + 1}: ${new Intl.NumberFormat('ru-RU').format(Math.round(v))} ₽`}>
            <rect
              x={i * barW + 1}
              y={height - h}
              width={Math.max(1, barW - 2)}
              height={h}
              fill={isPeak ? '#cf1322' : '#0D5AA7'}
              opacity={isPeak ? 1 : 0.65}
            />
          </Tooltip>
        )
      })}
    </svg>
  )
}
