import { useState, type MouseEvent, type ReactNode } from 'react'
import { Dropdown, App, type MenuProps } from 'antd'
import { CopyOutlined, CodeOutlined } from '@ant-design/icons'

type Item = NonNullable<MenuProps['items']>[number]

// Пункты собираются выражениями вида `record.field && {...}`, поэтому сюда
// прилетает любое falsy-значение поля, а не только false.
type Falsy = false | null | undefined | '' | 0

/**
 * Контекстное меню строки по правому клику — как в табличной части 1С.
 *
 * Каждая таблица добавляет свои пункты, но копирование id и строки целиком
 * есть везде: это то, что чаще всего нужно, чтобы утащить запись в тикет
 * или в запрос к API.
 *
 * Использование:
 *   const { onRow, menu } = useRowMenu<Row>((r) => [
 *     { key: 'open', label: 'Открыть', onClick: () => open(r) },
 *   ])
 *   <Table onRow={onRow} ... />
 *   {menu}
 */
export function useRowMenu<T extends Record<string, any>>(
  buildItems?: (record: T) => Array<Item | Falsy>,
) {
  const { message } = App.useApp()
  const [at, setAt] = useState<{ x: number; y: number; record: T } | null>(null)

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      message.success(`${what} скопирован`)
    } catch {
      message.error('Не удалось скопировать')
    }
  }

  const close = () => setAt(null)

  const onRow = (record: T) => ({
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault()
      setAt({ x: e.clientX, y: e.clientY, record })
    },
  })

  let items: MenuProps['items'] = []
  if (at) {
    const custom = (buildItems?.(at.record) ?? []).filter(Boolean) as Item[]
    const r = at.record
    // Идентификатор у разных ресурсов зовётся по-разному.
    const id = r.id ?? r.card_id ?? r.partnerId ?? r.requestId ?? r.txn_id
    const base: Item[] = []
    if (id) {
      base.push({
        key: '__id',
        icon: <CopyOutlined />,
        label: 'Копировать ID',
        onClick: () => copy(String(id), 'ID'),
      })
    }
    base.push({
      key: '__json',
      icon: <CodeOutlined />,
      label: 'Копировать строку (JSON)',
      onClick: () => copy(JSON.stringify(r, null, 2), 'JSON'),
    })

    items = custom.length ? [...custom, { type: 'divider' }, ...base] : base
  }

  const menu: ReactNode = at ? (
    <Dropdown
      open
      trigger={[]}
      menu={{ items, onClick: close }}
      onOpenChange={(open) => !open && close()}
      destroyOnHidden
    >
      {/* Якорь под курсором: Dropdown умеет позиционироваться только от элемента. */}
      <div style={{ position: 'fixed', left: at.x, top: at.y, width: 1, height: 1 }} />
    </Dropdown>
  ) : null

  return { onRow, menu, close }
}
