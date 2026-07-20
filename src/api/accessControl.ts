import type { AccessControlProvider } from '@refinedev/core'
import { getMe } from './authProvider'

/**
 * Права на разделы. Refine спрашивает это перед отрисовкой пункта меню
 * и перед действиями, поэтому недоступные разделы просто не показываются.
 *
 * Это удобство, а не защита: настоящая проверка живёт на сервере — сюда
 * приходит копия прав, и подменить её в браузере ничего не даст.
 */
export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action }) => {
    const me = getMe()
    if (!me) return { can: false }

    // Группы меню («Финансы», «KYC») — не ресурсы, у них своих прав нет:
    // Refine скроет группу сам, если внутри не осталось доступных пунктов.
    if (!resource) return { can: true }

    // Главная — общий дашборд, доступен всем вошедшим, отдельного права нет.
    if (resource === 'home') return { can: true }

    const level = me.permissions[resource] ?? 'none'
    if (level === 'none') return { can: false, reason: 'Раздел закрыт вашей ролью' }

    const writes = ['create', 'edit', 'delete', 'clone']
    if (writes.includes(action) && level !== 'write') {
      return { can: false, reason: 'Только просмотр' }
    }
    return { can: true }
  },
  options: {
    buttons: { enableAccessControl: true, hideIfUnauthorized: true },
  },
}

/** Может ли текущий пользователь менять что-то в разделе. */
export const canWrite = (section: string) => (getMe()?.permissions?.[section] ?? 'none') === 'write'
