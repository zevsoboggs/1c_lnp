/** Клиент к своему бэкенду для заказов мини-аппа. */

export type Order = {
  id: string
  userId: string
  cardId: string | null
  type: string
  category: string
  status: string
  amount: number
  fee: number
  commissionAmount: string | null
  exchangeRate: string | null
  fromCurrency: string | null
  toCurrency: string | null
  currency: string | null
  referralCode: string | null
  paywaveTransactionId: string | null
  invoiceId: string | null
  description: string | null
  metadata: unknown
  createdAt: string
  updatedAt: string
  merchantName: string | null
  mcc: string | null
  declineReason: string | null
  user: { telegramUserId: number; username: string | null; firstName: string | null } | null
  card: { cardNumber: string | null; paywaveCardId: string | null } | null
}

const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

async function call<T>(path: string): Promise<T> {
  const res = await fetch(`/api/miniapp${path}`)
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    throw new Error(body?.error ?? `Ошибка ${res.status}`)
  }
  return body as T
}

export const miniappApi = {
  orders: (q: {
    page?: number
    pageSize?: number
    status?: string
    type?: string
    category?: string
    telegramUserId?: string
    fromDate?: string
    toDate?: string
  }) => call<{ data: Order[]; total: number; page: number; pageSize: number }>(`/orders${qs(q)}`),
}

/**
 * Значения собраны из живых данных (1857 заказов).
 * В базе это обычные строки без enum, поэтому список открытый — сюда попало
 * всё, что реально встречается, включая мусорные "0" и "1".
 */
export const ORDER_TYPES = [
  'CARD_PURCHASE',
  'ESIM_PURCHASE',
  'CARD_TOPUP',
  'CARD_ACTIVATION',
  'WALLET_TOPUP',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'CRYPTO_SEND',
  'CRYPTO_DEPOSIT',
  'CARD_TOPUP_RUB',
  'SBP_PAYMENT',
  'STEAM_TOPUP',
  'PROMPTPAY_PAYMENT',
  'REFUND',
  'FEE_CHARGE',
  'PREMIUM_PURCHASE',
  'STEAM_KEY_PURCHASE',
  'VPN_PURCHASE',
  'REFERRAL_WITHDRAW',
  'WITHDRAWAL',
]

export const TYPE_LABEL: Record<string, string> = {
  CARD_PURCHASE: 'Покупка картой',
  ESIM_PURCHASE: 'Покупка eSIM',
  CARD_TOPUP: 'Пополнение карты',
  CARD_ACTIVATION: 'Активация карты',
  WALLET_TOPUP: 'Пополнение кошелька',
  TRANSFER_IN: 'Перевод входящий',
  TRANSFER_OUT: 'Перевод исходящий',
  CRYPTO_SEND: 'Отправка крипты',
  CRYPTO_DEPOSIT: 'Депозит крипты',
  CARD_TOPUP_RUB: 'Пополнение карты ₽',
  SBP_PAYMENT: 'Платёж СБП',
  STEAM_TOPUP: 'Пополнение Steam',
  PROMPTPAY_PAYMENT: 'Платёж PromptPay',
  REFUND: 'Возврат',
  FEE_CHARGE: 'Списание комиссии',
  PREMIUM_PURCHASE: 'Покупка премиума',
  STEAM_KEY_PURCHASE: 'Покупка Steam-ключа',
  VPN_PURCHASE: 'Покупка VPN',
  REFERRAL_WITHDRAW: 'Вывод реферальных',
  WITHDRAWAL: 'Вывод',
}

export const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: 'Выполнен', color: 'success' },
  PENDING: { label: 'Ожидает', color: 'processing' },
  PROCESSING: { label: 'В обработке', color: 'blue' },
  FAILED: { label: 'Ошибка', color: 'error' },
  EXPIRED: { label: 'Истёк', color: 'default' },
  CANCELLED: { label: 'Отменён', color: 'default' },
  REFUNDED: { label: 'Возвращён', color: 'purple' },
  // Не опечатка: в базе действительно лежат такие статусы — status там
  // обычная строка, и кто-то записал числовые коды.
  '0': { label: '0 (некорректный)', color: 'warning' },
  '1': { label: '1 (некорректный)', color: 'warning' },
}

export const ORDER_CATEGORIES = ['FIAT', 'CRYPTO', 'INTERNAL', 'CARD', 'SERVICE']
