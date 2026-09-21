/**
 * Аренда энергии TRON — пока без сервера.
 *
 * Перевод USDT (TRC-20) сжигает энергию; без неё сеть списывает TRX по
 * полной цене. Арендовать энергию у провайдера в разы дешевле, чем жечь TRX,
 * поэтому перед выплатами с горячих кошельков её докупают.
 *
 * Здесь только контракт и заглушки: формы и таблицы уже живут на настоящих
 * типах, а сами вызовы к провайдеру подключатся позже — заменой тел функций
 * в `energyApi`, страница при этом не меняется. Все «ответы» хранятся в
 * памяти вкладки и пропадают при перезагрузке.
 */

export type Period = '1h' | '1d' | '3d' | '7d' | '14d' | '30d'

export const PERIODS: Array<{ value: Period; label: string; hours: number }> = [
  { value: '1h', label: '1 час', hours: 1 },
  { value: '1d', label: '1 день', hours: 24 },
  { value: '3d', label: '3 дня', hours: 72 },
  { value: '7d', label: '7 дней', hours: 168 },
  { value: '14d', label: '14 дней', hours: 336 },
  { value: '30d', label: '30 дней', hours: 720 },
]

/** Цена аренды, sun за единицу энергии на весь срок (1 TRX = 1 000 000 sun). */
export const RENT_PRICE_SUN: Record<Period, number> = {
  '1h': 55,
  '1d': 85,
  '3d': 210,
  '7d': 400,
  '14d': 720,
  '30d': 1300,
}

/** Сколько сеть сожгла бы TRX без аренды: 420 sun за единицу энергии. */
export const BURN_PRICE_SUN = 420

/** Сколько энергии уходит на один перевод USDT. */
export const ENERGY_PER_TRANSFER = {
  /** Получатель уже держал USDT. */
  existing: 65_000,
  /** У получателя USDT ещё не было — сеть создаёт запись, дороже вдвое. */
  fresh: 131_000,
}

export const ORDER_STATUS = [
  { value: 'PENDING', label: 'Ожидает', color: 'processing' },
  { value: 'ACTIVE', label: 'Активна', color: 'success' },
  { value: 'EXPIRED', label: 'Истекла', color: 'default' },
  { value: 'CANCELLED', label: 'Отменена', color: 'warning' },
  { value: 'FAILED', label: 'Ошибка', color: 'error' },
]

export type OrderStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'FAILED'

export type EnergyOrder = {
  id: string
  address: string
  /** Подпись адреса из справочника, если адрес там есть. */
  label: string | null
  energy: number
  bandwidth: number
  period: Period
  costTrx: number
  status: OrderStatus
  source: 'MANUAL' | 'AUTO'
  txHash: string | null
  comment: string | null
  createdAt: string
  expiresAt: string | null
}

export type EnergyAddress = {
  id: string
  label: string
  address: string
  autoRent: boolean
  /** Ниже этого остатка энергии — автоаренда. */
  threshold: number
  /** Сколько энергии докупать за раз. */
  amount: number
  period: Period
  /** Текущий остаток энергии на адресе — по данным сети. */
  energyNow: number
  lastRentAt: string | null
  createdAt: string
}

export type EnergySettings = {
  provider: 'TRONSAVE' | 'FEEE' | 'TOKENGOODIES'
  apiKey: string
  payerAddress: string
  dailyLimitTrx: number
  lowBalanceTrx: number
  notifyTelegram: boolean
  notifyEmail: string
}

export type EnergyOverview = {
  balanceTrx: number
  rentedNow: number
  ordersToday: number
  spentTodayTrx: number
  savedMonthTrx: number
  fetchedAt: string
}

export const PROVIDERS = [
  { value: 'TRONSAVE', label: 'TronSave' },
  { value: 'FEEE', label: 'Feee.io' },
  { value: 'TOKENGOODIES', label: 'TokenGoodies' },
]

/** Стоимость аренды в TRX. */
export const rentCost = (energy: number, period: Period) =>
  Math.round(((energy * RENT_PRICE_SUN[period]) / 1_000_000) * 100) / 100

/** Сколько TRX сгорело бы без аренды. */
export const burnCost = (energy: number) => Math.round(((energy * BURN_PRICE_SUN) / 1_000_000) * 100) / 100

/** Base58-адрес TRON: начинается с T, 34 символа, без 0 O I l. */
export const isTronAddress = (v: string) => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(v.trim())

// ── Заглушки ────────────────────────────────────────────────────────────────

const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms))
const iso = (shiftMin: number) => new Date(Date.now() + shiftMin * 60_000).toISOString()
const uid = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`
const fakeHash = () =>
  Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')

const addresses: EnergyAddress[] = [
  {
    id: 'addr_hot1',
    label: 'Горячий кошелёк выплат',
    address: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9',
    autoRent: true,
    threshold: 70_000,
    amount: 262_000,
    period: '1d',
    energyNow: 118_400,
    lastRentAt: iso(-95),
    createdAt: iso(-60 * 24 * 40),
  },
  {
    id: 'addr_ref',
    label: 'Реферальные начисления',
    address: 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7',
    autoRent: true,
    threshold: 65_000,
    amount: 131_000,
    period: '3d',
    energyNow: 12_900,
    lastRentAt: iso(-60 * 26),
    createdAt: iso(-60 * 24 * 21),
  },
  {
    id: 'addr_cold',
    label: 'Резерв (ручные переводы)',
    address: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
    autoRent: false,
    threshold: 0,
    amount: 65_000,
    period: '1h',
    energyNow: 0,
    lastRentAt: null,
    createdAt: iso(-60 * 24 * 5),
  },
]

const orders: EnergyOrder[] = [
  {
    id: 'ord_7f3a12',
    address: addresses[0].address,
    label: addresses[0].label,
    energy: 262_000,
    bandwidth: 0,
    period: '1d',
    costTrx: rentCost(262_000, '1d'),
    status: 'ACTIVE',
    source: 'AUTO',
    txHash: fakeHash(),
    comment: null,
    createdAt: iso(-95),
    expiresAt: iso(24 * 60 - 95),
  },
  {
    id: 'ord_9c01be',
    address: addresses[1].address,
    label: addresses[1].label,
    energy: 131_000,
    bandwidth: 0,
    period: '3d',
    costTrx: rentCost(131_000, '3d'),
    status: 'ACTIVE',
    source: 'AUTO',
    txHash: fakeHash(),
    comment: null,
    createdAt: iso(-60 * 26),
    expiresAt: iso(72 * 60 - 60 * 26),
  },
  {
    id: 'ord_44d8e0',
    address: addresses[2].address,
    label: addresses[2].label,
    energy: 65_000,
    bandwidth: 350,
    period: '1h',
    costTrx: rentCost(65_000, '1h'),
    status: 'EXPIRED',
    source: 'MANUAL',
    txHash: fakeHash(),
    comment: 'Разовый перевод партнёру',
    createdAt: iso(-60 * 30),
    expiresAt: iso(-60 * 29),
  },
  {
    id: 'ord_1a77c9',
    address: 'TJRabPrwbZy45sbavfcjinPJC18kjpRTv8',
    label: null,
    energy: 65_000,
    bandwidth: 0,
    period: '1h',
    costTrx: rentCost(65_000, '1h'),
    status: 'FAILED',
    source: 'MANUAL',
    txHash: null,
    comment: 'Тест нового провайдера',
    createdAt: iso(-60 * 50),
    expiresAt: null,
  },
  {
    id: 'ord_c2be55',
    address: addresses[0].address,
    label: addresses[0].label,
    energy: 262_000,
    bandwidth: 0,
    period: '1d',
    costTrx: rentCost(262_000, '1d'),
    status: 'EXPIRED',
    source: 'AUTO',
    txHash: fakeHash(),
    comment: null,
    createdAt: iso(-60 * 24 - 95),
    expiresAt: iso(-95),
  },
]

let settings: EnergySettings = {
  provider: 'TRONSAVE',
  apiKey: '',
  payerAddress: 'TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9',
  dailyLimitTrx: 500,
  lowBalanceTrx: 100,
  notifyTelegram: true,
  notifyEmail: '',
}

let balanceTrx = 1_284.37

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export const energyApi = {
  async overview(): Promise<EnergyOverview> {
    await wait(250)
    const today = orders.filter((o) => new Date(o.createdAt).getTime() >= startOfToday())
    const active = orders.filter((o) => o.status === 'ACTIVE')
    const month = orders.filter(
      (o) => o.status !== 'FAILED' && Date.now() - new Date(o.createdAt).getTime() < 30 * 864e5,
    )
    return {
      balanceTrx,
      rentedNow: active.reduce((a, o) => a + o.energy, 0),
      ordersToday: today.length,
      spentTodayTrx: today.reduce((a, o) => a + (o.status === 'FAILED' ? 0 : o.costTrx), 0),
      savedMonthTrx: month.reduce((a, o) => a + burnCost(o.energy) - o.costTrx, 0),
      fetchedAt: new Date().toISOString(),
    }
  },

  async orders(params: { status?: string; search?: string } = {}): Promise<EnergyOrder[]> {
    await wait()
    const q = params.search?.trim().toLowerCase()
    return orders
      .filter((o) => !params.status || o.status === params.status)
      .filter(
        (o) =>
          !q ||
          o.address.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          (o.label ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async rent(input: {
    address: string
    energy: number
    bandwidth?: number
    period: Period
    comment?: string
  }): Promise<EnergyOrder> {
    await wait(700)
    const cost = rentCost(input.energy, input.period)
    if (cost > balanceTrx) throw new Error(`Не хватает TRX на балансе провайдера: нужно ${cost}, есть ${balanceTrx.toFixed(2)}`)
    const hours = PERIODS.find((p) => p.value === input.period)!.hours
    const known = addresses.find((a) => a.address === input.address)
    const order: EnergyOrder = {
      id: uid('ord'),
      address: input.address,
      label: known?.label ?? null,
      energy: input.energy,
      bandwidth: input.bandwidth ?? 0,
      period: input.period,
      costTrx: cost,
      status: 'ACTIVE',
      source: 'MANUAL',
      txHash: fakeHash(),
      comment: input.comment || null,
      createdAt: new Date().toISOString(),
      expiresAt: iso(hours * 60),
    }
    orders.unshift(order)
    balanceTrx -= cost
    if (known) {
      known.energyNow += input.energy
      known.lastRentAt = order.createdAt
    }
    return order
  },

  async extend(id: string, period: Period): Promise<EnergyOrder> {
    await wait(500)
    const o = orders.find((x) => x.id === id)
    if (!o) throw new Error('Заказ не найден')
    const cost = rentCost(o.energy, period)
    if (cost > balanceTrx) throw new Error('Не хватает TRX на балансе провайдера')
    const hours = PERIODS.find((p) => p.value === period)!.hours
    const base = o.expiresAt && new Date(o.expiresAt).getTime() > Date.now() ? new Date(o.expiresAt) : new Date()
    o.expiresAt = new Date(base.getTime() + hours * 3_600_000).toISOString()
    o.status = 'ACTIVE'
    o.costTrx = Math.round((o.costTrx + cost) * 100) / 100
    balanceTrx -= cost
    return o
  },

  async cancel(id: string): Promise<void> {
    await wait(400)
    const o = orders.find((x) => x.id === id)
    if (!o) throw new Error('Заказ не найден')
    if (o.status !== 'PENDING' && o.status !== 'ACTIVE') throw new Error('Отменить можно только активную аренду')
    o.status = 'CANCELLED'
  },

  async addresses(): Promise<EnergyAddress[]> {
    await wait()
    return [...addresses]
  },

  async saveAddress(input: Omit<EnergyAddress, 'id' | 'energyNow' | 'lastRentAt' | 'createdAt'> & { id?: string }) {
    await wait(400)
    if (addresses.some((a) => a.address === input.address && a.id !== input.id)) {
      throw new Error('Этот адрес уже есть в справочнике')
    }
    const existing = input.id ? addresses.find((a) => a.id === input.id) : undefined
    if (existing) {
      Object.assign(existing, input)
      return existing
    }
    const created: EnergyAddress = {
      ...input,
      id: uid('addr'),
      energyNow: 0,
      lastRentAt: null,
      createdAt: new Date().toISOString(),
    }
    addresses.push(created)
    return created
  },

  async removeAddress(id: string): Promise<void> {
    await wait(300)
    const i = addresses.findIndex((a) => a.id === id)
    if (i >= 0) addresses.splice(i, 1)
  },

  async settings(): Promise<EnergySettings> {
    await wait(200)
    return { ...settings }
  },

  async saveSettings(next: EnergySettings): Promise<EnergySettings> {
    await wait(500)
    settings = { ...next }
    return { ...settings }
  },

  /** Проверка ключа у провайдера — пока всегда «успех», если ключ не пустой. */
  async testConnection(input: { provider: string; apiKey: string }): Promise<{ ok: boolean; balanceTrx: number }> {
    await wait(900)
    if (!input.apiKey.trim()) throw new Error('Введите API-ключ провайдера')
    return { ok: true, balanceTrx }
  },

  /** Адрес для пополнения баланса у провайдера. */
  async depositAddress(): Promise<{ address: string; network: 'TRON'; memo: string | null }> {
    await wait(300)
    return { address: 'TPfRkg5xPn6bmR8h3qWVkCf4d3XEGyx5Yo', network: 'TRON', memo: null }
  },
}
