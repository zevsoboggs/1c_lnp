import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useMenu } from '@refinedev/core'
import type { TreeMenuItem } from '@refinedev/core'
import { HomeOutlined, CloseOutlined } from '@ant-design/icons'
import { C1 } from '../theme'

const HOME = '/transactions'

type Tab = { key: string; label: string; path: string }

/** Ищет подпись раздела по его ключу в дереве меню. */
function findLabel(items: TreeMenuItem[], key: string): string | null {
  for (const it of items) {
    if (it.key === key && typeof it.label === 'string') return it.label
    const inChild = findLabel(it.children ?? [], key)
    if (inChild) return inChild
  }
  return null
}

/**
 * Строка вкладок открытых разделов — ключевая примета интерфейса 1С 8.5.
 * «Начало» всегда первая и не закрывается; каждый открытый раздел добавляется
 * вкладкой с крестиком. Активная вкладка помечена цветной полоской слева.
 */
export function TabsBar() {
  const { menuItems, selectedKey } = useMenu()
  const location = useLocation()
  const navigate = useNavigate()
  const [tabs, setTabs] = useState<Tab[]>([])

  // При каждой навигации добавляем текущий раздел вкладкой (если это не «Начало»
  // и его ещё нет). Так набор вкладок отражает то, что оператор открывал.
  useEffect(() => {
    const path = location.pathname
    if (path === HOME || path === '/') return
    const label = findLabel(menuItems, selectedKey) ?? path.replace('/', '')
    setTabs((prev) => {
      if (prev.some((t) => t.path === path)) return prev
      return [...prev, { key: selectedKey, label, path }]
    })
  }, [location.pathname, selectedKey, menuItems])

  const activePath = location.pathname === '/' ? HOME : location.pathname

  const close = (path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path)
      const next = prev.filter((t) => t.path !== path)
      // Закрыли активную — переходим на соседнюю или на «Начало».
      if (path === activePath) {
        const fallback = next[idx] ?? next[idx - 1]
        navigate(fallback ? fallback.path : HOME)
      }
      return next
    })
  }

  const tab = (t: Tab, closable: boolean) => {
    const active = t.path === activePath
    return (
      <div
        key={t.path}
        onClick={() => navigate(t.path)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 12px',
          height: 32,
          fontSize: 13,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          borderRadius: 8,
          background: active ? C1.cardBg : 'transparent',
          border: `1px solid ${active ? C1.border : 'transparent'}`,
          // Цветная полоска слева у активной — как в 1С.
          boxShadow: active ? `inset 3px 0 0 ${C1.primary}` : 'none',
          color: active ? C1.text : C1.textSecondary,
          fontWeight: active ? 600 : 400,
        }}
      >
        {t.key === '__home' && <HomeOutlined style={{ fontSize: 12 }} />}
        <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
        {closable && (
          <CloseOutlined
            onClick={(e) => close(t.path, e)}
            style={{ fontSize: 10, color: C1.textSecondary, marginLeft: 2 }}
          />
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '6px 16px',
        overflowX: 'auto',
        background: C1.appBg,
      }}
    >
      {tab({ key: '__home', label: 'Начало', path: HOME }, false)}
      {tabs.map((t) => tab(t, true))}
    </div>
  )
}
