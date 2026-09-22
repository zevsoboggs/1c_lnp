/**
 * Криптоплатежи: кошельки компании, обязательства перед партнёрами, счета,
 * выплаты, проводки и корректировки баланса.
 *
 * Отдельно от dataProvider: списки здесь сводные по всем партнёрам, а
 * корректировка — действие, а не правка записи.
 */
import { action, type ApiError } from './actions'

export interface CryptoWalletBalance {
  symbol: string
  isUsdt: boolean
  amount: number
  amountUsd: number | null
}

export interface CryptoCompanyWallet {
  network: string
  label: string
  usdtNetwork: string | null
  address: string | null
  stale: boolean
  balances: CryptoWalletBalance[]
  totalUsd: number
}

export interface CryptoOverview {
  configured: boolean
  error: string | null
  account: { id?: string; telegramUserId?: number; username?: string | null; kycStatus?: string } | null
  wallets: CryptoCompanyWallet[]
  usdtOnWallets: number
  liabilities: number
  surplus: number | null
  partnersWithBalance: number
  counts: Record<string, number>
}

export interface CryptoInvoice {
  id: string
  number: string
  externalId: string | null
  status: string
  network: string
  networkLabel: string
  usdtNetwork: string | null
  amount: number
  expectedAmount: number
  expectedAmountText: string
  feePercent: number
  feeAmount: number
  netAmount: number
  address: string
  description: string | null
  customerEmail: string | null
  paidAmount: number | null
  paidAt: string | null
  depositOperationId: string | null
  expiresAt: string
  createdAt: string
  partnerId: string
  partnerName: string | null
}

export interface CryptoPayout {
  id: string
  status: string
  network: string
  networkLabel: string
  address: string
  amount: number
  fee: number
  total: number
  note: string | null
  idempotencyKey: string
  processingId: string | null
  processingStatus: string | null
  attempts: number
  error: string | null
  completedAt: string | null
  createdAt: string
  partnerId: string
  partnerName: string | null
}

export interface CryptoLedgerEntry {
  id: string
  type: string
  amount: number
  balanceAfter: number
  invoiceId: string | null
  payoutId: string | null
  comment: string | null
  createdAt: string
  partnerId: string
  partnerName: string | null
}

export interface CryptoPartnerBalance {
  partnerId: string
  partnerName: string | null
  balance: number
}

type Pagination = { total: number; limit: number; offset: number; pages: number }

export const cryptoApi = {
  overview: () => action<CryptoOverview>('/crypto/overview', { method: 'GET' }),

  invoices: (params: { partnerId?: string; status?: string; network?: string; search?: string; limit?: number; offset?: number }) =>
    action<{ invoices: CryptoInvoice[]; pagination: Pagination }>(`/crypto/invoices${query(params)}`, { method: 'GET' }),

  payouts: (params: { partnerId?: string; status?: string; limit?: number; offset?: number }) =>
    action<{ payouts: CryptoPayout[]; pagination: Pagination }>(`/crypto/payouts${query(params)}`, { method: 'GET' }),

  ledger: (params: { partnerId?: string; type?: string; limit?: number; offset?: number }) =>
    action<{ entries: CryptoLedgerEntry[]; pagination: Pagination }>(`/crypto/ledger${query(params)}`, { method: 'GET' }),

  balances: () => action<{ balances: CryptoPartnerBalance[] }>('/crypto/balances', { method: 'GET' }),

  /** Корректировка — единственный способ поправить баланс: проводки не редактируются. */
  adjust: (body: { partnerId: string; amount: number; comment: string }) =>
    action<{ entry: CryptoLedgerEntry; balance: number }>('/crypto/ledger', { body }),
}

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'all') q.append(k, String(v))
  const s = q.toString()
  return s ? `?${s}` : ''
}

export type { ApiError }
