import { useQuery } from '@tanstack/react-query'
import { Table, Typography, Tag, Alert, Spin } from 'antd'
import { action } from '../api/actions'
import { money, usdt } from '../lib/format'

const { Text } = Typography

type UserRow = {
  userId: string
  email: string
  name: string
  role: string
  count: number
  amount: number // копейки (rub) или число (usdt) — по mode
}

const ROLE_COLOR: Record<string, string> = {
  PARTNER: 'blue',
  AGENT: 'geekblue',
  EMPLOYEE: 'default',
  ADMIN: 'red',
}

/**
 * Разбивка оборота партнёра по пользователям (кто из аккаунтов налил оборот).
 *
 * В агрегатах финансов/расчётов оборот идёт одной строкой на партнёра, а у
 * партнёра несколько пользователей. Здесь берём оплаченные счета партнёра за
 * период, группируем по создателю (createdById) и подставляем почту из /users.
 * Считаем только СВОИ счета партнёра (invoice.partnerId === partnerId) —
 * счета подпартнёров идут отдельными строками таблицы.
 */
export function PartnerTurnoverByUser({
  partnerId,
  from,
  to,
  mode,
}: {
  partnerId: string
  from: string
  to: string
  mode: 'rub' | 'usdt'
}) {
  const q = useQuery({
    queryKey: ['partner-users-turnover', partnerId, from, to, mode],
    queryFn: async () => {
      // Пользователи партнёра: id → почта/имя/роль.
      const u = await action<{ users?: any[] }>(`/users?partnerId=${partnerId}&limit=200`, {
        method: 'GET',
      })
      const users = new Map<string, any>((u.users ?? []).map((x) => [x.id, x]))

      // Оплаченные счета партнёра за период (по дате оплаты), постранично.
      const invoices: any[] = []
      let capped = false
      for (let page = 1; page <= 15; page++) {
        const p = new URLSearchParams({
          partner: partnerId,
          status: 'PAID',
          paidFrom: from,
          paidTo: to,
          limit: '200',
          page: String(page),
        })
        const r = await action<{ invoices?: any[]; pagination?: { pages?: number } }>(
          `/invoices?${p}`,
          { method: 'GET' },
        )
        const batch = r.invoices ?? []
        invoices.push(...batch)
        const pages = r.pagination?.pages ?? 1
        if (page >= pages) break
        if (page === 15) capped = true
      }

      const map = new Map<string, UserRow>()
      for (const inv of invoices) {
        // Только свои счета партнёра — счета подпартнёров идут отдельной строкой.
        if (inv.partnerId !== partnerId) continue
        const cid = inv.createdById ?? 'unknown'
        const amt = mode === 'usdt' ? Number(inv.amountUsdt) || 0 : Number(inv.amount) || 0
        const cur = map.get(cid)
        if (cur) {
          cur.count++
          cur.amount += amt
        } else {
          const usr = users.get(cid)
          map.set(cid, {
            userId: cid,
            email: usr?.email ?? '',
            name: usr?.name ?? '',
            role: usr?.role ?? '',
            count: 1,
            amount: amt,
          })
        }
      }
      const rows = [...map.values()].sort((a, b) => b.amount - a.amount)
      return { rows, capped, invoiceCount: invoices.filter((i) => i.partnerId === partnerId).length }
    },
    staleTime: 60_000,
  })

  if (q.isLoading) return <Spin size="small" style={{ margin: 8 }} />
  if (q.isError)
    return <Alert type="error" showIcon message={(q.error as Error)?.message ?? 'Ошибка'} style={{ margin: 8 }} />

  const rows = q.data?.rows ?? []
  const fmt = (v: number) => (mode === 'usdt' ? usdt(v) : money(v))

  if (!rows.length)
    return <Text type="secondary" style={{ display: 'block', padding: 8 }}>Нет оплаченных счетов за период</Text>

  return (
    <div style={{ padding: '4px 8px 8px' }}>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
        Кто наливал оборот — по создателю счёта:
      </Text>
      {q.data?.capped && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 8 }}
          message="Показаны не все счета — сузьте период"
        />
      )}
      <Table
        dataSource={rows}
        rowKey="userId"
        size="small"
        pagination={false}
        scroll={{ x: 620 }}
      >
        <Table.Column
          title="Пользователь (почта)"
          render={(_: unknown, r: UserRow) =>
            r.email ? (
              <Text copyable>{r.email}</Text>
            ) : (
              <Text type="secondary">{r.userId.slice(0, 8)}… (не найден)</Text>
            )
          }
        />
        <Table.Column dataIndex="name" title="Имя" width={150} render={(v: string) => v || '—'} />
        <Table.Column
          dataIndex="role"
          title="Роль"
          width={110}
          render={(v: string) => (v ? <Tag color={ROLE_COLOR[v] ?? 'default'}>{v}</Tag> : '—')}
        />
        <Table.Column
          dataIndex="count"
          title="Счетов"
          width={90}
          align="right"
          sorter={(a: UserRow, b: UserRow) => a.count - b.count}
        />
        <Table.Column
          dataIndex="amount"
          title="Оборот"
          width={150}
          align="right"
          defaultSortOrder="descend"
          sorter={(a: UserRow, b: UserRow) => a.amount - b.amount}
          render={(v: number) => <Text strong>{fmt(v)}</Text>}
        />
      </Table>
    </div>
  )
}
