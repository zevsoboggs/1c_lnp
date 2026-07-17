import { useState, useMemo } from 'react'
import { useCustom } from '@refinedev/core'
import { useMutation } from '@tanstack/react-query'
import { Card, Table, Space, Input, Typography, InputNumber, Button, App, Tag } from 'antd'
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { action } from '../../api/actions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

type Row = {
  id: string
  partnerId: string
  name: string
  email: string
  isBlocked: boolean
  platformPosMarkup: number | null
  ownerName: string | null
  ownerCurrencyMarkup: number | null
  usersCount: number
  subPartnersCount: number
  effectiveOwnerMarkup: number | null
}

/**
 * POS-наценки партнёров. Эндпоинт не принимает ни page/limit, ни фильтров —
 * отдаёт всех разом, поэтому поиск и постраничность здесь клиентские.
 */
export const PosMarkupList = () => {
  const { message } = App.useApp()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState<number>(0)

  const { query, result } = useCustom<{ partners: Row[] }>({ url: '/pos-markups', method: 'get' })
  const all = result.data?.partners ?? []

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.partnerId?.toLowerCase().includes(q),
    )
  }, [all, search])

  const save = useMutation({
    // Поле в теле называется partnerId, но API ищет партнёра по первичному
    // ключу (WHERE id = ...). Поэтому шлём r.id (UUID), а НЕ r.partnerId (код).
    mutationFn: (id: string) =>
      action('/pos-markups', {
        method: 'PATCH',
        body: { partnerId: id, platformPosMarkup: Number(draft) },
      }),
    onSuccess: () => {
      setEditing(null)
      message.success('POS-наценка сохранена')
      query.refetch()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const { onRow, menu } = useRowMenu<Row>((r) => [
    {
      key: 'edit',
      label: 'Изменить POS-наценку',
      onClick: () => {
        setEditing(r.id)
        setDraft(r.platformPosMarkup ?? 0)
      },
    },
    { type: 'divider' },
    r.partnerId && {
      key: 'code',
      label: 'Копировать код партнёра',
      onClick: () => navigator.clipboard.writeText(r.partnerId),
    },
    r.email && {
      key: 'mail',
      label: 'Копировать email',
      onClick: () => navigator.clipboard.writeText(r.email),
    },
  ])

  return (
    <Card title="POS-наценки" size="small">
      {menu}
      <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
        <Field label="Поиск">
          <Input.Search
            allowClear
            placeholder="Партнёр, email, код…"
            style={{ width: 280 }}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
      </Space>

      <Toolbar
        total={rows.length}
        loading={query.isFetching}
        onRefresh={() => query.refetch()}
      />

      <Table
        dataSource={rows}
        loading={query.isFetching}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 30 }}
        scroll={{ x: 950 }}
        onRow={onRow}
      >
        <Table.Column
          dataIndex="name"
          title="Партнёр"
          width={200}
          fixed="left"
          render={(v: string, r: Row) => (
            <Space size={4}>
              <Text strong>{v}</Text>
              {r.isBlocked && <Tag color="error">блок</Tag>}
            </Space>
          )}
        />
        <Table.Column
          dataIndex="partnerId"
          title="Код"
          width={160}
          render={(v: string) => <Text copyable={!!v}>{v}</Text>}
        />
        <Table.Column
          dataIndex="platformPosMarkup"
          title="POS-наценка"
          width={170}
          align="right"
          sorter={(a: Row, b: Row) => (a.platformPosMarkup ?? 0) - (b.platformPosMarkup ?? 0)}
          render={(v: number, r: Row) =>
            editing === r.id ? (
              <Space size={4}>
                <InputNumber
                  size="small"
                  autoFocus
                  min={0}
                  max={100}
                  step={0.1}
                  precision={2}
                  value={draft}
                  onChange={(x) => setDraft(x ?? 0)}
                  style={{ width: 80 }}
                  onPressEnter={() => save.mutate(r.id)}
                />
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={save.isPending}
                  onClick={() => save.mutate(r.id)}
                />
                <Button size="small" icon={<CloseOutlined />} onClick={() => setEditing(null)} />
              </Space>
            ) : (
              <Space size={4}>
                <Text strong>{v == null ? '—' : `${v}%`}</Text>
                <Button
                  size="small"
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setEditing(r.id)
                    setDraft(v ?? 0)
                  }}
                />
              </Space>
            )
          }
        />
        <Table.Column
          dataIndex="ownerName"
          title="Владелец"
          width={170}
          render={(v: string) => v ?? '—'}
        />
        <Table.Column
          dataIndex="effectiveOwnerMarkup"
          title="Эффективная владельца"
          width={180}
          align="right"
          render={(v: number) => (v == null ? '—' : <Text style={{ color: '#0D5AA7' }}>{v}%</Text>)}
        />
        <Table.Column dataIndex="usersCount" title="Юзеров" width={90} align="right" />
        <Table.Column dataIndex="subPartnersCount" title="Суб-партнёров" width={130} align="right" />
      </Table>
    </Card>
  )
}
