import { Link } from 'react-router'
import { Logo } from './Logo'
import { C1 } from '../theme'

/** Шапка сайдбара: фирменный знак + название платформы. */
export function Brand() {
  return (
    <Link
      to="/transactions"
      aria-label="Love&Pay"
      title="Love&Pay"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '14px 14px 12px',
        borderBottom: `1px solid ${C1.sidebarBorder}`,
        color: C1.text,
      }}
    >
      <span style={{ color: '#E4002B', flexShrink: 0 }}>
        <Logo height={26} />
      </span>
      <span style={{ lineHeight: 1.2, minWidth: 0 }}>
        <span
          className="notranslate"
          translate="no"
          style={{ display: 'block', fontWeight: 700, fontSize: 15, color: C1.text }}
        >
          Love<span style={{ color: '#E4002B' }}>&</span>Pay
        </span>
        <span style={{ display: 'block', fontSize: 11, color: C1.textSecondary }}>
          Платёжная платформа
        </span>
      </span>
    </Link>
  )
}
