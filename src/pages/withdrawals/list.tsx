import { useState } from 'react'
import { List, useTable } from '@refinedev/antd'
import { useMutation } from '@tanstack/react-query'
import { Table, Select, Space, Card, Typography, Button, App, Input, Descriptions } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import type { CrudFilters } from '@refinedev/core'
import { dt, money } from '../../lib/format'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { DangerConfirm } from '../../components/DangerAction'
import { StatusTag } from '../../components/StatusTag'
import { action } from '../../api/actions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

const STATUS = [
  ['PENDING', 'Ожидает', 'processing'],
  ['APPROVED', 'Одобрен', 'blue'],
  ['REJECTED', 'Отклонён', 'error'],
  ['COMPLETED', 'Выплачен', 'success'],
  ['CANCELLED', 'Отменён', 'default'],
].map(([value, label, color]) => ({ value, label, color }))

export const WithdrawalList = () => {
  const { message } = App.useApp()
  const [editing, setEditing] = useState<any>(null)
  const [status, setStatus] = useState<string>()
  const [reason, setReason] = useState('')

  const { tableProps, filters, setFilters, tableQuery } = useTable({
    resource: 'withdrawals',
    syncWithLocation: true,
    pagination: { pageSize: 50 },
  })

  const valueOf = (field: string) =>
    (filters as CrudFilters)?.find((f) => 'field' in f && f.field === field)?.value

  const update = useMutation({
    mutationFn: () =>
      action(`/withdrawals/${editing.id}`, {
        method: 'PATCH',
        body: { status, rejectionReason: status === 'REJECTED' ? reason || undefined : undefined },
      }),
    onSuccess: () => {
      setEditing(null)
      setStatus(undefined)
      setReason('')
      message.success('Статус изменён')
      tableQuery.refetch()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const open = (r: any) => {
    setEditing(r)
    setStatus(r.status)
    setReason(r.rejectionReason ?? '')
  }

  const { onRow, menu } = useRowMenu<any>((r) => [
    { key: 'edit', label: 'Изменить статус', onClick: () => open(r) },
    { type: 'divider' },
    r.accountNumber && {
      key: 'acc',
      label: 'Копировать счёт получателя',
      onClick: () => navigator.clipboard.writeText(r.accountNumber),
    },
    r.requestedBy?.email && {
      key: 'mail',
      label: 'Копировать email заявителя',
      onClick: () => navigator.clipboard.writeText(r.requestedBy.email),
    },
  ])

  return (
    <List title="Выводы">
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap align="end" size={12}>
          <Field label="Статус">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 180 }}
              options={STATUS.map(({ value, label }) => ({ value, label }))}
              value={valueOf('status') as string}
              onChange={(v) => setFilters([{ field: 'status', operator: 'eq', value: v }], 'merge')}
            />
          </Field>
        </Space>
      </Card>

      <Toolbar
        total={tableQuery.data?.total}
        loading={tableQuery.isFetching}
        onRefresh={() => tableQuery.refetch()}
      />

      {menu}

      <Table {...tableProps} rowKey="id" size="small" scroll={{ x: 1100 }} onRow={onRow}>
        <Table.Column dataIndex="createdAt" title="Создан" width={140} render={(v: string) => dt(v)} />
        <Table.Column
          dataIndex="status"
          title="Статус"
          width={120}
          render={(v: string) => <StatusTag list={STATUS} value={v} />}
        />
        <Table.Column
          dataIndex="amount"
          title="Сумма"
          width={130}
          align="right"
          render={(v: number) => <Text strong>{money(v)}</Text>}
        />
        <Table.Column
          dataIndex={['requestedBy', 'name']}
          title="Кто запросил"
          width={180}
          render={(v: string, r: any) => v ?? r.requestedBy?.email ?? '—'}
        />
        <Table.Column
          title="Реквизиты"
          width={220}
          render={(_: unknown, r: any) => (
            <Text style={{ fontSize: 12 }}>
              {[r.bankName, r.accountNumber].filter(Boolean).join(' · ') || '—'}
            </Text>
          )}
        />
        <Table.Column
          dataIndex="accountHolder"
          title="Получатель"
          width={160}
          render={(v: string) => v ?? '—'}
        />
        <Table.Column
          dataIndex="rejectionReason"
          title="Причина отказа"
          ellipsis
          render={(v: string) => (v ? <Text type="danger">{v}</Text> : '—')}
        />
        <Table.Column dataIndex="paidAt" title="Выплачен" width={140} render={(v: string) => dt(v)} />
        <Table.Column
          title=""
          width={50}
          fixed="right"
          render={(_: unknown, r: any) => (
            <Button size="small" icon={<EditOutlined />} title="Изменить статус" onClick={() => open(r)} />
          )}
        />
      </Table>

      <DangerConfirm
        open={!!editing}
        title="Изменить статус вывода?"
        what={
          status === 'COMPLETED'
            ? `Вывод ${money(editing?.amount)} будет помечен как выплаченный. Это бухгалтерская отметка — сами деньги система не переводит, перечислить их нужно вручную.`
            : status === 'REJECTED'
              ? `Заявка на вывод ${money(editing?.amount)} будет отклонена.`
              : `Статус заявки на ${money(editing?.amount)} изменится на ${status}.`
        }
        confirmWord={status === 'COMPLETED' ? 'ВЫПЛАЧЕНО' : undefined}
        okText="Изменить статус"
        loading={update.isPending}
        onOk={() => update.mutate()}
        onCancel={() => {
          setEditing(null)
          setStatus(undefined)
          setReason('')
        }}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Descriptions
            size="small"
            column={1}
            bordered
            items={[
              { key: 'w', label: 'Кто', children: editing?.requestedBy?.name ?? '—' },
              {
                key: 'b',
                label: 'Реквизиты',
                children: [editing?.bankName, editing?.accountNumber, editing?.accountHolder]
                  .filter(Boolean)
                  .join(' · '),
              },
            ]}
          />
          <div>
            <Text style={{ display: 'block', marginBottom: 4 }}>Новый статус</Text>
            <Select
              style={{ width: '100%' }}
              value={status}
              onChange={setStatus}
              options={STATUS.map(({ value, label }) => ({ value, label }))}
            />
          </div>
          {status === 'REJECTED' && (
            <div>
              <Text style={{ display: 'block', marginBottom: 4 }}>Причина отказа</Text>
              <Input.TextArea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          )}
        </Space>
      </DangerConfirm>
    </List>
  )
}
