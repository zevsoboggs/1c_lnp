import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { timezoneOffset } from './timezone'

// utc нужен ради utcOffset(): без него dayjs печатает время пояса браузера,
// и одна и та же оплата выглядит по-разному у операторов в разных городах.
dayjs.extend(utc)

/**
 * Суммы в admin-api приходят в копейках (RUB ×100) — кроме полей *Usdt,
 * которые уже в целых единицах. Ошибка тут даёт расхождение в 100 раз,
 * поэтому оба случая разведены явно.
 */
export function money(kopecks: number | null | undefined, currency = 'RUB'): string {
  if (kopecks == null) return '—'
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(kopecks / 100)
}

export function usdt(amount: number | null | undefined): string {
  if (amount == null) return '—'
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(amount)} USDT`
}

/**
 * Дата и время в поясе, выбранном оператором (см. lib/timezone).
 *
 * Все даты из admin-api приходят в UTC, поэтому переводим их явно: в панели
 * сверяют платежи с выписками, и «во сколько именно» должно значить одно и то
 * же на любом рабочем месте.
 */
export function dt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return dayjs(iso).utcOffset(timezoneOffset()).format('DD.MM.YYYY HH:mm')
}

/** Только дата, тот же пояс. */
export function day(iso: string | null | undefined): string {
  if (!iso) return '—'
  return dayjs(iso).utcOffset(timezoneOffset()).format('DD.MM.YYYY')
}
