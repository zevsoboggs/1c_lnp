import { Layout as AntLayout, Menu } from 'antd'
import { useMenu } from '@refinedev/core'
import type { TreeMenuItem } from '@refinedev/core'
import { Link } from 'react-router'
import type { ReactNode } from 'react'
import { Brand } from './Brand'
import { HealthBadge } from './HealthBadge'
import { UserMenu } from './UserMenu'
import { getMe } from '../api/authProvider'
import { C1 } from '../theme'

const SIDER_WIDTH = 210

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
  const allowed = (name?: string) => !!name && (perms[name] ?? 'none') !== 'none'

  return items
    .map((item) => ({ ...item, children: visibleMenu(item.children ?? []) }))
    .filter((item) => (item.children.length > 0 ? true : allowed(item.name)))
    // Группа без доступных детей — это группа, у которой своего раздела нет.
    .filter((item) => item.route || item.children.length > 0)
}

/**
 * Свой layout вместо ThemedLayout: нужен неподвижный сайдбар без
 * кнопки-схлопывателя, как в 1С, где панель разделов всегда на месте.
 */
export function Layout({ children }: { children: ReactNode }) {
  const { menuItems, selectedKey, defaultOpenKeys } = useMenu()

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <AntLayout.Sider
        width={SIDER_WIDTH}
        theme="light"
        style={{
          background: C1.sidebarBg,
          position: 'fixed',
          insetInlineStart: 0,
          top: 0,
          bottom: 0,
          height: '100vh',
          overflow: 'auto',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Brand />
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={defaultOpenKeys}
          style={{ background: C1.sidebarBg, borderInlineEnd: 'none', flex: 1 }}
          items={visibleMenu(menuItems).map(toMenuItem)}
        />
        <div>
          <div style={{ borderTop: '1px solid #efe5b8' }}>
            <HealthBadge />
          </div>
          <UserMenu />
        </div>
      </AntLayout.Sider>

      <AntLayout style={{ marginInlineStart: SIDER_WIDTH, background: '#fff' }}>
        <AntLayout.Content style={{ padding: 12 }}>{children}</AntLayout.Content>
      </AntLayout>
    </AntLayout>
  )
}
