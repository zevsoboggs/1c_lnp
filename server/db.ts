import pg from 'pg'

// pg по умолчанию превращает date в JS Date и применяет таймзону процесса:
// 2026-07-01 приезжает как 2026-06-30T19:00Z, то есть период съезжает на сутки.
// Календарной дате таймзона не нужна — отдаём её строкой, как в базе.
pg.types.setTypeParser(pg.types.builtins.DATE, (v) => v)

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
})

/**
 * Схема расчётных листов.
 *
 * Денежные величины: рубли храним в копейках (bigint) — как в admin-api,
 * чтобы не ловить float на суммах. USDT — numeric, у него своя точность.
 *
 * Курс сохраняется вместе с листом: он меняется каждую минуту, и без
 * зафиксированного значения пересчёт старого листа дал бы другую сумму.
 * Имя/код партнёра тоже копируются — лист должен читаться через год,
 * даже если партнёра переименовали.
 */
const SCHEMA = `
create table if not exists payout_sheets (
  id             uuid primary key default gen_random_uuid(),
  number         text not null unique,
  partner_id     uuid not null,
  partner_name   text not null,
  partner_code   text,
  date_from      date not null,
  date_to        date not null,
  percent        numeric(6,3) not null,
  invoices_paid  integer not null default 0,
  turnover_rub   bigint not null,
  rate_usdt_rub  numeric(18,8) not null,
  rate_source    text not null default 'rapira',
  rate_at        timestamptz not null,
  turnover_usdt  numeric(18,2) not null,
  payout_rub     bigint not null,
  payout_usdt    numeric(18,2) not null,
  usdt_missing   integer not null default 0,
  manual_turnover boolean not null default false,
  comment        text,
  created_at     timestamptz not null default now()
);

-- Защита от двойной выплаты: один партнёр за один период — один лист.
create unique index if not exists payout_sheets_partner_period_uniq
  on payout_sheets (partner_id, date_from, date_to);

create index if not exists payout_sheets_created_at_idx
  on payout_sheets (created_at desc);

create sequence if not exists payout_sheet_number_seq;
`

export async function migrate() {
  await pool.query(SCHEMA)
}

/** Номер вида РЛ-00001. */
export async function nextNumber(): Promise<string> {
  const { rows } = await pool.query<{ n: string }>(
    "select nextval('payout_sheet_number_seq') as n",
  )
  return `РЛ-${String(rows[0].n).padStart(5, '0')}`
}
