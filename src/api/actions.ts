/**
 * Прямые вызовы admin-api для RPC-действий (approve, sync, test, broadcast…).
 *
 * Отдельно от dataProvider: у Refine контракт про CRUD ресурсов, а здесь
 * действия, которые не ложатся ни в create, ни в update — и у каждого свой
 * формат ответа.
 */

export type ApiError = Error & { code?: string; status?: number }

export async function action<T = any>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`/admin-api/v1${path}`, {
    method: init?.method ?? 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  })

  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    const e = new Error(body?.error ?? `Ошибка ${res.status}`) as ApiError
    e.code = body?.code
    e.status = res.status
    throw e
  }
  return body as T
}
