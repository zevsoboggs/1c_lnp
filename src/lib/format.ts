import dayjs from 'dayjs'

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

export function dt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return dayjs(iso).format('DD.MM.YYYY HH:mm')
}
