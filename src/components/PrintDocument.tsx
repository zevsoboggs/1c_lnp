import { useRef, type ReactNode } from 'react'
import { Modal, Button, Space } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { Logo } from './Logo'

/**
 * Печатная форма документа в стиле 1С: шапка с реквизитами, таблица полей,
 * место для подписей. Печатается через окно браузера (Печать → «Сохранить
 * как PDF» даёт тот же результат, что «Печать в PDF» в 1С).
 *
 * Печать делаем в отдельном окне, а не через глобальный @media print всей
 * страницы: так в лист попадает только документ, без сайдбара и меню.
 */

export type DocField = { label: string; value: ReactNode; wide?: boolean }

export function PrintDocument({
  open,
  onClose,
  docType,
  number,
  date,
  fields,
  table,
  footNote,
}: {
  open: boolean
  onClose: () => void
  /** «Транзакция», «Счёт», «Заявка на возврат», «Расчётный лист» */
  docType: string
  number: string
  date: string
  fields: DocField[]
  /** Необязательная позиционная таблица (строки документа). */
  table?: { columns: string[]; rows: (ReactNode)[][] }
  footNote?: string
}) {
  const bodyRef = useRef<HTMLDivElement>(null)

  const print = () => {
    const html = bodyRef.current?.innerHTML
    if (!html) return
    const w = window.open('', '_blank', 'width=820,height=1000')
    if (!w) return
    w.document.write(`<!doctype html><html lang="ru"><head><meta charset="utf-8">
<title>${docType} ${number}</title>
<style>
  * { box-sizing: border-box; }
  body { font: 13px/1.4 'Segoe UI', Arial, sans-serif; color: #1a1a1a; margin: 32px; }
  .doc-head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 16px; }
  .doc-title { font-size: 20px; font-weight: 700; }
  .doc-sub { color: #666; font-size: 12px; margin-top: 4px; }
  .brand { text-align: right; }
  .brand .name { font-weight: 700; font-size: 15px; }
  .brand .name .amp { color: #E4002B; }
  table.fields { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  table.fields td { border: 1px solid #d4d4d4; padding: 5px 9px; vertical-align: top; }
  table.fields td.k { background: #f2f2f2; width: 220px; color: #444; }
  table.rows { width: 100%; border-collapse: collapse; margin: 12px 0; }
  table.rows th { background: #f2f2f2; border: 1px solid #d4d4d4; padding: 6px 9px; text-align: left; font-size: 12px; }
  table.rows td { border: 1px solid #d4d4d4; padding: 5px 9px; }
  .sign { display: flex; justify-content: space-between; margin-top: 40px; }
  .sign div { width: 45%; }
  .sign .line { border-top: 1px solid #1a1a1a; margin-top: 34px; padding-top: 4px; font-size: 11px; color: #666; }
  .foot { margin-top: 24px; font-size: 11px; color: #888; }
  @media print { body { margin: 12mm; } }
</style></head><body>${html}
<script>window.onload = () => { window.print(); }</script>
</body></html>`)
    w.document.close()
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={720}
      title={`${docType} ${number}`}
      footer={
        <Space>
          <Button onClick={onClose}>Закрыть</Button>
          <Button type="primary" icon={<PrinterOutlined />} onClick={print}>
            Печать / PDF
          </Button>
        </Space>
      }
    >
      {/* Этот блок и печатается, и показывается в предпросмотре. */}
      <div ref={bodyRef}>
        <div className="doc-head">
          <div>
            <div className="doc-title">
              {docType} № {number}
            </div>
            <div className="doc-sub">от {date}</div>
          </div>
          <div className="brand">
            <div style={{ display: 'inline-block', color: '#E4002B' }}>
              <Logo height={26} />
            </div>
            <div className="name">
              Love<span className="amp">&</span>Pay
            </div>
            <div className="doc-sub">Платёжная платформа</div>
          </div>
        </div>

        <table className="fields">
          <tbody>
            {fields.map((f, i) => (
              <tr key={i}>
                <td className="k">{f.label}</td>
                <td colSpan={f.wide ? 3 : 1}>{f.value ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {table && table.rows.length > 0 && (
          <table className="rows">
            <thead>
              <tr>
                {table.columns.map((c, i) => (
                  <th key={i}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i}>
                  {r.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="sign">
          <div>
            <div className="line">Составил</div>
          </div>
          <div>
            <div className="line">Проверил</div>
          </div>
        </div>

        {footNote && <div className="foot">{footNote}</div>}
      </div>
    </Modal>
  )
}
