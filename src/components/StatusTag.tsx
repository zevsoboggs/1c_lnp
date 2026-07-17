import { find } from '../lib/enums'

type Opt = { value: string; label: string; color: string }

/**
 * Статус-пилюля в стиле 1С 8.5: заметный мягкий фон + насыщенный текст,
 * скруглённая. AntD-цвета статусов дают бледный фон, поэтому раскрашиваем
 * сами по семантике (success/error/…): фон приглушённый, текст цветной.
 */
const PALETTE: Record<string, { bg: string; fg: string }> = {
  success: { bg: '#e7f5ec', fg: '#1a7f37' },
  green: { bg: '#e7f5ec', fg: '#1a7f37' },
  error: { bg: '#fdecec', fg: '#c93838' },
  red: { bg: '#fdecec', fg: '#c93838' },
  warning: { bg: '#fdf3e3', fg: '#b25e09' },
  orange: { bg: '#fdf3e3', fg: '#b25e09' },
  gold: { bg: '#fdf3e3', fg: '#b25e09' },
  processing: { bg: '#eaf2fd', fg: '#1668dc' },
  blue: { bg: '#eaf2fd', fg: '#1668dc' },
  cyan: { bg: '#e4f6f7', fg: '#0c8599' },
  purple: { bg: '#f2ecfb', fg: '#7b4fce' },
  default: { bg: '#f1f1f3', fg: '#52525b' },
}

export function StatusTag({ list, value }: { list: Opt[]; value?: string | null }) {
  if (!value) return <>—</>
  const opt = find(list, value)
  const c = PALETTE[opt?.color ?? 'default'] ?? PALETTE.default
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: '18px',
        background: c.bg,
        color: c.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {opt?.label ?? value}
    </span>
  )
}
