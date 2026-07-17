/**
 * Выгрузка табличных документов в Excel — как «Сохранить как…» в 1С.
 *
 * Формат — CSV, но с расчётом на Excel в русской локали:
 *  - BOM (﻿), иначе Excel открывает кириллицу кракозябрами;
 *  - разделитель «;», потому что при десятичной запятой Excel ждёт именно его;
 *  - числа с запятой-разделителем, чтобы попадали в ячейки как числа.
 */

export type ExportColumn<T> = {
  title: string
  /** Значение ячейки. Возвращай число — попадёт как число; строку — как текст. */
  value: (row: T) => string | number | null | undefined
}

function cell(v: string | number | null | undefined): string {
  if (v == null) return ''
  if (typeof v === 'number') {
    // Число в русском Excel — с запятой; экранирование не нужно.
    return Number.isFinite(v) ? String(v).replace('.', ',') : ''
  }
  const s = String(v)
  // Кавычки, точка с запятой, перевод строки — оборачиваем в кавычки.
  if (/["\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function exportToExcel<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
): void {
  const header = columns.map((c) => cell(c.title)).join(';')
  const body = rows.map((r) => columns.map((c) => cell(c.value(r))).join(';'))
  const csv = '﻿' + [header, ...body].join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  // Дата в имени, чтобы выгрузки не перезатирали друг друга.
  const stamp = new Date().toISOString().slice(0, 10)
  a.download = `${filename}_${stamp}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

/** Рубли из копеек — числом, чтобы Excel считал по столбцу. */
export const rub = (kopecks: number | null | undefined): number | '' =>
  kopecks == null ? '' : Math.round(kopecks) / 100
