import { Router } from 'express'
import bcrypt from 'bcrypt'
import { pool } from './db.js'
import { requireAuth, requireSection, writeAudit } from './auth.js'
import { SECTIONS, type Permissions } from './authSchema.js'

export const adminUsers = Router()
adminUsers.use(requireAuth)

const USER_COLS = `u.id, u.username, u.full_name, u.role_id, u.is_active, u.last_login_at,
                   u.created_at, r.name as role_name, r.is_system as role_is_system`

// ── Пользователи ─────────────────────────────────────────────────────────────

adminUsers.get('/users', requireSection('admin-users'), async (_req, res) => {
  const { rows } = await pool.query(
    `select ${USER_COLS} from admin_users u
       left join admin_roles r on r.id = u.role_id
      order by u.created_at desc`,
  )
  res.json({ success: true, users: rows, total: rows.length })
})

adminUsers.post('/users', requireSection('admin-users', 'write'), async (req, res) => {
  try {
    const { username, fullName, password, roleId, isActive } = req.body ?? {}
    if (!username || !password || !roleId) {
      return res.status(400).json({ success: false, error: 'Нужны логин, пароль и роль' })
    }
    if (String(password).length < 8) {
      return res.status(400).json({ success: false, error: 'Пароль короче 8 символов' })
    }

    const { rows } = await pool.query(
      `insert into admin_users (username, full_name, password_hash, role_id, is_active)
       values ($1,$2,$3,$4,$5) returning id, username`,
      [
        String(username).trim(),
        fullName ?? null,
        await bcrypt.hash(String(password), 12),
        roleId,
        isActive !== false,
      ],
    )
    await writeAudit(req, 'USER_CREATED', 'admin_user', rows[0].id, { username })
    res.status(201).json({ success: true, user: rows[0] })
  } catch (e: any) {
    if (e.code === '23505') {
      return res.status(409).json({ success: false, error: 'Такой логин уже занят' })
    }
    res.status(500).json({ success: false, error: e.message })
  }
})

adminUsers.patch('/users/:id', requireSection('admin-users', 'write'), async (req, res) => {
  try {
    const { fullName, roleId, isActive, password } = req.body ?? {}
    const id = req.params.id

    // Нельзя отключить себя или сменить себе роль: так можно потерять доступ
    // к админке целиком, и вернуть его будет некому.
    if (id === req.user!.id) {
      if (isActive === false) {
        return res.status(400).json({ success: false, error: 'Нельзя отключить самого себя' })
      }
      if (roleId && roleId !== req.user!.role_id) {
        return res.status(400).json({ success: false, error: 'Нельзя сменить роль самому себе' })
      }
    }

    const sets: string[] = []
    const vals: any[] = []
    const push = (sql: string, v: any) => {
      vals.push(v)
      sets.push(`${sql} = $${vals.length}`)
    }

    if (fullName !== undefined) push('full_name', fullName)
    if (roleId !== undefined) push('role_id', roleId)
    if (typeof isActive === 'boolean') push('is_active', isActive)
    if (password) {
      if (String(password).length < 8) {
        return res.status(400).json({ success: false, error: 'Пароль короче 8 символов' })
      }
      push('password_hash', await bcrypt.hash(String(password), 12))
    }
    if (!sets.length) return res.status(400).json({ success: false, error: 'Нечего менять' })

    vals.push(id)
    const { rowCount } = await pool.query(
      `update admin_users set ${sets.join(', ')}, updated_at = now() where id = $${vals.length}`,
      vals,
    )
    if (!rowCount) return res.status(404).json({ success: false, error: 'Пользователь не найден' })

    // Смена пароля или отключение — выкидываем все его сессии.
    if (password || isActive === false) {
      await pool.query('delete from admin_sessions where user_id = $1', [id])
    }
    await writeAudit(req, 'USER_UPDATED', 'admin_user', id, {
      fields: Object.keys(req.body ?? {}).filter((k) => k !== 'password'),
      passwordChanged: Boolean(password),
    })
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

adminUsers.delete('/users/:id', requireSection('admin-users', 'write'), async (req, res) => {
  if (req.params.id === req.user!.id) {
    return res.status(400).json({ success: false, error: 'Нельзя удалить самого себя' })
  }
  const { rowCount } = await pool.query('delete from admin_users where id = $1', [req.params.id])
  if (!rowCount) return res.status(404).json({ success: false, error: 'Пользователь не найден' })
  await writeAudit(req, 'USER_DELETED', 'admin_user', req.params.id)
  res.json({ success: true })
})

/** Принудительно завершить все сессии пользователя. */
adminUsers.post('/users/:id/kick', requireSection('admin-users', 'write'), async (req, res) => {
  const { rowCount } = await pool.query('delete from admin_sessions where user_id = $1', [
    req.params.id,
  ])
  await writeAudit(req, 'USER_SESSIONS_REVOKED', 'admin_user', req.params.id, { sessions: rowCount })
  res.json({ success: true, revoked: rowCount })
})

// ── Роли ─────────────────────────────────────────────────────────────────────

adminUsers.get('/roles', requireSection('admin-roles'), async (_req, res) => {
  const { rows } = await pool.query(
    `select r.*, (select count(*)::int from admin_users u where u.role_id = r.id) as users_count
       from admin_roles r order by r.is_system desc, r.name`,
  )
  res.json({ success: true, roles: rows, sections: SECTIONS })
})

adminUsers.post('/roles', requireSection('admin-roles', 'write'), async (req, res) => {
  try {
    const { name, description, permissions } = req.body ?? {}
    if (!name) return res.status(400).json({ success: false, error: 'Нужно название роли' })

    const { rows } = await pool.query(
      `insert into admin_roles (name, description, permissions, is_system)
       values ($1,$2,$3,false) returning id, name`,
      [String(name).trim(), description ?? null, JSON.stringify(permissions ?? {})],
    )
    await writeAudit(req, 'ROLE_CREATED', 'admin_role', rows[0].id, { name })
    res.status(201).json({ success: true, role: rows[0] })
  } catch (e: any) {
    if (e.code === '23505') {
      return res.status(409).json({ success: false, error: 'Роль с таким названием уже есть' })
    }
    res.status(500).json({ success: false, error: e.message })
  }
})

adminUsers.patch('/roles/:id', requireSection('admin-roles', 'write'), async (req, res) => {
  try {
    const { rows: cur } = await pool.query('select * from admin_roles where id = $1', [
      req.params.id,
    ])
    if (!cur.length) return res.status(404).json({ success: false, error: 'Роль не найдена' })

    // У системной роли права менять нельзя: она гарантирует, что хотя бы
    // кто-то всегда может зайти в администрирование.
    if (cur[0].is_system && req.body?.permissions) {
      return res.status(400).json({
        success: false,
        error: 'У системной роли «Администратор» права всегда полные',
      })
    }

    const { name, description, permissions } = req.body ?? {}
    const before: Permissions = cur[0].permissions ?? {}

    await pool.query(
      `update admin_roles
          set name = coalesce($1, name),
              description = coalesce($2, description),
              permissions = coalesce($3, permissions),
              updated_at = now()
        where id = $4`,
      [
        name ?? null,
        description ?? null,
        permissions ? JSON.stringify(permissions) : null,
        req.params.id,
      ],
    )

    const changed = permissions
      ? SECTIONS.filter((s) => (before[s.key] ?? 'none') !== (permissions[s.key] ?? 'none')).map(
          (s) => `${s.label}: ${before[s.key] ?? 'none'} → ${permissions[s.key] ?? 'none'}`,
        )
      : []
    await writeAudit(req, 'ROLE_UPDATED', 'admin_role', req.params.id, {
      name: cur[0].name,
      changed,
    })
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

adminUsers.delete('/roles/:id', requireSection('admin-roles', 'write'), async (req, res) => {
  const { rows } = await pool.query('select * from admin_roles where id = $1', [req.params.id])
  if (!rows.length) return res.status(404).json({ success: false, error: 'Роль не найдена' })
  if (rows[0].is_system) {
    return res.status(400).json({ success: false, error: 'Системную роль удалить нельзя' })
  }

  const { rows: used } = await pool.query(
    'select count(*)::int as n from admin_users where role_id = $1',
    [req.params.id],
  )
  if (used[0].n > 0) {
    return res.status(409).json({
      success: false,
      error: `Роль назначена ${used[0].n} пользователям — сначала переведите их на другую`,
    })
  }

  await pool.query('delete from admin_roles where id = $1', [req.params.id])
  await writeAudit(req, 'ROLE_DELETED', 'admin_role', req.params.id, { name: rows[0].name })
  res.json({ success: true })
})

// ── Журнал действий в самой админке ──────────────────────────────────────────

adminUsers.get('/audit', requireSection('admin-users'), async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500)
  const { rows } = await pool.query(
    'select * from admin_audit order by created_at desc limit $1',
    [limit],
  )
  res.json({ success: true, entries: rows })
})
