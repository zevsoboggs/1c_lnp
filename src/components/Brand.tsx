import { Link } from 'react-router'
import { Logo } from './Logo'
import { C1 } from '../theme'

/**
 * Шапка сайдбара: фирменный знак + название платформы.
 * compact — для мобильной шапки: ниже, без подписи и разделителя.
 */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/home"
      aria-label="Love&Pay"
      title="Love&Pay"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 8 : 10,
        padding: compact ? 0 : '14px 14px 12px',
        borderBottom: compact ? 'none' : `1px solid ${C1.sidebarBorder}`,
        color: C1.text,
      }}
    >
      <span style={{ color: '#E4002B', flexShrink: 0 }}>
        <Logo height={compact ? 22 : 26} />
      </span>
      <span style={{ lineHeight: 1.2, minWidth: 0 }}>
        <span
          className="notranslate"
          translate="no"
          style={{ display: 'block', fontWeight: 700, fontSize: compact ? 14 : 15, color: C1.text }}
        >
          Love<span style={{ color: '#E4002B' }}>&</span>Pay
        </span>
        {!compact && (
          <span style={{ display: 'block', fontSize: 11, color: C1.textSecondary }}>
            Платёжная платформа
          </span>
        )}
      </span>
    </Link>
  )
}
