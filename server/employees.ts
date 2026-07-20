import { Router } from 'express'
import { pool } from './db.js'
import { requireAuth, requireSection, writeAudit } from './auth.js'

/**
 * Справочник сотрудников компании.
 *
 * Это внутренние данные админки (как пользователи/роли), а не сущность
 * платёжного admin-api, поэтому живут в собственной базе.
 *
 * percent — доля сотрудника, из которой будущий модуль зарплаты посчитает
 * выплату от оборота. Храним numeric(6,3), как процент в расчётных листах,
 * чтобы дробные ставки (напр. 2.5 %) считались без потери точности.
 */
const SCHEMA = `
create table if not exists employees (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  position    text,
  email       text,
  phone       text,
  telegram    text,
  percent     numeric(6,3) not null default 0,
  is_active   boolean not null default true,
  comment     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists employees_active_idx on employees (is_active);
create index if not exists employees_created_idx on employees (created_at desc);
`

export async function migrateEmployees() {
  await pool.query(SCHEMA)
}

export const employees = Router()
employees.use(requireAuth)

const COLS = `id, full_name, position, email, phone, telegram,
              percent::float8 as percent, is_active, comment, created_at, updated_at`

/** Ставка приходит строкой/числом — приводим к 0..100 с тремя знаками. */
function parsePercent(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 100) return NaN
  return Math.round(n * 1000) / 1000
}

employees.get('/', requireSection('employees'), async (_req, res) => {
  const { rows } = await pool.query(
    `select ${COLS} from employees order by is_active desc, full_name`,
  )
  res.json({ success: true, employees: rows, total: rows.length })
})

employees.post('/', requireSection('employees', 'write'), async (req, res) => {
  try {
    const { fullName, position, email, phone, telegram, percent, isActive, comment } = req.body ?? {}
    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ success: false, error: 'Нужно ФИО сотрудника' })
    }
    const pct = parsePercent(percent)
    if (Number.isNaN(pct)) {
      return res.status(400).json({ success: false, error: 'Процент должен быть числом от 0 до 100' })
    }

    const { rows } = await pool.query(
      `insert into employees (full_name, position, email, phone, telegram, percent, is_active, comment)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id, full_name`,
      [
        String(fullName).trim(),
        position?.trim() || null,
        email?.trim() || null,
        phone?.trim() || null,
        telegram?.trim() || null,
        pct ?? 0,
        isActive !== false,
        comment?.trim() || null,
      ],
    )
    await writeAudit(req, 'EMPLOYEE_CREATED', 'employee', rows[0].id, { fullName })
    res.status(201).json({ success: true, employee: rows[0] })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

employees.patch('/:id', requireSection('employees', 'write'), async (req, res) => {
  try {
    const { fullName, position, email, phone, telegram, percent, isActive, comment } = req.body ?? {}

    const sets: string[] = []
    const vals: any[] = []
    const push = (sql: string, v: any) => {
      vals.push(v)
      sets.push(`${sql} = $${vals.length}`)
    }

    if (fullName !== undefined) {
      if (!String(fullName).trim()) {
        return res.status(400).json({ success: false, error: 'ФИО не может быть пустым' })
      }
      push('full_name', String(fullName).trim())
    }
    if (position !== undefined) push('position', position?.trim() || null)
    if (email !== undefined) push('email', email?.trim() || null)
    if (phone !== undefined) push('phone', phone?.trim() || null)
    if (telegram !== undefined) push('telegram', telegram?.trim() || null)
    if (comment !== undefined) push('comment', comment?.trim() || null)
    if (typeof isActive === 'boolean') push('is_active', isActive)
    if (percent !== undefined) {
      const pct = parsePercent(percent)
      if (Number.isNaN(pct)) {
        return res.status(400).json({ success: false, error: 'Процент должен быть числом от 0 до 100' })
      }
      push('percent', pct ?? 0)
    }
    if (!sets.length) return res.status(400).json({ success: false, error: 'Нечего менять' })

    vals.push(req.params.id)
    const { rowCount } = await pool.query(
      `update employees set ${sets.join(', ')}, updated_at = now() where id = $${vals.length}`,
      vals,
    )
    if (!rowCount) return res.status(404).json({ success: false, error: 'Сотрудник не найден' })

    await writeAudit(req, 'EMPLOYEE_UPDATED', 'employee', req.params.id, {
      fields: Object.keys(req.body ?? {}),
    })
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

employees.delete('/:id', requireSection('employees', 'write'), async (req, res) => {
  const { rows } = await pool.query('select full_name from employees where id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ success: false, error: 'Сотрудник не найден' })
  await pool.query('delete from employees where id = $1', [req.params.id])
  await writeAudit(req, 'EMPLOYEE_DELETED', 'employee', req.params.id, { fullName: rows[0].full_name })
  res.json({ success: true })
})
