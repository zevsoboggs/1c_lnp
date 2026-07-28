/**
 * Карта ресурсов admin-api/v1.
 *
 * Контракт неоднороден: ключ массива не всегда совпадает с именем ресурса,
 * часть списков без пагинации, фильтры называются по-разному, часть PATCH
 * висит на коллекции. Все отклонения описаны здесь, чтобы dataProvider
 * оставался generic, а не оброс if-ами по именам ресурсов.
 */

export type ResourceSpec = {
  /** Путь под /admin-api/v1 */
  path: string
  /** Ключ, под которым лежит массив в ответе списка */
  listKey: string
  /** Ключ, под которым лежит объект в ответе detail */
  itemKey?: string
  /** Принимает ли ?page&limit. Если нет — отдаёт всё разом */
  paginated: boolean
  defaultLimit?: number
  maxLimit?: number
  /** Поле записи, используемое как id (Refine требует уникальный id) */
  idField?: string
  /** field в UI -> имя query-параметра в API */
  filters?: Record<string, string>
  /** Значение, которое API трактует как «без фильтра» */
  allValue?: string
  readOnly?: boolean
  canCreate?: boolean
  canDelete?: boolean
  /** PATCH на /[id] или на коллекцию с id в теле */
  updateVia?: 'detail' | 'collection'
  /** Для collection-PATCH: имя поля id в теле запроса */
  updateIdField?: string
  /** Суммы приходят в копейках (÷100 при показе) */
  amountsInKopecks?: boolean
}

export const RESOURCES: Record<string, ResourceSpec> = {
  transactions: {
    path: 'transactions',
    listKey: 'transactions',
    itemKey: 'transaction',
    paginated: true,
    defaultLimit: 100,
    readOnly: true,
    amountsInKopecks: true,
    allValue: 'all',
    filters: {
      partnerId: 'partner',
      status: 'status',
      period: 'period',
      dateFrom: 'dateFrom',
      dateTo: 'dateTo',
    },
  },

  invoices: {
    path: 'invoices',
    listKey: 'invoices',
    itemKey: 'invoice',
    paginated: true,
    defaultLimit: 100,
    readOnly: true, // пишется только через RPC-экшены (mark-refunded, sync)
    amountsInKopecks: true,
    allValue: 'all',
    filters: {
      partnerId: 'partner',
      userId: 'user',
      status: 'status',
      search: 'search',
      period: 'period',
      dateFrom: 'dateFrom',
      dateTo: 'dateTo',
    },
  },

  partners: {
    path: 'partners',
    listKey: 'partners',
    itemKey: 'partner',
    paginated: true,
    defaultLimit: 50,
    canCreate: true,
    updateVia: 'detail',
    filters: { q: 'q', isActive: 'isActive' },
  },

  users: {
    path: 'users',
    listKey: 'users',
    itemKey: 'user',
    paginated: true,
    defaultLimit: 50,
    canCreate: true,
    updateVia: 'detail',
    filters: { q: 'q', role: 'role', partnerId: 'partnerId' },
  },

  payouts: {
    path: 'payouts',
    listKey: 'payouts',
    itemKey: 'payout',
    paginated: true,
    readOnly: true,
    amountsInKopecks: true,
    filters: { status: 'status' },
  },

  withdrawals: {
    path: 'withdrawals',
    listKey: 'withdrawals',
    itemKey: 'withdrawal',
    paginated: true,
    updateVia: 'detail',
    filters: { status: 'status' },
  },

  'refund-requests': {
    path: 'refund-requests',
    listKey: 'refundRequests',
    itemKey: 'refundRequest',
    paginated: true,
    readOnly: true, // approve/reject — отдельные RPC-экшены
    filters: { status: 'status', partnerId: 'partnerId' },
  },

  'kyc-verifications': {
    path: 'kyc-verifications',
    listKey: 'verifications', // не "kycVerifications"
    itemKey: 'verification',
    paginated: true,
    readOnly: true,
    filters: {
      partnerId: 'partnerId',
      status: 'status',
      provider: 'provider',
      search: 'search',
      dateFrom: 'dateFrom',
      dateTo: 'dateTo',
    },
  },

  webhooks: {
    path: 'webhooks',
    listKey: 'webhooks',
    itemKey: 'webhook',
    paginated: true,
    canCreate: true, // секрет отдаётся один раз при создании
    canDelete: true,
    updateVia: 'detail',
    filters: { partnerId: 'partnerId' },
  },

  terminals: {
    path: 'terminals',
    listKey: 'terminals',
    itemKey: 'terminal',
    paginated: true,
    defaultLimit: 50,
    canCreate: true,
    canDelete: true, // при удалении default роль переезжает на другой терминал
    updateVia: 'detail',
    filters: { partnerId: 'partnerId', provider: 'provider' },
  },

  'api-logs': {
    path: 'api-logs',
    listKey: 'logs', // не "apiLogs"
    itemKey: 'log',
    paginated: true,
    defaultLimit: 50,
    readOnly: true,
    filters: {
      partnerId: 'partnerId',
      success: 'success',
      method: 'method',
      endpoint: 'endpoint',
      search: 'search',
      from: 'from',
      to: 'to',
    },
  },

  'audit-logs': {
    path: 'audit-logs',
    listKey: 'logs',
    itemKey: 'log',
    paginated: true,
    defaultLimit: 50,
    readOnly: true,
    filters: {
      userId: 'userId',
      userEmail: 'userEmail',
      action: 'action',
      entity: 'entity',
      entityId: 'entityId',
      search: 'search',
      from: 'from',
      to: 'to',
    },
  },

  markups: {
    path: 'markups',
    listKey: 'users', // не "markups": строки — это юзеры с effectiveMarkup
    itemKey: 'user',
    paginated: true,
    defaultLimit: 50,
    maxLimit: 200, // у остальных 500
    updateVia: 'collection',
    updateIdField: 'userId',
    filters: { q: 'q', role: 'role' },
  },

  'pos-markups': {
    path: 'pos-markups',
    listKey: 'partners', // не "posMarkups"
    itemKey: 'partner',
    paginated: false, // query-параметров не принимает вообще
    updateVia: 'collection',
    updateIdField: 'partnerId',
  },

  'kyc-billing': {
    path: 'kyc-billing',
    listKey: 'partners', // не "kycBilling"
    itemKey: 'partner',
    paginated: false,
    updateVia: 'collection',
    updateIdField: 'partnerId', // PATCH дополнительно требует confirmCode
  },

  finance: {
    path: 'finance',
    listKey: 'partners', // агрегированные строки, НЕ сущности Partner
    paginated: false,
    readOnly: true,
    amountsInKopecks: true, // кроме полей *Usdt
    // ВНИМАНИЕ: тут partnerId = UUID, а строковый код лежит в partnerStringId —
    // ровно наоборот, чем в /v1/partners. Отсюда idField.
    idField: 'partnerId',
    filters: { partnerId: 'partner', startDate: 'startDate', endDate: 'endDate' },
  },

  settlements: {
    path: 'settlements',
    listKey: 'partners',
    paginated: false,
    readOnly: true,
    idField: 'partnerId',
    filters: { partnerId: 'partner', startDate: 'startDate', endDate: 'endDate' },
  },

  'referral-overrides': {
    path: 'referral-overrides',
    listKey: 'overrides',
    itemKey: 'override',
    paginated: false,
    canCreate: true, // POST — upsert по (ancestor, branchRoot)
    filters: { ancestorUserId: 'ancestorUserId', branchRootUserId: 'branchRootUserId' },
  },
}

export const getSpec = (resource: string): ResourceSpec => {
  const spec = RESOURCES[resource]
  if (!spec) throw new Error(`Неизвестный ресурс: ${resource}`)
  return spec
}
