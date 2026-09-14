import { useEffect, useState } from 'react'
import { Layout as AntLayout, Menu, Drawer, Button, Grid } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { useMenu } from '@refinedev/core'
import type { TreeMenuItem } from '@refinedev/core'
import { Link, useLocation } from 'react-router'
import type { ReactNode } from 'react'
import { Brand } from './Brand'
import { UserMenu } from './UserMenu'
import { TabsBar } from './TabsBar'
import { getMe } from '../api/authProvider'
import { C1 } from '../theme'

const SIDER_WIDTH = 240

/** Ресурс без своего маршрута — это группа: у неё нет ссылки, только дети. */
function toMenuItem(item: TreeMenuItem): any {
  const children = item.children ?? []
  if (children.length > 0) {
    return {
      key: item.key,
      icon: item.icon,
      label: item.label,
      children: children.map(toMenuItem),
    }
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
 * Свой layout вместо ThemedLayout.
 *
 * На десктопе — неподвижная панель разделов, как в 1С. На телефоне она бы
 * съела весь экран, поэтому там меню уезжает в выдвижную шторку, а сверху
 * остаётся компактная шапка с гамбургером — привычное поведение приложения.
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
      <AntLayout style={{ minHeight: '100vh', background: C1.appBg }}>
        <div className="onec-mobile-bar">
          <Button
            type="text"
            aria-label="Меню"
            icon={<MenuOutlined style={{ fontSize: 18 }} />}
            onClick={() => setDrawerOpen(true)}
          />
          <Brand compact />
        </div>

        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={276}
          closable={false}
          styles={{ body: { padding: 0, background: C1.sidebarBg, display: 'flex', flexDirection: 'column' } }}
        >
          <Brand />
          <div className="onec-sider" style={{ flex: 1, overflowY: 'auto' }}>
            {menu}
          </div>
          <div style={{ borderTop: `1px solid ${C1.sidebarBorder}` }}>
            <UserMenu />
          </div>
        </Drawer>

        <AntLayout.Content style={{ padding: 8 }}>
          <div className="onec-content onec-content--mobile">{children}</div>
        </AntLayout.Content>
      </AntLayout>
    )
  }

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <AntLayout.Sider
        width={SIDER_WIDTH}
        theme="light"
        className="onec-sider"
        style={{
          background: C1.sidebarBg,
          borderInlineEnd: `1px solid ${C1.sidebarBorder}`,
          position: 'fixed',
          insetInlineStart: 0,
          top: 0,
          bottom: 0,
          height: '100vh',
          overflowY: 'auto',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Brand />
        <div style={{ flex: 1 }}>{menu}</div>
        <div style={{ borderTop: `1px solid ${C1.sidebarBorder}` }}>
          <UserMenu />
        </div>
      </AntLayout.Sider>

      <AntLayout style={{ marginInlineStart: SIDER_WIDTH, background: C1.appBg }}>
        {/* Строка вкладок открытых разделов — прибита к верху, как в 1С. */}
        <div style={{ position: 'sticky', top: 0, zIndex: 5 }}>
          <TabsBar />
        </div>
        {/* Контент — белая карточка на светло-сером фоне, как область документа
            в новом UI 1С 8.5 (стили в .onec-content). */}
        <AntLayout.Content style={{ padding: '0 16px 16px' }}>
          <div className="onec-content">{children}</div>
        </AntLayout.Content>
      </AntLayout>
    </AntLayout>
  )
}
