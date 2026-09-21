import { Link, useLocation } from 'react-router'
import { AppstoreOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'
import { getMe } from '../api/authProvider'

export type NavItem = { key: string; path: string; label: string; icon: ReactNode }

/**
 * Нижнее меню телефона.
 *
 * На узком экране боковая панель уезжает в шторку, и без постоянной навигации
 * переход между разделами стоил бы двух касаний: открыть шторку, выбрать. Меню
 * держит под большим пальцем то, чем пользуются чаще всего, а остальное
 * остаётся за кнопкой «Ещё».
 *
 * Пунктов не больше пяти: шестой на экране 360 px превращает подписи в
 * нечитаемые огрызки.
 */
export function BottomNav({
  items,
  onMore,
  moreActive,
}: {
  items: NavItem[]
  onMore: () => void
  moreActive?: boolean
}) {
  const location = useLocation()
  const perms = getMe()?.permissions ?? {}

  // Раздел, закрытый роли, в меню не показываем: кнопка, ведущая в отказ,
  // хуже отсутствующей.
  const allowed = items.filter((i) => i.key === 'home' || (perms[i.key] ?? 'none') !== 'none')

  return (
    <nav className="onec-bottomnav" aria-label="Разделы">
      <div className="onec-bottomnav__inner">
        {allowed.slice(0, 4).map((item) => {
          const active = location.pathname === item.path
          return (
            <Link
              key={item.key}
              to={item.path}
              className={`onec-bottomnav__item${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="onec-bottomnav__icon">{item.icon}</span>
              <span className="onec-bottomnav__label">{item.label}</span>
            </Link>
          )
        })}

        <button
          type="button"
          className={`onec-bottomnav__item${moreActive ? ' is-active' : ''}`}
          onClick={onMore}
          aria-label="Все разделы"
        >
          <span className="onec-bottomnav__icon"><AppstoreOutlined /></span>
          <span className="onec-bottomnav__label">Ещё</span>
        </button>
      </div>
    </nav>
  )
}
