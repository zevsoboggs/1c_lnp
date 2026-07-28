/** Значения взяты из кода admin-api — держать в синхроне с бэкендом. */

/** WEBHOOK_EVENTS из app/api/mobile/webhooks/route.ts. Всё, что вне списка, API отклонит. */
export const WEBHOOK_EVENTS = [
  'INVOICE_CREATED',
  'INVOICE_UPDATED',
  'INVOICE_CANCELLED',
  'INVOICE_PAID',
  'INVOICE_EXPIRED',
  'TRANSACTION_CREATED',
  'TRANSACTION_COMPLETED',
  'TRANSACTION_FAILED',
  'KYC_STARTED',
  'KYC_APPROVED',
  'KYC_REJECTED',
  'KYC_EXPIRED',
  'PAYMENT_THIRD_PARTY_PAYER',
  'PAYMENT_PAYER_INFO',
  'REFUND_REQUESTED',
  'REFUND_COMPLETED',
  'REFUND_FAILED',
  'REFUND_REJECTED',
] as const
// REFUND_APPROVED сюда не входит намеренно: он есть в EventMapping бэкенда,
// но отсутствует в WEBHOOK_EVENTS — подписка на него вернёт 400.

/** Провайдеры терминалов (enum PaymentProvider в POST /v1/terminals). */
export const TERMINAL_PROVIDERS = [
  'KANYON',
  'PAYSIDO',
  'ALTYN',
  'IPT_DBS',
  'OVERPAY',
  'TBANK',
  'CSBP',
  'CRICTI',
] as const

/** Провайдеры, по которым admin-api умеет исполнять возврат. */
export const REFUNDABLE_PROVIDERS = ['OVERPAY', 'CRICTI', 'KANYON'] as const

export const WEBHOOK_STATUS = [
  { value: 'ACTIVE', label: 'Активен' },
  { value: 'INACTIVE', label: 'Выключен' },
  { value: 'DISABLED', label: 'Отключён' },
]

export const REFUND_STATUS = [
  ['PENDING', 'Ожидает', 'processing'],
  ['APPROVED', 'Утверждён', 'blue'],
  ['COMPLETED', 'Исполнен', 'success'],
  ['REJECTED', 'Отклонён', 'default'],
  ['FAILED', 'Ошибка', 'error'],
].map(([value, label, color]) => ({ value, label, color }))

export const options = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }))
