import type { DataProvider, HttpError, CrudFilters } from '@refinedev/core'
import { getSpec, type ResourceSpec } from './resourceMap'

/** Идём в свой бэкенд (server/), он подставляет ключ и ходит в loveandpay. */
const API_BASE = '/admin-api/v1'

async function request<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })

  let body: any = null
  try {
    body = await res.json()
  } catch {
    /* тело может быть пустым или не-JSON */
  }

  // Envelope всегда несёт success; HTTP-код и success могут расходиться,
  // поэтому проверяем оба.
  if (!res.ok || body?.success === false) {
    const error: HttpError = {
      message: body?.error ?? res.statusText ?? 'Ошибка запроса',
      statusCode: res.status,
      errorCode: body?.code,
    }
    throw error
  }
  return body as T
}

/** Строки finance/settlements не имеют поля id — Refine его требует. */
function withId(row: any, spec: ResourceSpec) {
  if (!spec.idField || row == null) return row
  return { ...row, id: row[spec.idField] }
}

function buildQuery(filters: CrudFilters | undefined, spec: ResourceSpec): URLSearchParams {
  const params = new URLSearchParams()
  for (const f of filters ?? []) {
    if (!('field' in f)) continue // conditional-фильтры API не понимает
    const param = spec.filters?.[f.field]
    if (!param) continue
    const v = f.value
    if (v === undefined || v === null || v === '') continue
    if (spec.allValue && v === spec.allValue) continue
    params.set(param, String(v))
  }
  return params
}

export const dataProvider: DataProvider = {
  getApiUrl: () => API_BASE,

  getList: async ({ resource, pagination, filters }) => {
    const spec = getSpec(resource)
    const params = buildQuery(filters, spec)

    const p = pagination as any
    const currentPage = p?.currentPage ?? p?.current ?? 1
    const pageSize = p?.pageSize ?? spec.defaultLimit ?? 50

    // Сортировку admin-api не принимает ни на одном эндпоинте — порядок
    // всегда createdAt desc. Поэтому sorters сюда сознательно не приходят,
    // а таблицы не выставляют sorter, чтобы не врать пользователю.

    if (spec.paginated) {
      params.set('page', String(currentPage))
      params.set('limit', String(Math.min(pageSize, spec.maxLimit ?? 500)))
    }

    const qs = params.toString()
    const body = await request(`/${spec.path}${qs ? `?${qs}` : ''}`)
    const rows: any[] = body[spec.listKey] ?? []
    const data = rows.map((r) => withId(r, spec))

    // Часть ответов несёт сводку рядом со списком (api-logs, invoices, payouts).
    // Refine её не ждёт, но и не мешает — прокидываем, иначе пришлось бы
    // делать второй запрос ради тех же цифр.
    const extra = body.stats ? { stats: body.stats } : {}

    if (spec.paginated) {
      return { data, total: body.pagination?.total ?? data.length, ...extra }
    }

    // Списки без пагинации отдают всё разом — режем на клиенте.
    const start = (currentPage - 1) * pageSize
    return { data: data.slice(start, start + pageSize), total: data.length, ...extra }
  },

  getOne: async ({ resource, id }) => {
    const spec = getSpec(resource)
    const body = await request(`/${spec.path}/${id}`)
    const item = spec.itemKey ? body[spec.itemKey] : body
    return { data: withId(item, spec) }
  },

  create: async ({ resource, variables }) => {
    const spec = getSpec(resource)
    if (!spec.canCreate) throw new Error(`${resource}: создание не поддерживается API`)
    const body = await request(`/${spec.path}`, {
      method: 'POST',
      body: JSON.stringify(variables),
    })
    const item = spec.itemKey ? body[spec.itemKey] : body
    return { data: withId(item, spec) }
  },

  update: async ({ resource, id, variables }) => {
    const spec = getSpec(resource)
    if (spec.readOnly || !spec.updateVia) {
      throw new Error(`${resource}: изменение не поддерживается API`)
    }

    // markups / pos-markups / kyc-billing: PATCH висит на коллекции,
    // id уходит в теле, роута /[id] у них нет.
    if (spec.updateVia === 'collection') {
      const body = await request(`/${spec.path}`, {
        method: 'PATCH',
        body: JSON.stringify({ [spec.updateIdField!]: id, ...(variables as object) }),
      })
      const item = spec.itemKey ? body[spec.itemKey] : body
      return { data: withId(item, spec) }
    }

    const body = await request(`/${spec.path}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(variables),
    })
    const item = spec.itemKey ? body[spec.itemKey] : body
    return { data: withId(item, spec) }
  },

  deleteOne: async ({ resource, id }) => {
    const spec = getSpec(resource)
    if (!spec.canDelete && resource !== 'referral-overrides') {
      throw new Error(`${resource}: удаление не поддерживается API`)
    }
    // Ответы разнородны: referral-overrides отдаёт {deleted, id}, остальные —
    // сущность или пустоту. Возвращаем id, он единственный общий знаменатель.
    await request(`/${spec.path}/${id}`, { method: 'DELETE' })
    return { data: { id } as any }
  },

  /** Произвольные вызовы: RPC-экшены и агрегаты вроде stats у /invoices. */
  custom: async ({ url, method, payload, query }) => {
    const path = url.startsWith('/') ? url : `/${url}`
    const qs = query
      ? new URLSearchParams(
          Object.entries(query as Record<string, unknown>)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : ''

    const body = await request(`${path}${qs ? `?${qs}` : ''}`, {
      method: (method ?? 'get').toUpperCase(),
      body: payload ? JSON.stringify(payload) : undefined,
    })
    return { data: body as any }
  },
}
