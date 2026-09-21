import { useEffect, useState } from 'react'
import { Menu, Drawer, Button, Grid } from 'antd'
import {
  MenuOutlined, HomeOutlined, SwapOutlined, FileTextOutlined, ApartmentOutlined,
} from '@ant-design/icons'
import { useMenu } from '@refinedev/core'
import type { TreeMenuItem } from '@refinedev/core'
import { Link, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { Brand } from './Brand'
import { UserMenu } from './UserMenu'
import { TabsBar } from './TabsBar'
import { BottomNav, type NavItem } from './BottomNav'
import { getMe } from '../api/authProvider'
import { C1 } from '../theme'

const SIDER_WIDTH = 240

/**
 * Разделы нижнего меню телефона — то, чем пользуются каждый день.
 * Остальное открывается кнопкой «Ещё».
 */
const MOBILE_NAV: NavItem[] = [
  { key: 'home', path: '/', label: 'Главная', icon: <HomeOutlined /> },
  { key: 'transactions', path: '/transactions', label: 'Платежи', icon: <SwapOutlined /> },
  { key: 'invoices', path: '/invoices', label: 'Инвойсы', icon: <FileTextOutlined /> },
  { key: 'partners', path: '/partners', label: 'Партнёры', icon: <ApartmentOutlined /> },
]

/** Ресурс без своего маршрута — это группа: у неё нет ссылки, только дети. */
function toMenuItem(item: TreeMenuItem): any {
  const children = item.children ?? []
  if (children.length > 0) {
    return { key: item.key, icon: item.icon, label: item.label, children: children.map(toMenuItem) }
  }
  return {
    key: item.key,
    icon: item.icon,
    label: <Link to={item.route ?? '/'}>{item.label}</Link>,
  }
}

/**
 * Оставляет только доступные роли разделы.
 *
 * useMenu правами не занимается — он отдаёт всё дерево ресурсов, а прятать
 * недоступное должен layout. Группа исчезает, когда внутри не осталось
 * ни одного пункта, иначе в меню висели бы пустые «Финансы» и «KYC».
 */
function visibleMenu(items: TreeMenuItem[]): TreeMenuItem[] {
  const perms = getMe()?.permissions ?? {}
  // «Главная» — общий дашборд без отдельного права, показываем всегда.
  const allowed = (name?: string) => !!name && (name === 'home' || (perms[name] ?? 'none') !== 'none')

  return items
    .map((item) => ({ ...item, children: visibleMenu(item.children ?? []) }))
    .filter((item) => (item.children.length > 0 ? true : allowed(item.name)))
    // Группа без доступных детей — это группа, у которой своего раздела нет.
    .filter((item) => item.route || item.children.length > 0)
}

/**
 * Оболочка приложения.
 *
 * Вся «мебель» — панель разделов, шапка, подвал, нижнее меню — сделана
 * плавающими карточками с отступом от краёв и скруглением. Смысл не только в
 * виде: отступ отделяет служебные элементы от содержимого, и взгляд перестаёт
 * путать край окна с краем таблицы.
 *
 * На телефоне панель разделов заняла бы весь экран, поэтому там она уезжает в
 * шторку, снизу появляется постоянное меню с главными разделами, а содержимое
 * получает запас снизу, чтобы меню ничего не перекрывало.
 */
export function Layout({ children }: { children: ReactNode }) {
  const { menuItems, selectedKey, defaultOpenKeys } = useMenu()
  const screens = Grid.useBreakpoint()
  // lg — граница, ниже которой панель в 240 px уже не оставляет места таблицам.
  // На первом рендере useBreakpoint может отдать пустой объект — тогда смотрим
  // ширину окна сами, иначе экран моргает чужим макетом.
  const isMobile =
    screens.lg === undefined ? typeof window !== 'undefined' && window.innerWidth < 992 : !screens.lg
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  // Перешли в раздел — шторку закрываем, иначе она перекрывает то, что открыли.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[selectedKey]}
      defaultOpenKeys={defaultOpenKeys}
      style={{ background: 'transparent', borderInlineEnd: 'none', paddingTop: 4 }}
      items={visibleMenu(menuItems).map(toMenuItem)}
    />
  )

  if (isMobile) {
    return (
      <div className="onec-shell onec-shell--mobile">
        <header className="onec-topbar">
          <Button
            type="text"
            aria-label="Меню"
            icon={<MenuOutlined style={{ fontSize: 18 }} />}
            onClick={() => setDrawerOpen(true)}
          />
          <Brand compact />
          <div className="onec-topbar__spacer" />
          <UserMenu compact />
        </header>

        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={288}
          closable={false}
          className="onec-drawer"
          styles={{
            body: { padding: 0, background: C1.sidebarBg, display: 'flex', flexDirection: 'column' },
          }}
        >
          <Brand />
          <div className="onec-sider" style={{ flex: 1, overflowY: 'auto' }}>
            {menu}
          </div>
          <div style={{ borderTop: `1px solid ${C1.sidebarBorder}` }}>
            <UserMenu />
          </div>
        </Drawer>

        <main className="onec-main">
          <div className="onec-content onec-content--mobile">{children}</div>
        </main>

        <BottomNav items={MOBILE_NAV} onMore={() => setDrawerOpen(true)} moreActive={drawerOpen} />
      </div>
    )
  }

  return (
    <div className="onec-shell">
      <aside className="onec-aside" style={{ width: SIDER_WIDTH }}>
        <Brand />
        <div className="onec-sider onec-aside__menu">{menu}</div>
        <div className="onec-aside__foot">
          <UserMenu />
        </div>
      </aside>

      <div className="onec-column">
        {/* Шапка: вкладки открытых разделов — примета 1С. Плавает отдельной
            карточкой, чтобы не сливаться с таблицей под ней. */}
        <header className="onec-header">
          <TabsBar />
        </header>

        <main className="onec-main">
          <div className="onec-content">{children}</div>
        </main>

        <footer className="onec-footer">
          <span>Love&Pay — Админка</span>
          <span className="onec-footer__dot">·</span>
          <span>© {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  )
}
