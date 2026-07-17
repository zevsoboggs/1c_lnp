/** Значения взяты из prisma/schema.prisma основного проекта — держать в синхроне. */

type Opt = { value: string; label: string; color: string }

const opts = (rows: Array<[string, string, string]>): Opt[] =>
  rows.map(([value, label, color]) => ({ value, label, color }))

export const TRANSACTION_STATUS = opts([
  ['CREATED', 'Создана', 'default'],
  ['QRCDATA_CREATED', 'QR создан', 'cyan'],
  ['PROCESSING', 'В обработке', 'processing'],
  ['COMPLETED', 'Завершена', 'success'],
  ['FAILED', 'Ошибка', 'error'],
  ['CANCELLED', 'Отменена', 'warning'],
])

export const INVOICE_STATUS = opts([
  ['PENDING', 'Ожидает', 'default'],
  ['PAID', 'Оплачен', 'success'],
  ['EXPIRED', 'Истёк', 'warning'],
  ['CANCELLED', 'Отменён', 'default'],
  ['REFUNDED', 'Возвращён', 'purple'],
])

export const PAYOUT_STATUS = opts([
  ['PENDING', 'Ожидает', 'default'],
  ['PROCESSING', 'В обработке', 'processing'],
  ['COMPLETED', 'Выплачено', 'success'],
  ['FAILED', 'Отклонено', 'error'],
  ['CANCELLED', 'Отменено', 'warning'],
])

export const USER_ROLE = opts([
  ['ADMIN', 'Админ', 'red'],
  ['PARTNER', 'Партнёр', 'blue'],
  ['EMPLOYEE', 'Сотрудник', 'green'],
  ['AGENT', 'Агент', 'orange'],
])

export const find = (list: Opt[], value?: string | null): Opt | undefined =>
  list.find((o) => o.value === value)

export const selectOptions = (list: Opt[]) => list.map(({ value, label }) => ({ value, label }))
