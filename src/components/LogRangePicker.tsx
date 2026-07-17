import { DatePicker } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'

/**
 * Период для журналов.
 *
 * У логов `to` — это полночь указанной даты, а не её конец: запрос
 * from=17.07&to=17.07 честно вернёт ноль записей. Пользователь выбирает
 * «17-е по 17-е», подразумевая весь день, поэтому к `to` прибавляем сутки.
 */
export function LogRangePicker({
  value,
  onChange,
  width = 240,
}: {
  /** Как выбрал пользователь: [from, to] включительно. */
  value: [Dayjs, Dayjs] | null
  /** Отдаёт готовые строки для API: to уже сдвинут на день вперёд. */
  onChange: (range: [Dayjs, Dayjs] | null, apiParams: { from?: string; to?: string }) => void
  width?: number
}) {
  return (
    <DatePicker.RangePicker
      format="DD.MM.YYYY"
      style={{ width }}
      value={value}
      onChange={(v) => {
        if (!v?.[0] || !v?.[1]) return onChange(null, { from: undefined, to: undefined })
        onChange([v[0], v[1]], {
          from: v[0].format('YYYY-MM-DD'),
          to: v[1].add(1, 'day').format('YYYY-MM-DD'),
        })
      }}
      presets={[
        { label: 'Сегодня', value: [dayjs(), dayjs()] },
        { label: 'Вчера', value: [dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')] },
        { label: 'Неделя', value: [dayjs().subtract(6, 'day'), dayjs()] },
        { label: 'Месяц', value: [dayjs().subtract(29, 'day'), dayjs()] },
      ]}
    />
  )
}
