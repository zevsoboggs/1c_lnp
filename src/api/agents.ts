/**
 * Агенты платформы и их заявки на подключение бизнеса.
 *
 * Отдельно от dataProvider: у Refine контракт про CRUD ресурсов, а здесь
 * рассмотрение — действие, которое не ложится ни в create, ни в update.
 * Одобрение не меняет признак, а открывает бизнес: заводит партнёра с
 * привязкой к агенту и ставкой и выдаёт ключ API.
 */
import { action, type ApiError } from './actions'

export interface AgentTotals {
  gross: number
  refunded: number
  net: number
  paidCount: number
  commissionEarned: number
}

export interface Agent {
  id: string
  email: string
  name: string | null
  isActive: boolean
  testPassedAt: string | null
  partners: number
  applications: number
  partnersCount: number
  partnersActive: number
  totals: AgentTotals
}

export type ApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface AgentApplication {
  id: string
  companyName: string
  contactName: string
  email: string
  phone: string
  website: string | null
  description: string | null
  businessType: string | null
  expectedMonthlyVolume: string | null
  proposedAgentCommission: number | null
  notes: string | null
  status: ApplicationStatus
  reviewNotes: string | null
  rejectionReason: string | null
  createdAt: string
  reviewedAt: string | null
  agent: { id: string; name: string | null; email: string | null } | null
  reviewedBy: { name: string | null; email: string } | null
  createdPartner: { id: string; name: string | null; partnerId: string | null } | null
}

export interface ApprovalResult {
  partner: { id: string; partnerId: string; name: string; agentCommissionPercent: number }
  /** Показывается один раз — дальше живёт в карточке партнёра. */
  apiKey: string
  user: { email: string } | null
  application: AgentApplication | null
}

export const agentsApi = {
  list: () => action<{ agents: Agent[]; total: number }>('/agents', { method: 'GET' }),

  applications: (status?: string, agentId?: string) =>
    action<{ applications: AgentApplication[]; total: number }>(
      `/agent-applications${buildQuery({ status, agentId })}`,
      { method: 'GET' },
    ),

  approve: (id: string, body: Record<string, unknown>) =>
    action<ApprovalResult>(`/agent-applications/${id}/approve`, { body }),

  reject: (id: string, reason: string, reviewerEmail?: string) =>
    action<{ application: AgentApplication }>(`/agent-applications/${id}/reject`, {
      body: { reason, reviewerEmail },
    }),
}

function buildQuery(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v && v !== 'all') q.append(k, v)
  const s = q.toString()
  return s ? `?${s}` : ''
}

export type { ApiError }
