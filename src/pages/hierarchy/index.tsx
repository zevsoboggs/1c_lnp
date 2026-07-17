import { useMemo, useState } from 'react'
import { useCustom } from '@refinedev/core'
import { Card, Tree, Space, Statistic, Typography, Tag, Input, Empty } from 'antd'
import { ApartmentOutlined } from '@ant-design/icons'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'

const { Text } = Typography

type Node = {
  id: string
  name: string
  partnerId: string
  isActive: boolean
  moderationStatus: string
  defaultProvider: string | null
  isSubPartner: boolean
  children: Node[]
}

const MOD_COLOR: Record<string, string> = {
  APPROVED: 'success',
  PENDING: 'processing',
  REJECTED: 'error',
}

export const HierarchyPage = () => {
  const [search, setSearch] = useState('')

  const { query, result } = useCustom<{
    hierarchy: Node[]
    stats: { rootPartners: number; totalPartners: number; subPartners: number }
  }>({ url: '/partners/hierarchy', method: 'get' })

  const tree = result.data?.hierarchy ?? []
  const s = result.data?.stats

  /** Ветку показываем, если совпал сам узел или кто-то из потомков. */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return tree

    const match = (n: Node): boolean =>
      n.name?.toLowerCase().includes(q) ||
      n.partnerId?.toLowerCase().includes(q) ||
      (n.children ?? []).some(match)

    const prune = (nodes: Node[]): Node[] =>
      nodes.filter(match).map((n) => ({ ...n, children: prune(n.children ?? []) }))

    return prune(tree)
  }, [tree, search])

  const toTreeData = (nodes: Node[]): any[] =>
    nodes.map((n) => ({
      key: n.id,
      title: (
        <Space size={6}>
          <Text strong={!n.isSubPartner}>{n.name}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {n.partnerId}
          </Text>
          {!n.isActive && <Tag style={{ marginInlineEnd: 0 }}>выкл</Tag>}
          {n.moderationStatus !== 'APPROVED' && (
            <Tag color={MOD_COLOR[n.moderationStatus]} style={{ marginInlineEnd: 0 }}>
              {n.moderationStatus}
            </Tag>
          )}
          {n.defaultProvider && (
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>
              {n.defaultProvider}
            </Tag>
          )}
          {n.children?.length > 0 && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              · {n.children.length} суб
            </Text>
          )}
        </Space>
      ),
      children: toTreeData(n.children ?? []),
    }))

  // При поиске раскрываем всё, чтобы найденное в глубине было видно сразу.
  const expanded = useMemo(() => {
    if (!search.trim()) return undefined
    const keys: string[] = []
    const walk = (nodes: Node[]) =>
      nodes.forEach((n) => {
        if (n.children?.length) {
          keys.push(n.id)
          walk(n.children)
        }
      })
    walk(filtered)
    return keys
  }, [filtered, search])

  const withChildren = tree.filter((n) => n.children?.length > 0).length

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card title="Иерархия партнёров" size="small">
        <Space size={32} wrap>
          <Statistic title="Всего партнёров" value={s?.totalPartners ?? 0} loading={query.isFetching} />
          <Statistic title="Корневых" value={s?.rootPartners ?? 0} />
          <Statistic
            title="Суб-партнёров"
            value={s?.subPartners ?? 0}
            valueStyle={{ color: '#0D5AA7' }}
          />
          <Statistic title="Имеют суб-партнёров" value={withChildren} />
        </Space>
      </Card>

      <Card size="small">
        <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
          <Field label="Поиск по дереву">
            <Input.Search
              allowClear
              placeholder="Название или код партнёра…"
              style={{ width: 300 }}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
        </Space>

        <Toolbar loading={query.isFetching} onRefresh={() => query.refetch()} total={filtered.length} />

        <div style={{ marginTop: 12 }}>
          {filtered.length === 0 && !query.isFetching ? (
            <Empty description="Ничего не найдено" />
          ) : (
            <Tree
              treeData={toTreeData(filtered)}
              showLine
              switcherIcon={<ApartmentOutlined />}
              {...(expanded ? { expandedKeys: expanded } : {})}
              selectable={false}
              style={{ background: 'transparent' }}
            />
          )}
        </div>
      </Card>
    </Space>
  )
}
