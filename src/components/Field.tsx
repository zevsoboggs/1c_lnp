import type { ReactNode } from 'react'

/** Фильтр в стиле 1С: подпись над полем. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="onec-filter">
      <label>{label}:</label>
      {children}
    </div>
  )
}
