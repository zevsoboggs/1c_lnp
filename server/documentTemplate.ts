/**
 * HTML-шаблон печатного документа в стиле 1С.
 *
 * Отдаётся как обычная страница: открывается по ссылке во вкладке, выглядит
 * как печатная форма, а «Сохранить как PDF» в браузере даёт тот же результат,
 * что печать из интерфейса. Тот же вид, что у клиентского PrintDocument, но
 * по стабильной ссылке.
 */
import { LOGO_SVG } from './logoSvg.js'

/** Экранирование: значения (имя партнёра, комментарий) приходят из БД/оператора. */
export function esc(v: unknown): string {
  if (v == null) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type DocField = { label: string; value: string; wide?: boolean }
export type DocOptions = {
  docType: string
  number: string
  date: string
  fields: DocField[]
  /** Свободный текст-тело (для требований, уведомлений). */
  body?: string
  /** Позиционная таблица строк. */
  table?: { columns: string[]; rows: string[][] }
  /** Итоговая жёлтая плашка. */
  total?: { label: string; value: string; sub?: string }
  footNote?: string
  /** Подписи снизу (по умолчанию Составил / Проверил). */
  signatures?: [string, string]
}

export function renderDocument(o: DocOptions): string {
  const sign = o.signatures ?? ['Составил', 'Проверил']

  const fieldsHtml = o.fields
    .map(
      (f) =>
        `<tr><td class="k">${esc(f.label)}</td><td${f.wide ? ' colspan="3"' : ''}>${esc(f.value) || '—'}</td></tr>`,
    )
    .join('')

  const tableHtml =
    o.table && o.table.rows.length
      ? `<table class="rows"><thead><tr>${o.table.columns
          .map((c) => `<th>${esc(c)}</th>`)
          .join('')}</tr></thead><tbody>${o.table.rows
          .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`
      : ''

  const totalHtml = o.total
    ? `<div class="total"><span class="lbl">${esc(o.total.label)}</span><span><span class="val">${esc(
        o.total.value,
      )}</span>${o.total.sub ? ` &nbsp; <span class="sub">${esc(o.total.sub)}</span>` : ''}</span></div>`
    : ''

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<title>${esc(o.docType)} ${esc(o.number)}</title>
<style>
  * { box-sizing: border-box; }
  body { font: 14px/1.5 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; margin: 0; background: #f5f5f5; }
  .toolbar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #ddd; padding: 10px 16px; display: flex; gap: 8px; }
  .toolbar button { font-size: 13px; padding: 6px 16px; border: 1px solid #c6c6c6; background: #fcfcfc; border-radius: 3px; cursor: pointer; }
  .toolbar button.primary { background: #0D5AA7; color: #fff; border-color: #0D5AA7; }
  .sheet { max-width: 800px; margin: 20px auto; background: #fff; padding: 40px 44px; box-shadow: 0 1px 6px rgba(0,0,0,0.1); }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 14px; margin-bottom: 18px; }
  .title { font-size: 21px; font-weight: 700; }
  .sub { color: #666; font-size: 12px; margin-top: 4px; }
  .brand { text-align: right; }
  .brand .name { font-weight: 700; font-size: 16px; margin-top: 2px; }
  .brand .amp { color: #E4002B; }
  table.fields { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table.fields td { border: 1px solid #d4d4d4; padding: 7px 10px; vertical-align: top; }
  table.fields td.k { background: #f2f2f2; width: 240px; color: #444; }
  .body-text { margin: 16px 0; line-height: 1.7; white-space: pre-wrap; }
  table.rows { width: 100%; border-collapse: collapse; margin: 14px 0; }
  table.rows th { background: #f2f2f2; border: 1px solid #d4d4d4; padding: 7px 10px; text-align: left; font-size: 13px; }
  table.rows td { border: 1px solid #d4d4d4; padding: 6px 10px; }
  .total { background: #FFFCE8; border: 1px solid #d4d4d4; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; margin: 12px 0; }
  .total .lbl { font-weight: 700; }
  .total .val { font-weight: 700; font-size: 17px; }
  .total .sub { color: #0D5AA7; font-weight: 700; font-size: 16px; }
  .sign { display: flex; justify-content: space-between; margin-top: 48px; }
  .sign div { width: 45%; }
  .sign .line { border-top: 1px solid #1a1a1a; margin-top: 40px; padding-top: 4px; font-size: 11px; color: #666; }
  .foot { margin-top: 28px; font-size: 11px; color: #999; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .sheet { box-shadow: none; margin: 0; max-width: none; padding: 0; }
    @page { margin: 16mm; }
  }
</style></head><body>
<div class="toolbar">
  <button class="primary" onclick="window.print()">Печать / Сохранить PDF</button>
  <button onclick="window.close()">Закрыть</button>
</div>
<div class="sheet">
  <div class="head">
    <div>
      <div class="title">${esc(o.docType)} № ${esc(o.number)}</div>
      <div class="sub">от ${esc(o.date)}</div>
    </div>
    <div class="brand">
      ${LOGO_SVG}
      <div class="name">Love<span class="amp">&amp;</span>Pay</div>
      <div class="sub">Платёжная платформа</div>
    </div>
  </div>

  <table class="fields"><tbody>${fieldsHtml}</tbody></table>

  ${o.body ? `<div class="body-text">${esc(o.body)}</div>` : ''}
  ${tableHtml}
  ${totalHtml}

  <div class="sign">
    <div><div class="line">${esc(sign[0])}</div></div>
    <div><div class="line">${esc(sign[1])}</div></div>
  </div>

  ${o.footNote ? `<div class="foot">${esc(o.footNote)}</div>` : ''}
</div>
</body></html>`
}
