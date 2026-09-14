import { Router } from 'express'
import { requireAuth, requireSection, writeAudit } from './auth.js'

/**
 * Ручная модерация KYC из 1С.
 *
 * Просмотр профиля идёт через admin-api (/kyc-verifications/{id} отдаёт поля,
 * media и сырой fullData провайдера). А вот решения admin-api не умеет — их
 * принимает сам Didit:
 *   PATCH {DIDIT_BASE_URL}/v1/session/{sessionId}/update-status/
 *   X-API-Key: <ключ>,  body: { new_status: 'Approved'|'Declined', comment }
 *
 * sessionId здесь — это verificationId проверки (идентификатор сессии Didit).
 * После решения Didit шлёт вебхук в loveandpay, и статус проверки там
 * обновляется сам — поэтому локально мы ничего не пишем, только аудируем.
 */
const DIDIT_BASE_URL = (process.env.DIDIT_BASE_URL || 'https://verification.didit.me').replace(
  /\/$/,
  '',
)
const DIDIT_API_KEY = (process.env.DIDIT_API_KEY || '').trim()

/** Статусы, из которых Didit разрешает ручное решение. */
export const DECIDABLE_KYC_STATUSES = ['PENDING', 'IN_PROGRESS', 'MANUAL_REVIEW', 'NOT_STARTED']

export const kyc = Router()
kyc.use(requireAuth)

kyc.get('/config', requireSection('kyc-verifications'), (_req, res) => {
  // Фронт заранее знает, включена ли модерация, чтобы не показывать мёртвые кнопки.
  res.json({ success: true, enabled: Boolean(DIDIT_API_KEY), statuses: DECIDABLE_KYC_STATUSES })
})

kyc.post('/:sessionId/decision', requireSection('kyc-verifications', 'write'), async (req, res) => {
  try {
    if (!DIDIT_API_KEY) {
      return res
        .status(503)
        .json({ success: false, error: 'DIDIT_API_KEY не задан на сервере', code: 'NOT_CONFIGURED' })
    }

    const decision = String(req.body?.decision ?? '')
    if (!['Approved', 'Declined'].includes(decision)) {
      return res
        .status(400)
        .json({ success: false, error: 'decision должен быть Approved или Declined' })
    }

    const who = req.user!.full_name || req.user!.username
    const comment = String(req.body?.comment ?? '').trim() || `Ручная проверка из 1С: ${who}`

    const r = await fetch(`${DIDIT_BASE_URL}/v1/session/${req.params.sessionId}/update-status/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': DIDIT_API_KEY },
      body: JSON.stringify({ new_status: decision, comment }),
      signal: AbortSignal.timeout(30_000),
    })
    const body = await r.json().catch(() => null)

    if (!r.ok) {
      return res.status(r.status).json({
        success: false,
        error: body?.detail || body?.message || `Didit ответил ${r.status}`,
      })
    }

    await writeAudit(
      req,
      decision === 'Approved' ? 'KYC_APPROVED' : 'KYC_DECLINED',
      'kyc_verification',
      req.params.sessionId,
      { comment },
    )
    res.json({ success: true, decision })
  } catch (e: any) {
    res.status(502).json({ success: false, error: e.message })
  }
})
