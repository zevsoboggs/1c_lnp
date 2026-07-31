import { money, dt } from './format'

export type ReceiptData = {
  invoiceNumber: string
  amount: number
  currency?: string
  status: string // PAID / PENDING / …
  statusLabel: string
  partner: string
  payerName?: string | null
  payerPhone?: string | null
  customer?: string | null
  createdAt?: string | null
  paidAt?: string | null
  description?: string | null
}

/** Обрезает строку под ширину с многоточием. */
function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let s = text
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1)
  return s + '…'
}

/**
 * Рисует чек об оплате на canvas и скачивает PNG. Без внешних зависимостей —
 * чтобы не тащить в сборку тяжёлые библиотеки ради одной картинки.
 */
export function downloadReceiptImage(d: ReceiptData) {
  const rows: Array<[string, string]> = [['Номер счёта', d.invoiceNumber], ['Партнёр', d.partner]]
  if (d.payerName) rows.push(['Плательщик', d.payerName])
  if (d.payerPhone) rows.push(['Телефон', d.payerPhone])
  if (d.customer && !d.payerName) rows.push(['Клиент', d.customer])
  if (d.createdAt) rows.push(['Создан', dt(d.createdAt)])
  if (d.paidAt) rows.push(['Оплачен', dt(d.paidAt)])
  if (d.description) rows.push(['Назначение', d.description])

  const scale = 2
  const W = 660
  const pad = 44
  const rowH = 44
  const headerH = 200
  const H = headerH + rows.length * rowH + 78

  const canvas = document.createElement('canvas')
  canvas.width = W * scale
  canvas.height = H * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.scale(scale, scale)
  ctx.textBaseline = 'alphabetic'

  // Фон + рамка.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1)
  // Красная полоса сверху — фирменный акцент.
  ctx.fillStyle = '#E4002B'
  ctx.fillRect(0, 0, W, 5)

  // Бренд.
  ctx.font = '700 24px system-ui, -apple-system, Segoe UI, sans-serif'
  ctx.fillStyle = '#111827'
  ctx.fillText('Love', pad, 56)
  const lw = ctx.measureText('Love').width
  ctx.fillStyle = '#E4002B'
  ctx.fillText('&', pad + lw, 56)
  const aw = ctx.measureText('&').width
  ctx.fillStyle = '#111827'
  ctx.fillText('Pay', pad + lw + aw, 56)
  ctx.font = '13px system-ui, sans-serif'
  ctx.fillStyle = '#6b7280'
  ctx.fillText('Чек об оплате', pad, 78)

  // Статус — плашка справа.
  const paid = d.status === 'PAID'
  const badge = d.statusLabel
  ctx.font = '600 13px system-ui, sans-serif'
  const bw = ctx.measureText(badge).width + 24
  const bx = W - pad - bw
  ctx.fillStyle = paid ? '#dcfce7' : '#fef3c7'
  roundRect(ctx, bx, 34, bw, 26, 13)
  ctx.fill()
  ctx.fillStyle = paid ? '#15803d' : '#b45309'
  ctx.fillText(badge, bx + 12, 51)

  // Сумма — крупно.
  ctx.font = '700 42px system-ui, sans-serif'
  ctx.fillStyle = '#111827'
  ctx.fillText(money(d.amount, d.currency ?? 'RUB'), pad, 150)

  // Разделитель.
  ctx.strokeStyle = '#eef0f2'
  ctx.beginPath()
  ctx.moveTo(pad, headerH - 20)
  ctx.lineTo(W - pad, headerH - 20)
  ctx.stroke()

  // Строки: подпись слева, значение справа.
  let y = headerH + 6
  for (const [k, v] of rows) {
    ctx.font = '13px system-ui, sans-serif'
    ctx.fillStyle = '#6b7280'
    ctx.fillText(k, pad, y)
    const kw = ctx.measureText(k).width
    ctx.font = '600 15px system-ui, sans-serif'
    ctx.fillStyle = '#111827'
    const maxV = W - pad * 2 - kw - 20
    const val = fit(ctx, v, maxV)
    const vw = ctx.measureText(val).width
    ctx.fillText(val, W - pad - vw, y)
    ctx.strokeStyle = '#f4f5f6'
    ctx.beginPath()
    ctx.moveTo(pad, y + 14)
    ctx.lineTo(W - pad, y + 14)
    ctx.stroke()
    y += rowH
  }

  // Подвал.
  ctx.font = '12px system-ui, sans-serif'
  ctx.fillStyle = '#9ca3af'
  ctx.fillText(`Сформировано в админ-панели Love&Pay · ${dt(new Date().toISOString())}`, pad, H - 26)

  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Чек_${d.invoiceNumber}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
