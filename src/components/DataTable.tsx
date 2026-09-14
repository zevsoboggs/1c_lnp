import { Children, isValidElement, type ReactNode } from 'react'
import { Table, Grid } from 'antd'
import type { TableProps } from 'antd'

type ColSpec = {
  title?: ReactNode
  dataIndex?: string | string[]
  render?: (value: any, record: any, index: number) => ReactNode
  key?: string
}

/** Значение ячейки по dataIndex (строка или путь). */
function pick(record: any, dataIndex?: string | string[]) {
  if (dataIndex == null) return undefined
  const path = Array.isArray(dataIndex) ? dataIndex : [dataIndex]
  return path.reduce((acc: any, k) => (acc == null ? acc : acc[k]), record)
}

const isBlank = (v: unknown) => v === undefined || v === null || v === ''

/**
 * Таблица, которая на телефоне перестаёт быть таблицей.
 *
 * Горизонтальная прокрутка на узком экране нечитаема: видно два столбца из
 * десяти и непонятно, к чему они относятся. Поэтому ниже lg каждая строка
 * рисуется карточкой «подпись → значение», а сама AntD Table остаётся под
 * капотом с одной колонкой — так сохраняются пагинация, загрузка, пустое
 * состояние, клик по строке и раскрытие.
 *
 * Колонки берём из тех же <Table.Column>, что и на десктопе, поэтому подключение
 * сводится к замене тега — рендеры и форматирование не дублируются.
 */
export function DataTable({
  children,
  summary,
  scroll,
  ...rest
}: TableProps<any> & { children?: ReactNode }) {
  const screens = Grid.useBreakpoint()
  const isMobile =
    screens.lg === undefined ? typeof window !== 'undefined' && window.innerWidth < 992 : !screens.lg

  if (!isMobile) {
    return (
      <Table {...rest} summary={summary} scroll={scroll}>
        {children}
      </Table>
    )
  }

  const cols: ColSpec[] = Children.toArray(children)
    .filter(isValidElement)
    .map((c: any) => c.props as ColSpec)

  // Колонка без заголовка — это кнопки действий, им место в подвале карточки.
  const labeled = cols.filter((c) => !isBlank(c.title))
  const actions = cols.filter((c) => isBlank(c.title))
  const [head, ...restCols] = labeled

  const cell = (c: ColSpec, record: any, index: number) =>
    c.render ? c.render(pick(record, c.dataIndex), record, index) : pick(record, c.dataIndex)

  return (
    <Table
      {...rest}
      showHeader={false}
      // Итоги в одну колонку не ложатся — на телефоне их не показываем.
      scroll={undefined}
      columns={[
        {
          key: 'card',
          render: (_: unknown, record: any, index: number) => (
            <div className="onec-card-row">
              {head && <div className="onec-card-row__head">{cell(head, record, index)}</div>}

              <div className="onec-card-row__grid">
                {restCols.map((c, i) => {
                  const v = cell(c, record, index)
                  if (isBlank(v)) return null
                  return (
                    <div className="onec-card-row__cell" key={c.key ?? i}>
                      <span className="onec-card-row__label">{c.title}</span>
                      <span className="onec-card-row__value">{v}</span>
                    </div>
                  )
                })}
              </div>

              {actions.length > 0 && (
                <div className="onec-card-row__actions">
                  {actions.map((c, i) => (
                    <span key={c.key ?? `a${i}`}>{cell(c, record, index)}</span>
                  ))}
                </div>
              )}
            </div>
          ),
        },
      ]}
    />
  )
}
