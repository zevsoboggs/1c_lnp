import { Tag } from 'antd'
import { find } from '../lib/enums'

type Opt = { value: string; label: string; color: string }

export function StatusTag({ list, value }: { list: Opt[]; value?: string | null }) {
  if (!value) return <>—</>
  const opt = find(list, value)
  return <Tag color={opt?.color ?? 'default'}>{opt?.label ?? value}</Tag>
}
