import { useState } from 'react'
import { List, useTable } from '@refinedev/antd'
import { useMutation } from '@tanstack/react-query'
import { Table, Select, Space, Card, Typography, Button, App, Input, Alert } from 'antd'
import { CheckOutlined, CloseOutlined, FileExcelOutlined } from '@ant-design/icons'
import type { CrudFilters } from '@refinedev/core'
import { dt, money } from '../../lib/format'
import { exportToExcel, rub } from '../../lib/export'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { DangerConfirm } from '../../components/DangerAction'
import { StatusTag } from '../../components/StatusTag'
import { REFUND_STATUS } from '../../lib/apiEnums'
import { action } from '../../api/actions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

export const RefundList = () => {
  const { message } = App.useApp()
  const [approving, setApproving] = useState<any>(null)
  const [rejecting, setRejecting] = useState<any>(null)
  const [comment, setComment] = useState('')

  const { tableProps, filters, setFilters, tableQuery } = useTable({
    resource: 'refund-requests',
    syncWithLocation: true,
    pagination: { pageSize: 50 },
  })

  const valueOf = (field: string) =>
    (filters as CrudFilters)?.find((f) => 'field' in f && f.field === field)?.value

  const apply = (field: string, value: unknown) =>
    setFilters([{ field, operator: 'eq', value }], 'merge')

  const done = (text: string) => {
    setApproving(null)
    setRejecting(null)
    setComment('')
    message.success(text)
    tableQuery.refetch()
  }

  const approve = useMutation({
    mutationFn: (id: string) =>
      action<{ status: string; providerRefundId: string }>(`/refund-requests/${id}/approve`, {
        body: { comment: comment || undefined },
      }),
    onSuccess: (r) => done(`Возврат исполнен · ${r.providerRefundId ?? r.status}`),
    onError: (e: any) => {
      setApproving(null)
      setComment('')
      tableQuery.refetch()
      // 502 PROVIDER_REFUND_FAILED — заявка уже помечена FAILED и повторить
      // её нельзя: нужна новая заявка. Поэтому текст должен быть однозначным.
      message.error({
        content:
          e.code === 'PROVIDER_REFUND_FAILED'
            ? `Провайдер отклонил возврат: ${e.message}. Заявка помечена как FAILED — повторить её нельзя, нужна новая.`
            : e.message,
        duration: 10,
      })
    },
  })

  const reject = useMutation({
    mutationFn: (id: string) =>
      action(`/refund-requests/${id}/reject`, { body: { comment: comment || undefined } }),
    onSuccess: () => done('Заявка отклонена'),
    onError: (e: Error) => {
      setRejecting(null)
      message.error(e.message)
    },
  })

  const { onRow, menu } = useRowMenu<any>((r) => [
    r.status === 'PENDING' && {
      key: 'approve',
      label: 'Утвердить и исполнить',
      onClick: () => setApproving(r),
    },
    r.status === 'PENDING' && {
      key: 'reject',
      label: 'Отклонить',
      danger: true,
      onClick: () => setRejecting(r),
    },
    r.status === 'PENDING' && { type: 'divider' },
    r.status && {
      key: 'st',
      label: `Отобрать по статусу «${r.status}»`,
      onClick: () => apply('status', r.status),
    },
    r.invoice?.invoiceNumber && {
      key: 'inv',
      label: 'Копировать номер счёта',
      onClick: () => navigator.clipboard.writeText(r.invoice.invoiceNumber),
    },
  ])

  const exportRows = () =>
    exportToExcel(
      (tableQuery.data?.data ?? []) as any[],
      [
        { title: 'Создан', value: (r) => (r.createdAt ? dt(r.createdAt) : '') },
        { title: 'Статус', value: (r) => r.status },
        { title: 'Сумма, ₽', value: (r) => rub(r.amount) },
        { title: 'Инвойс', value: (r) => r.invoice?.invoiceNumber ?? r.invoiceId ?? '' },
        { title: 'Партнёр', value: (r) => r.partner?.name ?? '' },
        { title: 'Причина', value: (r) => r.reason ?? '' },
        { title: 'Ошибка', value: (r) => r.executionError ?? '' },
      ],
      'Возвраты',
    )

  return (
    <List
      title="Возвраты"
      headerButtons={
        <Button size="small" icon={<FileExcelOutlined />} onClick={exportRows}>
          В Excel
        </Button>
      }
    >
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap align="end" size={12}>
          <Field label="Статус">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 170 }}
              options={REFUND_STATUS.map(({ value, label }) => ({ value, label }))}
              value={valueOf('status') as string}
              onChange={(v) => apply('status', v)}
            />
          </Field>
          <Field label="Партнёр">
            <PartnerSelect
              value={valueOf('partnerId') as string}
              onChange={(v) => apply('partnerId', v)}
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

      <Table {...tableProps} rowKey="id" size="small" scroll={{ x: 1150 }} onRow={onRow}>
        <Table.Column dataIndex="createdAt" title="Создана" width={140} render={(v: string) => dt(v)} />
        <Table.Column
          dataIndex="status"
          title="Статус"
          width={120}
          render={(v: string) => <StatusTag list={REFUND_STATUS} value={v} />}
        />
        <Table.Column
          dataIndex="amount"
          title="Сумма"
          width={130}
          align="right"
          render={(v: number) => <Text strong>{money(v)}</Text>}
        />
        <Table.Column
          dataIndex={['invoice', 'invoiceNumber']}
          title="Инвойс"
          width={170}
          render={(v: string, r: any) => v ?? r.invoiceId ?? '—'}
        />
        <Table.Column
          dataIndex={['partner', 'name']}
          title="Партнёр"
          width={170}
          render={(v: string) => v ?? '—'}
        />
        <Table.Column dataIndex="reason" title="Причина" ellipsis render={(v: string) => v ?? '—'} />
        <Table.Column
          dataIndex="executionError"
          title="Ошибка"
          width={180}
          ellipsis
          render={(v: string) => (v ? <Text type="danger">{v}</Text> : '—')}
        />
        <Table.Column
          title="Действия"
          width={110}
          fixed="right"
          render={(_: unknown, r: any) =>
            r.status === 'PENDING' ? (
              <Space size={4}>
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckOutlined />}
                  title="Утвердить и исполнить"
                  onClick={() => setApproving(r)}
                />
                <Button
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  title="Отклонить"
                  onClick={() => setRejecting(r)}
                />
              </Space>
            ) : (
              <Text type="secondary" style={{ fontSize: 11 }}>
                —
              </Text>
            )
          }
        />
      </Table>

      <DangerConfirm
        open={!!approving}
        title="Утвердить и исполнить возврат?"
        what={`Деньги ${money(approving?.amount)} будут реально возвращены плательщику через провайдера. Отменить это действие нельзя.`}
        confirmWord="ВЕРНУТЬ"
        okText="Исполнить возврат"
        loading={approve.isPending}
        onOk={() => approve.mutate(approving.id)}
        onCancel={() => {
          setApproving(null)
          setComment('')
        }}
      >
        <Alert
          type="info"
          message="Если провайдер откажет, заявка станет FAILED и повторить её будет нельзя — потребуется новая."
        />
        <Input.TextArea
          rows={2}
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </DangerConfirm>

      <DangerConfirm
        open={!!rejecting}
        title="Отклонить заявку?"
        what={`Заявка на возврат ${money(rejecting?.amount)} будет отклонена. Партнёру уйдёт вебхук refund.rejected. Деньги не двигаются.`}
        okText="Отклонить"
        loading={reject.isPending}
        onOk={() => reject.mutate(rejecting.id)}
        onCancel={() => {
          setRejecting(null)
          setComment('')
        }}
      >
        <Input.TextArea
          rows={2}
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </DangerConfirm>
    </List>
  )
}
