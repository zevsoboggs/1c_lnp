import { pool } from './db.js'
import bcrypt from 'bcrypt'
import crypto from 'node:crypto'

/**
 * Пользователи, роли и права админки.
 *
 * Права — это карта «раздел → уровень» в jsonb, а не отдельная таблица строк:
 * разделов три десятка и они добавляются часто, а jsonb переживает это без
 * миграций. Уровня три: нет доступа / только чтение / полный.
 */
const SCHEMA = `
create table if not exists admin_roles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  -- Системную роль нельзя удалить и нельзя урезать ей права: иначе можно
  -- запереть самих себя снаружи админки.
  is_system   boolean not null default false,
  permissions jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists admin_users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,
  full_name     text,
  password_hash text not null,
  role_id       uuid references admin_roles(id) on delete restrict,
  is_active     boolean not null default true,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists admin_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references admin_users(id) on delete cascade,
  -- Храним только хеш токена: утечка таблицы не даст войти под чужой сессией.
  token_hash text not null unique,
  expires_at timestamptz not null,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists admin_sessions_user_idx on admin_sessions (user_id);
create index if not exists admin_sessions_expires_idx on admin_sessions (expires_at);

-- Кто что делал в самой админке: у admin-api аудит пишет всех как «1С»,
-- по нему не понять, какой оператор нажал кнопку.
create table if not exists admin_audit (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references admin_users(id) on delete set null,
  username   text,
  action     text not null,
  entity     text,
  entity_id  text,
  details    jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_created_idx on admin_audit (created_at desc);
`

/** Все разделы админки. Ключ = name ресурса в Refine. */
export const SECTIONS: Array<{ key: string; label: string; group: string }> = [
  { key: 'transactions', label: 'Транзакции', group: 'Платежи' },
  { key: 'invoices', label: 'Инвойсы', group: 'Платежи' },
  { key: 'refund-requests', label: 'Возвраты', group: 'Платежи' },
  { key: 'partners', label: 'Партнёры', group: 'Партнёры' },
  { key: 'partner-moderation', label: 'Модерация', group: 'Партнёры' },
  { key: 'hierarchy', label: 'Иерархия', group: 'Партнёры' },
  { key: 'users', label: 'Пользователи', group: 'Партнёры' },
  { key: 'terminals', label: 'Терминалы', group: 'Партнёры' },
  { key: 'webhooks', label: 'Вебхуки', group: 'Партнёры' },
  { key: 'finance', label: 'Финансы: сводка', group: 'Финансы' },
  { key: 'settlements', label: 'Расчёты', group: 'Финансы' },
  { key: 'payouts', label: 'Выплаты', group: 'Финансы' },
  { key: 'withdrawals', label: 'Выводы', group: 'Финансы' },
  { key: 'payout-sheet', label: 'Расчёт заработка', group: 'Финансы' },
  { key: 'salary', label: 'Зарплата', group: 'Финансы' },
  { key: 'markups', label: 'Наценки', group: 'Финансы' },
  { key: 'pos-markups', label: 'POS-наценки', group: 'Финансы' },
  { key: 'referral-overrides', label: 'Реф. наценки', group: 'Финансы' },
  { key: 'vcc', label: 'Виртуальные карты', group: 'Финансы' },
  { key: 'reports', label: 'Отчёты по партнёрам', group: 'Финансы' },
  { key: 'aml-guard', label: 'AML-Guard', group: 'Безопасность' },
  { key: 'payer-audit', label: 'Аудит плательщиков', group: 'Безопасность' },
  { key: 'declarations', label: 'Декларации', group: 'Безопасность' },
  { key: 'api-logs', label: 'API-логи', group: 'Журналы' },
  { key: 'audit-logs', label: 'Аудит действий', group: 'Журналы' },
  { key: 'kyc-verifications', label: 'KYC: верификации', group: 'KYC' },
  { key: 'kyc-billing', label: 'KYC: биллинг', group: 'KYC' },
  { key: 'info-bot', label: 'Info-бот', group: 'Прочее' },
  { key: 'esim', label: 'eSIM', group: 'Прочее' },
  { key: 'miniapp-orders', label: 'Мини-апп: заказы', group: 'Мини-апп' },
  { key: 'miniapp-users', label: 'Мини-апп: пользователи', group: 'Мини-апп' },
  { key: 'miniapp-referrals', label: 'Мини-апп: рефералка', group: 'Мини-апп' },
  { key: 'miniapp-broadcast', label: 'Мини-апп: рассылки', group: 'Мини-апп' },
  { key: 'miniapp-maintenance', label: 'Мини-апп: техработы', group: 'Мини-апп' },
  { key: 'employees', label: 'Сотрудники', group: 'Справочники' },
  { key: 'salary-rates', label: 'Ставки', group: 'Справочники' },
  { key: 'partner-rates', label: 'Проценты партнёров', group: 'Справочники' },
  { key: 'admin-users', label: 'Пользователи системы', group: 'Администрирование' },
  { key: 'admin-roles', label: 'Роли', group: 'Администрирование' },
]

export type Level = 'none' | 'read' | 'write'
export type Permissions = Record<string, Level>

const all = (level: Level): Permissions =>
  Object.fromEntries(SECTIONS.map((s) => [s.key, level])) as Permissions

const readOnly = (keys: string[]): Permissions =>
  Object.fromEntries(SECTIONS.map((s) => [s.key, keys.includes(s.key) ? 'read' : 'none'])) as Permissions

/** Стартовые роли — как «Администратор» и «Только просмотр» в типовых 1С. */
const SEED_ROLES: Array<{ name: string; description: string; is_system: boolean; permissions: Permissions }> = [
  {
    name: 'Администратор',
    description: 'Полный доступ ко всем разделам, включая управление доступом',
    is_system: true,
    permissions: all('write'),
  },
  {
    name: 'Финансист',
    description: 'Финансы и расчёты, платежи только на чтение',
    is_system: false,
    permissions: {
      ...all('none'),
      transactions: 'read',
      invoices: 'read',
      finance: 'read',
      settlements: 'read',
      payouts: 'read',
      withdrawals: 'write',
      'payout-sheet': 'write',
      markups: 'read',
      'pos-markups': 'read',
      vcc: 'read',
      partners: 'read',
    },
  },
  {
    name: 'Поддержка',
    description: 'Просмотр платежей, клиентов и логов. Деньги двигать нельзя',
    is_system: false,
    permissions: readOnly([
      'transactions',
      'invoices',
      'partners',
      'users',
      'kyc-verifications',
      'api-logs',
      'miniapp-orders',
      'miniapp-users',
      'esim',
    ]),
  },
  {
    name: 'Наблюдатель',
    description: 'Только чтение везде, кроме администрирования',
    is_system: false,
    permissions: {
      ...all('read'),
      'admin-users': 'none',
      'admin-roles': 'none',
    },
  },
]

/**
 * Создаёт таблицы, стартовые роли и первого администратора.
 * Пароль генерируется и печатается в лог ровно один раз — сохранить его
 * больше неоткуда, только сбрасывать.
 */
export async function migrateAuth() {
  await pool.query(SCHEMA)

  for (const r of SEED_ROLES) {
    await pool.query(
      `insert into admin_roles (name, description, is_system, permissions)
       values ($1,$2,$3,$4)
       on conflict (name) do nothing`,
      [r.name, r.description, r.is_system, JSON.stringify(r.permissions)],
    )
  }

  const { rows: existing } = await pool.query('select count(*)::int as n from admin_users')
  if (existing[0].n > 0) return

  const { rows: adminRole } = await pool.query(
    "select id from admin_roles where name = 'Администратор' limit 1",
  )
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || crypto.randomBytes(9).toString('base64url')
  const hash = await bcrypt.hash(password, 12)

  await pool.query(
    `insert into admin_users (username, full_name, password_hash, role_id)
     values ($1,$2,$3,$4)`,
    ['admin', 'Администратор', hash, adminRole[0].id],
  )

  console.log(
    [
      '',
      '='.repeat(64),
      '  Создан первый пользователь админки',
      '',
      '     логин:  admin',
      `     пароль: ${password}`,
      '',
      '  Пароль показан один раз — сохраните его сейчас.',
      '='.repeat(64),
      '',
    ].join('\n'),
  )
}

/** Роль «Администратор» всегда имеет полный доступ, даже к новым разделам. */
export function effectivePermissions(role: {
  is_system: boolean
  permissions: Permissions
}): Permissions {
  if (role.is_system) return all('write')
  // Раздел, которого не было при создании роли, по умолчанию закрыт.
  return { ...all('none'), ...(role.permissions ?? {}) }
}
