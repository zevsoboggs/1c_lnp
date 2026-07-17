import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import { pool } from './db.js'
import { effectivePermissions, SECTIONS, type Level, type Permissions } from './authSchema.js'

const COOKIE = 'lnp_admin'
const TTL_DAYS = 7

export type SessionUser = {
  id: string
  username: string
  full_name: string | null
  role_id: string | null
  role_name: string | null
  is_system: boolean
  permissions: Permissions
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser
    }
  }
}

const hashToken = (t: string) => crypto.createHash('sha256').update(t).digest('hex')

export async function writeAudit(
  req: Request,
  action: string,
  entity?: string,
  entityId?: string,
  details?: unknown,
) {
  try {
    await pool.query(
      `insert into admin_audit (user_id, username, action, entity, entity_id, details, ip_address)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [
        req.user?.id ?? null,
        req.user?.username ?? null,
        action,
        entity ?? null,
        entityId ?? null,
        details ? JSON.stringify(details) : null,
        req.ip ?? null,
      ],
    )
  } catch {
    /* аудит не должен ронять запрос */
  }
}

/** Достаёт пользователя по токену из cookie. Просроченные сессии не считаются. */
async function userFromRequest(req: Request): Promise<SessionUser | null> {
  const token = req.cookies?.[COOKIE]
  if (!token) return null

  const { rows } = await pool.query(
    `select u.id, u.username, u.full_name, u.role_id, u.is_active,
            r.name as role_name, r.is_system, r.permissions
       from admin_sessions s
       join admin_users u on u.id = s.user_id
       left join admin_roles r on r.id = u.role_id
      where s.token_hash = $1 and s.expires_at > now()
      limit 1`,
    [hashToken(token)],
  )
  const row = rows[0]
  if (!row || !row.is_active) return null

  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    role_id: row.role_id,
    role_name: row.role_name,
    is_system: Boolean(row.is_system),
    permissions: effectivePermissions({
      is_system: Boolean(row.is_system),
      permissions: row.permissions ?? {},
    }),
  }
}

/** Пускает дальше только с живой сессией. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await userFromRequest(req)
  if (!user) return res.status(401).json({ success: false, error: 'Требуется вход', code: 'NO_AUTH' })
  req.user = user
  next()
}

/**
 * Проверка права на раздел.
 *
 * Права проверяются на сервере, а не только в интерфейсе: спрятать пункт меню
 * — это удобство, а не защита; запрос можно послать и мимо страницы.
 */
export function requireSection(section: string, need: Level = 'read') {
  return (req: Request, res: Response, next: NextFunction) => {
    const level = req.user?.permissions?.[section] ?? 'none'
    const ok = need === 'read' ? level === 'read' || level === 'write' : level === 'write'
    if (!ok) {
      return res.status(403).json({
        success: false,
        error: `Нет доступа к разделу «${SECTIONS.find((s) => s.key === section)?.label ?? section}»`,
        code: 'NO_ACCESS',
      })
    }
    next()
  }
}

export const auth = Router()

// Тормозим перебор пароля: bcrypt(12) стоит ~200мс за попытку, но без лимита
// ничто не мешает молотить в лоб. 10 попыток за 5 минут с одного IP.
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // удачный вход счётчик не тратит
  message: { success: false, error: 'Слишком много попыток входа. Подождите 5 минут.' },
})

auth.post('/login', loginLimiter, async (req, res) => {
  const username = String(req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Введите логин и пароль' })
  }

  const { rows } = await pool.query(
    `select u.*, r.name as role_name, r.is_system, r.permissions
       from admin_users u left join admin_roles r on r.id = u.role_id
      where lower(u.username) = lower($1) limit 1`,
    [username],
  )
  const u = rows[0]

  // Сверяем пароль даже когда пользователя нет: иначе по времени ответа
  // видно, какие логины существуют.
  const hash = u?.password_hash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin'
  const ok = await bcrypt.compare(password, hash)

  // Один и тот же ответ на «нет пользователя», «неверный пароль» и «отключён»:
  // иначе по тексту видно, что пара логин+пароль верна, но аккаунт выключен —
  // это подсказка атакующему после увольнения оператора.
  if (!u || !ok || !u.is_active) {
    return res.status(401).json({ success: false, error: 'Неверный логин или пароль' })
  }

  const token = crypto.randomBytes(32).toString('base64url')
  const expires = new Date(Date.now() + TTL_DAYS * 86_400_000)
  await pool.query(
    `insert into admin_sessions (user_id, token_hash, expires_at, ip_address, user_agent)
     values ($1,$2,$3,$4,$5)`,
    [u.id, hashToken(token), expires, req.ip ?? null, req.get('user-agent') ?? null],
  )
  await pool.query('update admin_users set last_login_at = now() where id = $1', [u.id])

  res.cookie(COOKIE, token, {
    httpOnly: true, // недоступна из JS — XSS не утащит сессию
    sameSite: 'lax',
    // Secure по умолчанию ВКЛючён; выключается только явным ADMIN_INSECURE_COOKIE=1
    // для локальной разработки по http. Полагаться на NODE_ENV нельзя: забыл
    // выставить в проде — и сессия уходит по открытому http.
    secure: process.env.ADMIN_INSECURE_COOKIE !== '1',
    expires,
    path: '/',
  })

  req.user = {
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    role_id: u.role_id,
    role_name: u.role_name,
    is_system: Boolean(u.is_system),
    permissions: effectivePermissions({ is_system: Boolean(u.is_system), permissions: u.permissions ?? {} }),
  }
  await writeAudit(req, 'LOGIN')

  res.json({ success: true, user: req.user })
})

auth.post('/logout', async (req, res) => {
  const token = req.cookies?.[COOKIE]
  if (token) {
    await pool.query('delete from admin_sessions where token_hash = $1', [hashToken(token)])
  }
  res.clearCookie(COOKIE, { path: '/' })
  res.json({ success: true })
})

auth.get('/me', async (req, res) => {
  const user = await userFromRequest(req)
  if (!user) return res.status(401).json({ success: false, error: 'Не авторизован' })
  res.json({ success: true, user, sections: SECTIONS })
})

/** Смена собственного пароля. */
auth.post('/password', requireAuth, async (req, res) => {
  const current = String(req.body?.currentPassword ?? '')
  const next = String(req.body?.newPassword ?? '')
  if (next.length < 8) {
    return res.status(400).json({ success: false, error: 'Новый пароль короче 8 символов' })
  }

  const { rows } = await pool.query('select password_hash from admin_users where id = $1', [
    req.user!.id,
  ])
  if (!(await bcrypt.compare(current, rows[0].password_hash))) {
    return res.status(400).json({ success: false, error: 'Текущий пароль неверен' })
  }

  await pool.query('update admin_users set password_hash = $1, updated_at = now() where id = $2', [
    await bcrypt.hash(next, 12),
    req.user!.id,
  ])
  // Остальные сессии этого пользователя гасим: смена пароля должна выкидывать
  // тех, кто вошёл раньше.
  await pool.query('delete from admin_sessions where user_id = $1 and token_hash <> $2', [
    req.user!.id,
    hashToken(req.cookies?.[COOKIE] ?? ''),
  ])
  await writeAudit(req, 'PASSWORD_CHANGED')
  res.json({ success: true })
})
