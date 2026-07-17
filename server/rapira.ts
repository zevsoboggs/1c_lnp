const RAPIRA_API = process.env.RAPIRA_API || 'https://api.rapira.net/market/symbol-thumb'
const SYMBOL = 'USDT/RUB'
const TTL_MS = 60_000

export type Rate = { rate: number; symbol: string; source: 'rapira'; at: string }

let cache: { value: Rate; expires: number } | null = null

type Thumb = { symbol?: string; close?: number; open?: number }

/**
 * Курс USDT/RUB с биржи RAPIRA. Кэш на минуту: курс живёт недолго,
 * но дёргать биржу на каждый расчёт незачем.
 *
 * Берём `close` — последняя цена сделки. Курс всегда возвращается вместе
 * с меткой времени и сохраняется в лист, чтобы сумма не поехала при пересчёте.
 */
export async function getRate(force = false): Promise<Rate> {
  if (!force && cache && cache.expires > Date.now()) return cache.value

  const res = await fetch(RAPIRA_API, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`RAPIRA ответила ${res.status}`)

  const rows = (await res.json()) as Thumb[]
  if (!Array.isArray(rows)) throw new Error('RAPIRA вернула неожиданный формат')

  const row = rows.find((r) => r.symbol === SYMBOL)
  if (!row) throw new Error(`RAPIRA не отдала пару ${SYMBOL}`)

  const rate = Number(row.close ?? row.open)
  // Курс — делитель: ноль или мусор молча превратил бы выплату в Infinity.
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`RAPIRA вернула некорректный курс: ${row.close}`)
  }

  const value: Rate = { rate, symbol: SYMBOL, source: 'rapira', at: new Date().toISOString() }
  cache = { value, expires: Date.now() + TTL_MS }
  return value
}
