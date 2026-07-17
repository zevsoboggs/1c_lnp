import dayjs, { type Dayjs } from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import 'dayjs/locale/ru'

// isoWeek нужен ради isoWeekday(): 1=пн … 7=вс, независимо от локали.
// Своя неделя у dayjs начинается с воскресенья, полагаться на неё нельзя.
dayjs.extend(isoWeek)
dayjs.locale('ru')

export type Period = { from: Dayjs; to: Dayjs }

/**
 * Расчётный период — вторник по понедельник включительно.
 * Выплаты уходят в понедельник вечером, поэтому неделя закрывается
 * понедельником, а следующая начинается со вторника.
 */
export function periodOf(d: Dayjs): Period {
  const iso = d.isoWeekday() // 1=пн … 7=вс
  // Понедельник — последний день периода, начавшегося в прошлый вторник,
  // а не первый день нового: иначе день выплаты попал бы не в свой период.
  const back = iso === 1 ? 6 : iso - 2
  const from = d.subtract(back, 'day').startOf('day')
  return { from, to: from.add(6, 'day') }
}

/** Прошедший период — закрытый, его и считают. */
export const lastPeriod = (): Period => periodOf(dayjs().subtract(7, 'day'))

export const label = (p: Period): string =>
  `${p.from.format('DD.MM.YYYY')} — ${p.to.format('DD.MM.YYYY')}`

/** Последние N периодов, свежие сверху; текущий помечен как незакрытый. */
export function recentPeriods(count = 12): Array<{ value: string; label: string; period: Period }> {
  const current = periodOf(dayjs()).from
  const out: Array<{ value: string; label: string; period: Period }> = []
  for (let i = 0; i < count; i++) {
    const p = periodOf(current.subtract(i * 7, 'day'))
    out.push({
      value: p.from.format('YYYY-MM-DD'),
      label: `${label(p)}${i === 0 ? ' · текущий, ещё идёт' : ''}`,
      period: p,
    })
  }
  return out
}
