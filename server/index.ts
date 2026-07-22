import express from 'express'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { pool, migrate, nextNumber } from './db.js'
import { renderDocument } from './documentTemplate.js'
import { getRate } from './rapira.js'
import { vcc } from './vcc.js'
import { miniapp } from './miniapp.js'
import { auth, requireAuth, requireSection, writeAudit } from './auth.js'
import { adminUsers } from './adminUsers.js'
import { employees, migrateEmployees } from './employees.js'
import { salary, migrateSalary } from './salary.js'
import { migrateAuth } from './authSchema.js'

const app = express()
// Заголовки безопасности. CSP отдельной строкой ниже — дефолтный helmet
// сломал бы Vite в дев-режиме, поэтому оставляем базовый набор.
app.use(helmet({ contentSecurityPolicy: false }))
// Лимит тела: без него можно прислать гигабайтный JSON и положить процесс.
app.use(express.json({ limit: '1mb' }))
app.use(cookieParser())
// За прокси, иначе req.ip в аудите будет адресом прокси, а не оператора.
app.set('trust proxy', 1)

// Вход/выход — единственное, что доступно без сессии.
app.use('/api/auth', auth)

// Всё остальное — только после входа. Ключи к чужим API лежат на этом
// сервере, поэтому открытый прокси означал бы, что доступ к ним есть
// у любого, кто знает адрес.
app.use('/api/admin', adminUsers)

// Справочник сотрудников — внутренние данные админки, гейт на раздел стоит
// внутри роутера (requireSection('employees')).
app.use('/api/employees', employees)

// Зарплата: ставки, назначения партнёрам и зарплатные листы. Разные права
// (salary-rates / partner-rates / salary) проверяются внутри роутера.
app.use('/api/salary', salary)

// requireSection на весь роутер: PAN/CVV и движение денег по картам должны
// быть закрыты правом vcc, а не только фактом входа. GET — чтение, остальное —
// запись. Сам роутер это не перепроверяет, поэтому гейт стоит здесь.
app.use('/api/vcc', requireAuth, vccGate, vcc)

// Мини-апп: у orders/users/referrals/broadcast/maintenance свои права,
// поэтому раздел выбирается по пути. Один общий requireAuth недостаточен —
// иначе оператор без права miniapp-broadcast мог бы разослать сообщение всем.
app.use('/api/miniapp', requireAuth, miniappGate, miniapp)

const LP_API = (process.env.ADMIN_API_URL || 'https://loveandpay.io').replace(/\/$/, '')
const LP_KEY = (process.env.ADMIN_API_KEY || '').split(',')[0].trim()
const PORT = Number(process.env.PORT || 5274)

if (!LP_KEY) console.warn('[server] ADMIN_API_KEY не задан — admin-api вернёт 401')
if (!process.env.DATABASE_URL) console.warn('[server] DATABASE_URL не задан — листы не сохранятся')

/** Запрос в admin-api loveandpay. Ключ живёт только здесь, на сервере. */
async function lp<T = any>(path: string): Promise<T> {
  const res = await fetch(`${LP_API}/api/admin-api${path}`, {
    headers: { 'X-Admin-Api-Key': LP_KEY },
    signal: AbortSignal.timeout(30_000),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) {
    throw Object.assign(new Error(body?.error || `admin-api ${res.status}`), {
      status: res.status,
    })
  }
  return body as T
}

import type { Request, Response, NextFunction } from 'express'

/** Право vcc на весь роутер карт: GET — чтение, остальное — запись. */
function vccGate(req: Request, res: Response, next: NextFunction) {
  const need = req.method === 'GET' || req.method === 'HEAD' ? 'read' : 'write'
  return requireSection('vcc', need)(req, res, next)
}

/**
 * Путь мини-аппа → раздел прав.
 *
 * У разных функций мини-аппа разные разделы (заказы, юзеры, рассылки…),
 * поэтому нельзя закрыть роутер одним правом — выбираем раздел по первому
 * сегменту пути, а рассылку/техработы дополнительно требуем на запись.
 */
function miniappGate(req: Request, res: Response, next: NextFunction) {
  const seg = req.path.replace(/^\//, '').split('/')[0]
  const map: Record<string, string> = {
    orders: 'miniapp-orders',
    users: 'miniapp-users',
    referrals: 'miniapp-referrals',
    stats: 'miniapp-orders',
    overview: 'miniapp-orders',
    broadcast: 'miniapp-broadcast',
    maintenance: 'miniapp-maintenance',
  }
  const section = map[seg]
  if (!section) return res.status(403).json({ success: false, error: 'Неизвестный раздел' })
  const need = req.method === 'GET' || req.method === 'HEAD' ? 'read' : 'write'
  return requireSection(section, need)(req, res, next)
}

/**
 * Какому разделу админки принадлежит путь admin-api.
 *
 * Нужно, чтобы права проверялись и на прокси: без этого оператор с ролью
 * «Поддержка» мог бы дёрнуть /v1/refund-requests/{id}/approve напрямую,
 * минуя интерфейс, где кнопки для него нет.
 */
function sectionOfPath(url: string): string | null {
  const p = url.replace(/^\/v1\//, '').split(/[/?]/)[0]
  const map: Record<string, string> = {
    transactions: 'transactions',
    invoices: 'invoices',
    'refund-requests': 'refund-requests',
    partners: 'partners',
    'partner-moderation': 'partner-moderation',
    users: 'users',
    terminals: 'terminals',
    webhooks: 'webhooks',
    finance: 'finance',
    settlements: 'settlements',
    payouts: 'payouts',
    withdrawals: 'withdrawals',
    markups: 'markups',
    'pos-markups': 'pos-markups',
    'referral-overrides': 'referral-overrides',
    'kyc-billing': 'kyc-billing',
    'kyc-verifications': 'kyc-verifications',
    'aml-guard': 'aml-guard',
    'payer-audit': 'payer-audit',
    declarations: 'declarations',
    'api-logs': 'api-logs',
    'audit-logs': 'audit-logs',
    'info-bot': 'info-bot',
    esim: 'esim',
  }
  // /v1/partners/hierarchy — отдельный раздел, а не карточка партнёра.
  if (url.startsWith('/v1/partners/hierarchy')) return 'hierarchy'
  return map[p] ?? null
}

// ── Прокси admin-api для фронта ──────────────────────────────────────────────
// Браузер ходит сюда, ключ подставляется на этой стороне и наружу не уезжает.
app.use('/admin-api', requireAuth, async (req, res) => {
  try {
    // Нормализуем путь ДО любых проверок: и /v1/ping-вайтлист, и sectionOfPath,
    // и upstream должны видеть один и тот же путь. Иначе /v1/ping/%2e%2e/refund
    // проходит как «ping», а fetf() ниже схлопывает .. и бьёт в refund с
    // полным ключом — обход авторизации (парсер-дифференциал).
    let normalizedPath: string
    try {
      const u = new URL(req.url, 'http://x')
      normalizedPath = u.pathname + u.search
    } catch {
      return res.status(400).json({ success: false, error: 'Некорректный путь' })
    }
    // Любой остаток ../ или закодированной точки-сегмента после нормализации —
    // это попытка обхода, а не легитимный путь admin-api.
    if (/(^|\/)\.\.?(\/|$)/.test(normalizedPath) || /%2e/i.test(normalizedPath)) {
      return res.status(400).json({ success: false, error: 'Недопустимый путь' })
    }
    req.url = normalizedPath

    // /v1 (каталог) и /v1/ping доступны всем, кто вошёл: это проверка связи.
    const isMeta = /^\/v1\/?(\?|$)/.test(req.url) || /^\/v1\/ping\/?(\?|$)/.test(req.url)
    if (!isMeta) {
      const section = sectionOfPath(req.url)
      if (!section) {
        return res.status(403).json({ success: false, error: 'Неизвестный раздел', code: 'NO_ACCESS' })
      }
      const level = req.user!.permissions[section] ?? 'none'
      const needWrite = !['GET', 'HEAD'].includes(req.method)
      const ok = needWrite ? level === 'write' : level === 'read' || level === 'write'
      if (!ok) {
        return res.status(403).json({
          success: false,
          error: needWrite ? 'Нет прав на изменение в этом разделе' : 'Нет доступа к разделу',
          code: 'NO_ACCESS',
        })
      }
      // Пишем в свой аудит: у loveandpay все действия админки выглядят
      // как «admin-api (1C)», без имени оператора.
      if (needWrite) {
        await writeAudit(req, `PROXY_${req.method}`, section, undefined, { path: req.url })
      }
    }

    const upstream = `${LP_API}/api/admin-api${req.url}`
    const hasBody = !['GET', 'HEAD'].includes(req.method)
    const r = await fetch(upstream, {
      method: req.method,
      headers: { 'X-Admin-Api-Key': LP_KEY, 'Content-Type': 'application/json' },
      body: hasBody && req.body ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(60_000),
    })
    const text = await r.text()
    res.status(r.status).type('application/json').send(text)
  } catch (e: any) {
    res.status(502).json({ success: false, error: `Прокси: ${e.message}` })
  }
})

// ── Курс ─────────────────────────────────────────────────────────────────────
app.get('/api/rate', requireAuth, async (_req, res) => {
  try {
    res.json({ success: true, ...(await getRate()) })
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message })
  }
})

// ── Расчёт ───────────────────────────────────────────────────────────────────
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

type CalcInput = {
  partnerId: string
  dateFrom: string
  dateTo: string
  percent: number
  manualTurnoverRub?: number | null // в копейках; задан — из API не тянем
}

/**
 * Расчётный период — вторник + 6 дней, то есть по понедельник включительно.
 * Выплаты уходят в понедельник вечером, поэтому понедельник закрывает
 * период, а не открывает новый.
 */
function assertPeriod(dateFrom: string, dateTo: string) {
  const from = new Date(`${dateFrom}T00:00:00Z`)
  const to = new Date(`${dateTo}T00:00:00Z`)
  if (Number.isNaN(+from) || Number.isNaN(+to)) {
    throw Object.assign(new Error('Некорректные даты периода'), { status: 400 })
  }
  // getUTCDay(): 0=вс, 1=пн, 2=вт
  if (from.getUTCDay() !== 2) {
    throw Object.assign(new Error('Период должен начинаться со вторника'), { status: 400 })
  }
  const days = Math.round((+to - +from) / 86_400_000) + 1
  if (days !== 7) {
    throw Object.assign(new Error(`Период должен быть ровно 7 дней, получено ${days}`), {
      status: 400,
    })
  }
  if (to.getUTCDay() !== 1) {
    throw Object.assign(new Error('Период должен заканчиваться понедельником'), { status: 400 })
  }
}

/**
 * Считает лист. Живёт на сервере намеренно: суммы и курс не должны
 * приходить с клиента — иначе в базу можно записать что угодно.
 */
async function calculate(input: CalcInput) {
  const { partnerId, dateFrom, dateTo, percent } = input

  if (!partnerId) throw Object.assign(new Error('Не выбран партнёр'), { status: 400 })
  if (!dateFrom || !dateTo) throw Object.assign(new Error('Не задан период'), { status: 400 })
  if (dateFrom > dateTo) throw Object.assign(new Error('Начало периода позже конца'), { status: 400 })
  if (!(percent >= 0 && percent <= 100)) {
    throw Object.assign(new Error('Процент должен быть от 0 до 100'), { status: 400 })
  }
  assertPeriod(dateFrom, dateTo)

  const partner = await lp<{ partner: { id: string; name: string; partnerId: string } }>(
    `/v1/partners/${partnerId}`,
  )

  // ВАЖНО: ?partner= понимает только UUID. На строковый код API отвечает
  // 200 и нулями — тихо, без ошибки. Поэтому сюда идёт только id.
  const q = new URLSearchParams({
    partner: partnerId,
    status: 'PAID',
    dateFrom,
    dateTo,
    limit: '1',
  })
  const inv = await lp<{
    stats: { paid: number; totalRevenue: number; totalRevenueUsdt: number; usdtMissing: number }
  }>(`/v1/invoices?${q}`)

  const stats = inv.stats ?? { paid: 0, totalRevenue: 0, totalRevenueUsdt: 0, usdtMissing: 0 }
  const manual = input.manualTurnoverRub != null
  const turnoverRub = manual ? Math.round(input.manualTurnoverRub!) : stats.totalRevenue

  const rate = await getRate()

  // Процент — это ЗАРАБОТОК с оборота, а не удержание:
  // 0.25% от оборота даёт заработок, а не 99.75% от него.
  // Рубли держим в копейках целыми, в USDT переводим по зафиксированному курсу.
  const payoutRub = Math.round(turnoverRub * (percent / 100))
  const turnoverUsdt = round2(turnoverRub / 100 / rate.rate)
  const payoutUsdt = round2(payoutRub / 100 / rate.rate)

  return {
    partner: { id: partner.partner.id, name: partner.partner.name, code: partner.partner.partnerId },
    dateFrom,
    dateTo,
    percent,
    invoicesPaid: stats.paid ?? 0,
    usdtMissing: stats.usdtMissing ?? 0,
    manualTurnover: manual,
    turnoverRub,
    turnoverUsdt,
    payoutRub,
    payoutUsdt,
    rate: rate.rate,
    rateAt: rate.at,
    rateSource: rate.source,
    apiTurnoverRub: stats.totalRevenue ?? 0,
    apiTurnoverUsdt: stats.totalRevenueUsdt ?? 0,
  }
}

app.post('/api/sheets/preview', requireAuth, requireSection('payout-sheet'), async (req, res) => {
  try {
    res.json({ success: true, sheet: await calculate(req.body as CalcInput) })
  } catch (e: any) {
    res.status(e.status ?? 500).json({ success: false, error: e.message })
  }
})

app.post('/api/sheets', requireAuth, requireSection('payout-sheet', 'write'), async (req, res) => {
  try {
    const c = await calculate(req.body as CalcInput)
    const number = await nextNumber()
    const { rows } = await pool.query(
      `insert into payout_sheets
         (number, partner_id, partner_name, partner_code, date_from, date_to, percent,
          invoices_paid, turnover_rub, rate_usdt_rub, rate_source, rate_at, turnover_usdt,
          payout_rub, payout_usdt, usdt_missing, manual_turnover, comment)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       returning *`,
      [
        number,
        c.partner.id,
        c.partner.name,
        c.partner.code,
        c.dateFrom,
        c.dateTo,
        c.percent,
        c.invoicesPaid,
        c.turnoverRub,
        c.rate,
        c.rateSource,
        c.rateAt,
        c.turnoverUsdt,
        c.payoutRub,
        c.payoutUsdt,
        c.usdtMissing,
        c.manualTurnover,
        (req.body as any).comment ?? null,
      ],
    )
    res.status(201).json({ success: true, sheet: rows[0] })
  } catch (e: any) {
    // 23505 — упёрлись в уникальный индекс (партнёр + период).
    if (e.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Лист по этому партнёру за этот период уже есть — проверьте список.',
        code: 'DUPLICATE',
      })
    }
    res.status(e.status ?? 500).json({ success: false, error: e.message })
  }
})

app.get('/api/sheets', requireAuth, requireSection('payout-sheet'), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const { rows } = await pool.query(
      'select * from payout_sheets order by created_at desc limit $1',
      [limit],
    )
    const { rows: c } = await pool.query('select count(*)::int as n from payout_sheets')
    res.json({ success: true, sheets: rows, total: c[0].n })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

app.delete('/api/sheets/:id', requireAuth, requireSection('payout-sheet', 'write'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('delete from payout_sheets where id = $1', [req.params.id])
    if (!rowCount) return res.status(404).json({ success: false, error: 'Лист не найден' })
    res.json({ success: true, id: req.params.id })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  }
})

// Документ расчётного листа — HTML-страница в стиле печатной формы 1С.
// Открывается по прямой ссылке; «Печать/Сохранить PDF» в браузере даёт PDF
// с тем же видом, что и печать из интерфейса.
const rubDoc = (kopecks: number | string) =>
  new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(kopecks) / 100,
  ) + ' ₽'
const dtDoc = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
}

app.get('/api/sheets/:id/document', requireAuth, requireSection('payout-sheet'), async (req, res) => {
  try {
    const { rows } = await pool.query('select * from payout_sheets where id = $1', [req.params.id])
    if (!rows.length) return res.status(404).send('Лист не найден')

    const s = rows[0]
    const html = renderDocument({
      docType: 'Расчётный лист',
      number: String(s.number).replace(/^РЛ-/, ''),
      date: dtDoc(s.created_at),
      fields: [
        { label: 'Партнёр', value: s.partner_name + (s.partner_code ? ` (${s.partner_code})` : ''), wide: true },
        { label: 'Период', value: `${dtDoc(s.date_from)} — ${dtDoc(s.date_to)}`, wide: true },
        { label: 'Оборот за период', value: rubDoc(s.turnover_rub) },
        { label: 'Процент заработка', value: `${Number(s.percent)} %` },
        { label: 'Курс USDT/RUB (RAPIRA)', value: `${Number(s.rate_usdt_rub).toFixed(2)} ₽` },
        ...(s.comment ? [{ label: 'Комментарий', value: s.comment, wide: true }] : []),
      ],
      total: {
        label: 'К выплате:',
        value: rubDoc(s.payout_rub),
        sub: `${Number(s.payout_usdt).toFixed(2)} USDT`,
      },
      footNote: `Расчёт: оборот ${rubDoc(s.turnover_rub)} × ${Number(s.percent)}% ÷ курс ${Number(
        s.rate_usdt_rub,
      ).toFixed(2)} ₽. Документ ${s.number} сформирован в админ-панели Love&Pay.`,
    })
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  } catch (e: any) {
    res.status(500).send('Ошибка формирования документа')
  }
})

// Документ-требование предоставить декларацию (домены + IP). Формируется на
// партнёра, который не заполнил декларацию. Данные партнёра берём из admin-api.
app.get(
  '/api/declaration-notice/:partnerId',
  requireAuth,
  requireSection('declarations'),
  async (req, res) => {
    try {
      const data = await lp<{ partner: any }>(`/v1/partners/${req.params.partnerId}`)
      const p = data.partner
      const today = dtDoc(new Date().toISOString())
      // Срок — 5 рабочих дней; здесь считаем 7 календарных для простоты.
      const deadline = new Date(Date.now() + 7 * 86_400_000).toISOString()

      const html = renderDocument({
        docType: 'Требование',
        number: `ДЕКЛ-${String(p.partnerId ?? '').slice(-6).toUpperCase() || '000000'}`,
        date: today,
        fields: [
          { label: 'Кому', value: `${p.name}${p.partnerId ? ` (${p.partnerId})` : ''}`, wide: true },
          { label: 'Email', value: p.email ?? '—' },
          { label: 'Статус API', value: p.apiBlocked ? 'заблокирован' : 'активен' },
          { label: 'Предоставить до', value: dtDoc(deadline) },
        ],
        body:
          'В соответствии с требованиями информационной безопасности платёжной ' +
          'платформы Love&Pay, все партнёры, использующие API, обязаны задекларировать ' +
          'домены и IP-адреса, с которых осуществляется доступ к API.\n\n' +
          'По состоянию на дату настоящего требования в вашем профиле отсутствует ' +
          'заполненная декларация (не указаны подтверждённые домены и/или разрешённые ' +
          'IP-адреса).\n\n' +
          `Просим предоставить декларацию в срок до ${dtDoc(deadline)}. В противном ` +
          'случае доступ к API может быть ограничен до устранения нарушения.',
        footNote: `Документ сформирован автоматически в админ-панели Love&Pay ${today}. ID партнёра: ${p.id}`,
        signatures: ['Служба безопасности', 'Партнёр (ознакомлен)'],
      })
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.send(html)
    } catch (e: any) {
      res.status(e.status === 404 ? 404 : 500).send('Не удалось сформировать требование')
    }
  },
)

// Блокировка/разблокировка API партнёра за (не)заполненную декларацию.
// Под правом declarations, а не partners: вести декларации и карать за них —
// функция безопасности, для неё не нужен полный доступ к редактированию партнёров.
app.post(
  '/api/declaration-block/:partnerId',
  requireAuth,
  requireSection('declarations', 'write'),
  async (req, res) => {
    try {
      const blocked = req.body?.blocked === true
      const r = await fetch(`${LP_API}/api/admin-api/v1/partners/${req.params.partnerId}`, {
        method: 'PATCH',
        headers: { 'X-Admin-Api-Key': LP_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiBlocked: blocked }),
        signal: AbortSignal.timeout(30_000),
      })
      const body = await r.json().catch(() => null)
      if (!r.ok || body?.success === false) {
        return res.status(r.status).json({ success: false, error: body?.error ?? `Ошибка ${r.status}` })
      }
      await writeAudit(req, blocked ? 'API_BLOCKED' : 'API_UNBLOCKED', 'partner', req.params.partnerId, {
        reason: 'declaration',
      })
      res.json({ success: true, apiBlocked: blocked })
    } catch (e: any) {
      res.status(502).json({ success: false, error: e.message })
    }
  },
)

/**
 * Повторные плательщики — из транзакций, а не из payer-audit.
 *
 * payer-audit в этом окружении заморожен на 01.07 и свежих платежей не отдаёт,
 * поэтому отчёт брал пустоту. Транзакции живые и уже несут фактического
 * плательщика (paymentInfo.payer = {name, phone}) в каждой записи — по ним и
 * считаем. Берём только успешные (COMPLETED) — это и есть «кто оплатил».
 *
 * Отдаём в той же форме, что payer-audit (items с actualName/actualPhone/…),
 * чтобы фронт-группировка отчёта не менялась.
 */
app.get('/api/repeat-payers', requireAuth, requireSection('reports'), async (req, res) => {
  try {
    const partnerId = String(req.query.partnerId || '').trim()
    const from = String(req.query.from || '')
    const to = String(req.query.to || '')
    if (!from || !to) return res.status(400).json({ success: false, error: 'Не задан период' })

    const PAGE = 200
    // Потолок страниц: у одного партнёра запас большой, по всем — скромнее,
    // иначе один тяжёлый отчёт выгребет десятки тысяч транзакций.
    const maxPages = partnerId ? 60 : 40

    const items: Array<{
      actualName: string
      actualPhone: string | null
      amount: number
      invoiceNumber: string
      partnerName: string
    }> = []
    let totalTransactions = 0
    let fetched = 0
    let completedWithPayer = 0

    for (let page = 1; page <= maxPages; page++) {
      const q = new URLSearchParams({ dateFrom: from, dateTo: to, limit: String(PAGE), page: String(page) })
      if (partnerId) q.set('partner', partnerId)
      const r = await lp<{ transactions?: any[]; pagination?: { total?: number } }>(`/v1/transactions?${q}`)
      const tx = r.transactions ?? []
      totalTransactions = r.pagination?.total ?? totalTransactions
      fetched += tx.length

      for (const t of tx) {
        if (t.status !== 'COMPLETED') continue
        const raw = t.paymentInfo?.payer
        const name = raw && typeof raw === 'object' ? raw.name : typeof raw === 'string' ? raw : null
        if (!name) continue
        const phone = raw && typeof raw === 'object' ? (raw.phone ?? null) : null
        completedWithPayer++
        items.push({
          actualName: name,
          actualPhone: phone,
          amount: Number(t.amount) || 0,
          invoiceNumber: t.invoice?.invoiceNumber ?? t.merchantOrderId ?? '',
          partnerName: t.partner?.name ?? '',
        })
      }
      if (tx.length < PAGE) break
    }

    // Упёрлись в потолок страниц — значит охватили не все транзакции.
    const capped = fetched < totalTransactions
    res.json({
      success: true,
      items,
      total: completedWithPayer,
      capped,
      scannedTransactions: fetched,
      totalTransactions,
    })
  } catch (e: any) {
    res.status(e.status ?? 500).json({ success: false, error: e.message })
  }
})

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('select 1')
    res.json({ success: true, db: 'ok' })
  } catch (e: any) {
    // Эндпоинт анонимный: сообщение pg содержит хост/порт/пользователя БД,
    // наружу это не отдаём — деталь только в лог сервера.
    console.error('[health] БД недоступна:', e.message)
    res.status(503).json({ success: false, db: 'fail' })
  }
})

// ── Раздача собранного фронта (прод) ─────────────────────────────────────────
// В деве фронт отдаёт Vite на своём порту; в проде один процесс отдаёт и API,
// и статику — тогда всё на одном домене, и cookie-сессия работает без CORS.
if (process.env.SERVE_CLIENT === '1') {
  const { fileURLToPath } = await import('node:url')
  const path = await import('node:path')
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')

  app.use(express.static(dist))
  // SPA-fallback: любой НЕ-API GET отдаёт index.html, дальше рулит React Router.
  // Идёт последним, поэтому /api и /admin-api сюда уже не попадают.
  app.get(/^(?!\/(api|admin-api)\/).*/, (_req, res) => {
    res.sendFile(path.join(dist, 'index.html'))
  })
}

migrate()
  .then(migrateAuth)
  .then(migrateEmployees)
  .then(migrateSalary)
  .then(() => {
    // На Render/облаке слушаем весь интерфейс, не только localhost.
    app.listen(PORT, '0.0.0.0', () => console.log(`[server] :${PORT}`))
  })
  .catch((e) => {
    console.error('[server] миграция не прошла:', e.message)
    process.exit(1)
  })
