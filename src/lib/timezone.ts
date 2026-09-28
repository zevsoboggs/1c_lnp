import { useSyncExternalStore } from 'react'

/**
 * Часовой пояс, в котором оператор смотрит даты.
 *
 * В базе всё лежит в UTC, admin-api отдаёт ISO с `Z`. По умолчанию браузер
 * показывал бы время своего пояса — и одна и та же оплата выглядела бы
 * по-разному у оператора в Москве и в Екатеринбурге, а с выпиской банка не
 * сходилась вовсе. Поэтому пояс выбирается явно и одинаков для всех дат в
 * панели.
 *
 * Смещения от UTC+0 до UTC+6: этого хватает от лондонского времени до
 * екатеринбургского, а именно в этих поясах живут наши сверки.
 */
export const TIMEZONES = [0, 1, 2, 3, 4, 5, 6] as const

export type TimezoneOffset = (typeof TIMEZONES)[number]

const KEY = 'lnp.admin.tzOffset'

/** Москва: в ней выписки, договоры и большинство операторов. */
const FALLBACK: TimezoneOffset = 3

function isOffset(value: number): value is TimezoneOffset {
  return (TIMEZONES as readonly number[]).includes(value)
}

function restore(): TimezoneOffset {
  try {
    const saved = Number(localStorage.getItem(KEY))
    if (Number.isFinite(saved) && isOffset(saved)) {
      return saved
    }
  } catch {
    // Приватный режим — остаёмся на значении по умолчанию.
  }

  return FALLBACK
}

let current: TimezoneOffset = restore()

const listeners = new Set<() => void>()

export function timezoneOffset(): TimezoneOffset {
  return current
}

export function setTimezoneOffset(offset: TimezoneOffset): void {
  if (offset === current) return

  current = offset
  try {
    localStorage.setItem(KEY, String(offset))
  } catch {
    // Не сохранилось — пояс продержится до перезагрузки, и это лучше отказа.
  }
  for (const notify of listeners) notify()
}

/** Подпись для интерфейса: UTC+3, а рядом город, по которому его узнают. */
export function timezoneLabel(offset: TimezoneOffset): string {
  const cities: Record<TimezoneOffset, string> = {
    0: 'Лондон',
    1: 'Берлин',
    2: 'Калининград',
    3: 'Москва',
    4: 'Самара',
    5: 'Екатеринбург',
    6: 'Омск',
  }

  return `UTC+${offset} · ${cities[offset]}`
}

/**
 * Перерисовка при смене пояса. Возвращает смещение, поэтому компонент,
 * который его читает, обновится сам.
 */
export function useTimezoneOffset(): TimezoneOffset {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify)
      return () => listeners.delete(notify)
    },
    timezoneOffset,
    () => FALLBACK,
  )
}
