import { Router } from 'express'
import crypto from 'node:crypto'
import { ps, maskCard, normalizeCard, type PsError } from './payspace.js'

export const vcc = Router()

const fail = (res: any, e: PsError) =>
  res.status(e.status && e.status >= 400 ? e.status : 502).json({
    success: false,
    error: e.message,
    code: e.code,
  })

/** Идемпотентный ключ: без него повтор запроса создаст вторую операцию. */
const requestId = () => crypto.randomUUID()

// ── Балансы ──────────────────────────────────────────────────────────────────
vcc.get('/user/balance', async (_req, res) => {
  try {
    res.json({ success: true, ...(await ps('GET', '/api/v1/vcc/user/balance/')) })
  } catch (e: any) {
    fail(res, e)
  }
})

vcc.get('/account/balances', async (_req, res) => {
  try {
    res.json({ success: true, ...(await ps('GET', '/api/v1/balance/')) })
  } catch (e: any) {
    fail(res, e)
  }
})

// ── Карты ────────────────────────────────────────────────────────────────────
vcc.get('/cards', async (req, res) => {
  try {
    const data = await ps<{ cards: any[]; total?: number }>('GET', '/api/v1/vcc/cards/', {
      query: {
        card_id: req.query.card_id,
        status: req.query.status,
        limit: req.query.limit ?? 100, // максимум у провайдера — 100
        offset: req.query.offset,
      },
    })
    // PAN и CVV наружу не отдаём — только в reveal.
    res.json({ success: true, ...data, cards: (data.cards ?? []).map(maskCard) })
  } catch (e: any) {
    fail(res, e)
  }
})

vcc.get('/card/info', async (req, res) => {
  try {
    const data = await ps<any>('GET', '/api/v1/vcc/card/info/', {
      query: { card_id: req.query.card_id },
    })
    const card = normalizeCard(data?.card ?? data)
    res.json({ success: true, card: maskCard(card) })
  } catch (e: any) {
    fail(res, e)
  }
})

/** Полные реквизиты одной карты. Отдельный маршрут — чтобы это было явным действием. */
vcc.get('/card/reveal', async (req, res) => {
  try {
    const data = await ps<any>('GET', '/api/v1/vcc/card/info/', {
      query: { card_id: req.query.card_id },
    })
    const card = normalizeCard(data?.card ?? data)
    console.warn(`[vcc] показаны полные реквизиты карты ${req.query.card_id}`)
    res.json({
      success: true,
      card: { card_no: card.card_no, cvv: card.cvv, exp_date: card.exp_date },
    })
  } catch (e: any) {
    fail(res, e)
  }
})

vcc.get('/transactions', async (req, res) => {
  try {
    const data = await ps('GET', '/api/v1/vcc/transactions/', {
      query: {
        card_id: req.query.card_id,
        type: req.query.type,
        date_from: req.query.date_from,
        date_to: req.query.date_to,
        limit: req.query.limit ?? 100,
        offset: req.query.offset,
      },
    })
    res.json({ success: true, ...(data as object) })
  } catch (e: any) {
    fail(res, e)
  }
})

// ── Операции с картой ────────────────────────────────────────────────────────
vcc.post('/card/create', async (req, res) => {
  try {
    const { amount, product_code, expdate, network, callback_url } = req.body ?? {}
    if (!amount) return res.status(400).json({ success: false, error: 'Не указана сумма' })
    const data = await ps('POST', '/api/v1/vcc/card/create/', {
      body: {
        amount: String(amount),
        product_code: product_code || 'SG_SUB',
        ...(expdate ? { expdate } : {}),
        network: network || 'trc20',
        ...(callback_url ? { callback_url } : {}),
      },
    })
    res.status(201).json({ success: true, ...(data as object) })
  } catch (e: any) {
    fail(res, e)
  }
})

vcc.post('/card/topup', async (req, res) => {
  try {
    const { card_id, amt } = req.body ?? {}
    if (!card_id || !amt) {
      return res.status(400).json({ success: false, error: 'Нужны card_id и сумма' })
    }
    const rid = req.body.request_id || requestId()
    const data = await ps('POST', '/api/v1/vcc/card/topup/', {
      body: { card_id, amt: String(amt), request_id: rid },
    })
    res.json({ success: true, request_id: rid, ...(data as object) })
  } catch (e: any) {
    fail(res, e)
  }
})

vcc.post('/card/withdraw', async (req, res) => {
  try {
    const { card_id, amt } = req.body ?? {}
    if (!card_id || !amt) {
      return res.status(400).json({ success: false, error: 'Нужны card_id и сумма' })
    }
    const rid = req.body.request_id || requestId()
    const data = await ps('POST', '/api/v1/vcc/card/withdraw/', {
      body: { card_id, amt: String(amt), request_id: rid },
    })
    res.json({ success: true, request_id: rid, ...(data as object) })
  } catch (e: any) {
    fail(res, e)
  }
})

vcc.post('/card/release', async (req, res) => {
  try {
    const { card_id } = req.body ?? {}
    if (!card_id) return res.status(400).json({ success: false, error: 'Не указан card_id' })
    const rid = req.body.request_id || requestId()
    const data = await ps('POST', '/api/v1/vcc/card/release/', {
      body: { card_id, request_id: rid },
    })
    res.json({ success: true, request_id: rid, ...(data as object) })
  } catch (e: any) {
    fail(res, e)
  }
})

vcc.post('/card/update_email', async (req, res) => {
  try {
    const { card_id, email } = req.body ?? {}
    if (!card_id || !email) {
      return res.status(400).json({ success: false, error: 'Нужны card_id и email' })
    }
    res.json({
      success: true,
      ...(await ps('POST', '/api/v1/vcc/card/update_email/', { body: { card_id, email } })),
    })
  } catch (e: any) {
    fail(res, e)
  }
})

vcc.post('/card/update_phone', async (req, res) => {
  try {
    const { card_id, phone_number, zone_number } = req.body ?? {}
    if (!card_id || !phone_number || !zone_number) {
      return res
        .status(400)
        .json({ success: false, error: 'Нужны card_id, phone_number и zone_number' })
    }
    res.json({
      success: true,
      ...(await ps('POST', '/api/v1/vcc/card/update_phone/', {
        body: { card_id, phone_number, zone_number },
      })),
    })
  } catch (e: any) {
    fail(res, e)
  }
})

// ── Проверка статусов операций ───────────────────────────────────────────────
vcc.get('/card/topup/check', async (req, res) => {
  try {
    res.json({
      success: true,
      ...(await ps('GET', '/api/v1/vcc/card/topup/check/', {
        query: { card_id: req.query.card_id, request_id: req.query.request_id },
      })),
    })
  } catch (e: any) {
    fail(res, e)
  }
})

vcc.get('/card/withdraw/check', async (req, res) => {
  try {
    res.json({
      success: true,
      ...(await ps('GET', '/api/v1/vcc/card/withdraw/check/', {
        query: { card_id: req.query.card_id, request_id: req.query.request_id },
      })),
    })
  } catch (e: any) {
    fail(res, e)
  }
})

// ── Баланс VCC-аккаунта ──────────────────────────────────────────────────────
vcc.post('/balance/topup', async (req, res) => {
  try {
    const { amount, network } = req.body ?? {}
    if (!amount) return res.status(400).json({ success: false, error: 'Не указана сумма' })
    res.json({
      success: true,
      ...(await ps('POST', '/api/v1/vcc/balance/topup/', {
        body: { amount: String(amount), network: network || 'trc20' },
      })),
    })
  } catch (e: any) {
    fail(res, e)
  }
})

vcc.post('/balance/topup/status', async (req, res) => {
  try {
    res.json({
      success: true,
      ...(await ps('POST', '/api/v1/vcc/balance/topup/status/', { body: req.body ?? {} })),
    })
  } catch (e: any) {
    fail(res, e)
  }
})
