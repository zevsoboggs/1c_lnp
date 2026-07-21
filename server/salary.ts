import { Router } from 'express'
import { pool } from './db.js'
import { requireAuth, requireSection, writeAudit } from './auth.js'

/**
 * Зарплата: ставки-пресеты, назначение ставок партнёрам и зарплатные листы
 * с замороженной историей.
 *
 * Модель (по ТЗ проект-менеджера):
 *  - salary_rates   — справочник процентов (0.1 %, 0.5 % …), которые ставит ПМ;
 *  - partner_salary — какому партнёру какая ставка (и ВСЁ, сотрудник не при чём);
 *  - salary_sheets  — общий зарплатный лист за период: по каждому партнёру со
 *                     ставкой берём оборот × ставку и суммируем.
 *
 * Сотрудники к партнёрам НЕ привязываются: лист считается по всем партнёрам со
 * ставкой сразу. Заработок = процент С оборота. Рубли — в копейках (bigint).
 *
 * История не ломается: проценты и обороты пишутся в строки листа СНИМКОМ на
 * момент расчёта; поздняя правка ставки уже сохранённый лист не меняет.
 */
const SCHEMA = `
create table if not exists salary_rates (
  id         uuid primary key default gen_random_uuid(),
  percent    numeric(6,3) not null unique,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists partner_salary (
  partner_id   text primary key,
  partner_name text not null,
  rate_id      uuid references salary_rates(id) on delete restrict,
  updated_at   timestamptz not null default now()
);

create table if not exists salary_sheets (
  id             uuid primary key default gen_random_uuid(),
  number         text not null unique,
  date_from      date not null,
  date_to        date not null,
  total_rub      bigint not null,
  partners_count integer not null default 0,
  comment        text,
  created_at     timestamptz not null default now()
);

create index if not exists salary_sheets_created_idx on salary_sheets (created_at desc);

create table if not exists salary_sheet_lines (
  id           uuid primary key default gen_random_uuid(),
  sheet_id     uuid not null references salary_sheets(id) on delete cascade,
  partner_id   text not null,
  partner_name text not null,
  percent      numeric(6,3) not null,
  turnover_rub bigint not null,
  accrued_rub  bigint not null
);

create index if not exists salary_sheet_lines_sheet_idx on salary_sheet_lines (sheet_id);

create sequence if not exists salary_sheet_number_seq;

-- Партнёр больше не привязывается к сотруднику (лист общий по всем ставкам).
-- drop if exists — безвредно на свежей базе, чистит колонки на уже созданной.
alter table partner_salary drop column if exists employee_id;
drop index if exists partner_salary_employee_idx;
alter table salary_sheets drop column if exists employee_id;
alter table salary_sheets drop column if exists employee_name;
`

export async function migrateSalary() {
  await pool.query(SCHEMA)
}

// Запрос в admin-api loveandpay — ключ живёт только на сервере. Дубль хелпера
// из index.ts намеренный: не тащим сюда весь index ради одного вызова.
const LP_API = (process.env.ADMIN_API_URL || 'https://loveandpay.io').replace(/\/$/, '')
const LP_KEY = (process.env.ADMIN_API_KEY || '').split(',')[0].trim()

async function lp<T = any>(path: string): Promise<T> {
  const res = await fetch(`${LP_API}/api/admin-api${path}`, {
    headers: { 'X-Admin-Api-Key': LP_KEY },
    signal: AbortSignal.timeout(30_000),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    throw Object.assign(new Error(body?.error || `admin-api ${res.status}`), { status: res.status })
  }
  return body as T
}

/** Обходит items с ограничением параллельности — чтобы не завалить admin-api. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let i = 0
  const worker = async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

async function nextSalaryNumber(): Promise<string> {
  const { rows } = await pool.query<{ n: string }>(
    "select nextval('salary_sheet_number_seq') as n",
  )
  return `ЗП-${String(rows[0].n).padStart(5, '0')}`
}

function parsePercent(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 100) return NaN
  return Math.round(n * 1000) / 1000
}

export const salary = Router()
salary.use(requireAuth)

// ── Ставки-пресеты ────────────────────────────────────────────────────────────

salary.get('/rates', requireSection('salary-rates'), async (_req, res) => {
  const { rows } = await pool.query(
    `select r.id, r.percent::float8 as percent, r.is_active, r.created_at,
            (select count(*)::int from partner_salary p where p.rate_id = r.id) as partners_count
       from salary_rates r order by r.percent`,
  )
  res.json({ success: true, rates: rows })
})

salary.post('/rates', requireSection('salary-rates', 'write'), async (req, res) => {
  try {
    const pct = parsePercent(req.body?.percent)
    if (pct === null || Number.isNaN(pct)) {
      return res.status(400).json({ success: false, error: 'Процент должен быть числом от 0 до 100' })
    }
    const { rows } = await pool.query(
      `insert into salary_rates (percent) values ($1) returning id, percent::float8 as percent`,
      [pct],
    )
    await writeAudit(req, 'SALARY_RATE_CREATED', 'salary_rate', rows[0].id, { percent: pct })
    res.status(201).json({ success: true, rate: rows[0] })
  } catch (e: any) {
    if (e.code === '23505') {
      return res.status(409).json({ success: false, error: 'Такая ставка уже есть' })
    }
    res.status(500).json({ success: false, error: e.message })
  }
})

salary.patch('/rates/:id', requireSection('salary-rates', 'write'), async (req, res) => {
  try {
    const sets: string[] = []
    const vals: any[] = []
    const push = (sql: string, v: any) => {
      vals.push(v)
      sets.push(`${sql} = $${vals.length}`)
    }
    if (req.body?.percent !== undefined) {
      const pct = parsePercent(req.body.percent)
      if (pct === null || Number.isNaN(pct)) {
        return res.status(400).json({ success: false, error: 'Процент должен быть числом от 0 до 100' })
      }
      push('percent', pct)
    }
    if (typeof req.body?.isActive === 'boolean') push('is_active', req.body.isActive)
    if (!sets.length) return res.status(400).json({ success: false, error: 'Нечего менять' })

    vals.push(req.params.id)
    const { rowCount } = await pool.query(
      `update salary_rates set ${sets.join(', ')} where id = $${vals.length}`,
      vals,
    )
    if (!rowCount) return res.status(404).json({ success: false, error: 'Ставка не найдена' })
    await writeAudit(req, 'SALARY_RATE_UPDATED', 'salary_rate', req.params.id, req.body)
    res.json({ success: true })
  } catch (e: any) {
    if (e.code === '23505') {
      return res.status(409).json({ success: false, error: 'Такая ставка уже есть' })
    }
    res.status(500).json({ success: false, error: e.message })
  }
})

salary.delete('/rates/:id', requireSection('salary-rates', 'write'), async (req, res) => {
  try {
    const { rows: used } = await pool.query(
      'select count(*)::int as n from partner_salary where rate_id = $1',
      [req.params.id],
    )
    if (used[0].n > 0) {
      return res.status(409).json({
        success: false,
        error: `Ставка назначена ${used[0].n} партнёрам — сначала снимите её с них`,
      })
    }
    const { rowCount } = await pool.query('delete from salary_rates where id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ success: false, error: 'Ставка не найдена' })
    await writeAudit(req, 'SALARY_RATE_DELETED', 'salary_rate', req.params.id)
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// ── Назначение ставок партнёрам ───────────────────────────────────────────────

salary.get('/assignments', requireSection('partner-rates'), async (_req, res) => {
  const { rows } = await pool.query(
    `select p.partner_id, p.partner_name, p.rate_id, r.percent::float8 as percent
       from partner_salary p
       left join salary_rates r on r.id = p.rate_id`,
  )
  res.json({ success: true, assignments: rows })
})

salary.put('/assignments/:partnerId', requireSection('partner-rates', 'write'), async (req, res) => {
  try {
    const { partnerName, rateId } = req.body ?? {}
    if (!partnerName) return res.status(400).json({ success: false, error: 'Нет имени партнёра' })

    // Нет ставки — хранить нечего, чистим запись.
    if (!rateId) {
      await pool.query('delete from partner_salary where partner_id = $1', [req.params.partnerId])
      return res.json({ success: true, cleared: true })
    }

    await pool.query(
      `insert into partner_salary (partner_id, partner_name, rate_id, updated_at)
       values ($1,$2,$3, now())
       on conflict (partner_id) do update
         set partner_name = excluded.partner_name,
             rate_id      = excluded.rate_id,
             updated_at   = now()`,
      [req.params.partnerId, partnerName, rateId],
    )
    await writeAudit(req, 'PARTNER_SALARY_SET', 'partner', req.params.partnerId, { partnerName, rateId })
    res.json({ success: true })
  } catch (e: any) {
    if (e.code === '23503') {
      return res.status(400).json({ success: false, error: 'Ставка не найдена' })
    }
    res.status(500).json({ success: false, error: e.message })
  }
})

// ── Расчёт общего зарплатного листа за период ─────────────────────────────────

type Line = { partnerId: string; partnerName: string; percent: number; turnoverRub: number; accruedRub: number }

/**
 * Считает общий лист за период: по каждому партнёру со ставкой берём оборот
 * (оплаченные счета) × ставку. Обороты тянем с сервера, чтобы суммы не
 * приходили с клиента.
 */
async function computeSheet(dateFrom: string, dateTo: string) {
  if (!dateFrom || !dateTo) throw Object.assign(new Error('Не задан период'), { status: 400 })
  if (dateFrom > dateTo) throw Object.assign(new Error('Начало периода позже конца'), { status: 400 })

  const { rows: partners } = await pool.query<{ partner_id: string; partner_name: string; percent: number }>(
    `select p.partner_id, p.partner_name, r.percent::float8 as percent
       from partner_salary p
       join salary_rates r on r.id = p.rate_id
      where r.is_active
      order by p.partner_name`,
  )

  const lines: Line[] = await mapLimit(partners, 6, async (p) => {
    // ?partner= понимает только UUID; оборот — totalRevenue по оплаченным.
    const q = new URLSearchParams({
      partner: p.partner_id,
      status: 'PAID',
      dateFrom,
      dateTo,
      limit: '1',
    })
    let turnoverRub = 0
    try {
      const inv = await lp<{ stats?: { totalRevenue?: number } }>(`/v1/invoices?${q}`)
      turnoverRub = Math.round(Number(inv.stats?.totalRevenue) || 0)
    } catch {
      turnoverRub = 0
    }
    const accruedRub = Math.round(turnoverRub * (p.percent / 100))
    return { partnerId: p.partner_id, partnerName: p.partner_name, percent: p.percent, turnoverRub, accruedRub }
  })

  const totalRub = lines.reduce((a, l) => a + l.accruedRub, 0)
  return { dateFrom, dateTo, lines, totalRub, partnersCount: lines.length }
}

salary.post('/preview', requireSection('salary'), async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.body ?? {}
    res.json({ success: true, sheet: await computeSheet(dateFrom, dateTo) })
  } catch (e: any) {
    res.status(e.status ?? 500).json({ success: false, error: e.message })
  }
})

salary.post('/sheets', requireSection('salary', 'write'), async (req, res) => {
  const client = await pool.connect()
  try {
    const { dateFrom, dateTo, comment } = req.body ?? {}
    const c = await computeSheet(dateFrom, dateTo)
    const number = await nextSalaryNumber()

    await client.query('begin')
    const { rows } = await client.query(
      `insert into salary_sheets (number, date_from, date_to, total_rub, partners_count, comment)
       values ($1,$2,$3,$4,$5,$6) returning *`,
      [number, c.dateFrom, c.dateTo, c.totalRub, c.partnersCount, comment?.trim() || null],
    )
    const sheet = rows[0]
    for (const l of c.lines) {
      await client.query(
        `insert into salary_sheet_lines (sheet_id, partner_id, partner_name, percent, turnover_rub, accrued_rub)
         values ($1,$2,$3,$4,$5,$6)`,
        [sheet.id, l.partnerId, l.partnerName, l.percent, l.turnoverRub, l.accruedRub],
      )
    }
    await client.query('commit')
    await writeAudit(req, 'SALARY_SHEET_CREATED', 'salary_sheet', sheet.id, { number, total: c.totalRub })
    res.status(201).json({ success: true, sheet })
  } catch (e: any) {
    await client.query('rollback').catch(() => {})
    res.status(e.status ?? 500).json({ success: false, error: e.message })
  } finally {
    client.release()
  }
})

salary.get('/sheets', requireSection('salary'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const { rows } = await pool.query(
    'select * from salary_sheets order by created_at desc limit $1',
    [limit],
  )
  res.json({ success: true, sheets: rows, total: rows.length })
})

salary.get('/sheets/:id', requireSection('salary'), async (req, res) => {
  const { rows } = await pool.query('select * from salary_sheets where id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ success: false, error: 'Лист не найден' })
  const { rows: lines } = await pool.query(
    `select partner_id, partner_name, percent::float8 as percent, turnover_rub, accrued_rub
       from salary_sheet_lines where sheet_id = $1 order by accrued_rub desc`,
    [req.params.id],
  )
  res.json({ success: true, sheet: rows[0], lines })
})

salary.delete('/sheets/:id', requireSection('salary', 'write'), async (req, res) => {
  const { rowCount } = await pool.query('delete from salary_sheets where id = $1', [req.params.id])
  if (!rowCount) return res.status(404).json({ success: false, error: 'Лист не найден' })
  await writeAudit(req, 'SALARY_SHEET_DELETED', 'salary_sheet', req.params.id)
  res.json({ success: true })
})
