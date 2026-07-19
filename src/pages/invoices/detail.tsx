import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Drawer, Descriptions, Spin, Alert, Space, Button, Tag, Typography, Card, Table } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { dt, money } from '../../lib/format'
import { INVOICE_STATUS } from '../../lib/enums'
import { StatusTag } from '../../components/StatusTag'
import { PrintDocument } from '../../components/PrintDocument'
import { action } from '../../api/actions'

const { Text } = Typography

/**
 * Фактический плательщик. В полях инвойса его нет — он приходит от провайдера
 * СБП после оплаты и лежит в транзакции. Формат зависит от провайдера:
 *  - KANYON:  paymentInfo.payer = { name, phone }
 *  - OVERPAY: paymentInfo.order.paymentReferenceUserName / …Phone
 * Телефон банк отдаёт замаскированным (927***9329 / *********9962).
 */
function extractPayer(inv: any): { name: string; phone: string | null } | null {
  for (const t of inv?.transactions ?? []) {
    const pi = t.paymentInfo ?? {}
    // KANYON — payer объектом.
    if (pi.payer && typeof pi.payer === 'object' && pi.payer.name) {
      return { name: pi.payer.name, phone: pi.payer.phone ?? null }
    }
    // OVERPAY — реквизиты в order.
    const o = pi.order ?? {}
    if (o.paymentReferenceUserName) {
      return { name: o.paymentReferenceUserName, phone: o.paymentReferenceUserPhone ?? null }
    }
    // payer строкой — запасной вариант.
    if (typeof pi.payer === 'string' && pi.payer) {
      return { name: pi.payer, phone: null }
    }
  }
  return null
}

export function InvoiceDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [printing, setPrinting] = useState(false)

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => action<{ invoice: any }>(`/invoices/${id}`, { method: 'GET' }),
    enabled: !!id,
  })

  const inv = data?.invoice
  const txns: any[] = inv?.transactions ?? []
  const refunds: any[] = inv?.refundRequests ?? []
  const payer = inv ? extractPayer(inv) : null

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      width={760}
      title="Счёт (инвойс)"
      extra={
        inv && (
          <Button icon={<PrinterOutlined />} onClick={() => setPrinting(true)}>
            Документ
          </Button>
        )
      }
    >
      {isFetching && <Spin />}
      {isError && (
        <Alert type="error" showIcon message="Не удалось загрузить" description={(error as Error)?.message} />
      )}

      {inv && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {/* Фактический плательщик — кто реально оплатил (из данных СБП). */}
          {payer && (
            <Card size="small" title="Плательщик" style={{ background: '#eaf2fd' }}>
              <Descriptions
                size="small"
                column={2}
                items={[
                  {
                    key: 'pn',
                    label: 'ФИО',
                    children: <Text strong copyable>{payer.name}</Text>,
                  },
                  {
                    key: 'pp',
                    label: 'Телефон',
                    children: payer.phone ? (
                      <Text copyable>{payer.phone}</Text>
                    ) : (
                      <Text type="secondary">—</Text>
                    ),
                  },
                ]}
              />
            </Card>
          )}

          <Descriptions
            size="small"
            column={2}
            bordered
            items={[
              {
                key: 'n',
                label: 'Номер',
                children: <Text copyable strong>{inv.invoiceNumber}</Text>,
              },
              { key: 's', label: 'Статус', children: <StatusTag list={INVOICE_STATUS} value={inv.status} /> },
              {
                key: 'a',
                label: 'Сумма',
                children: <Text strong>{money(inv.amount, inv.currency ?? 'RUB')}</Text>,
              },
              { key: 'cur', label: 'Валюта', children: inv.currency ?? 'RUB' },
              { key: 'c', label: 'Создан', children: dt(inv.createdAt) },
              { key: 'pd', label: 'Оплачен', children: dt(inv.paidAt) },
              { key: 'exp', label: 'Истекает', children: dt(inv.expiresAt) },
              { key: 'p', label: 'Партнёр', children: inv.partner?.name ?? inv.partnerId ?? '—' },
              { key: 'cn', label: 'Клиент', children: inv.customerName ?? '—' },
              { key: 'ce', label: 'Email', children: inv.customerEmail ?? '—' },
              { key: 'cp', label: 'Телефон', children: inv.customerPhone ?? '—' },
              { key: 'ep', label: 'Ожидаемый плательщик', children: inv.expectedPayerName ?? '—' },
              {
                key: 'kyc',
                label: 'KYC',
                children: inv.kycRequired ? (
                  <Tag color={inv.kycVerified ? 'success' : 'warning'}>
                    {inv.kycVerified ? 'пройден' : 'требуется'}
                  </Tag>
                ) : (
                  '—'
                ),
              },
              { key: 'rc', label: 'Чек', children: inv.receiptStatus ?? '—' },
              { key: 'd', label: 'Описание', span: 2, children: inv.description ?? '—' },
            ]}
          />

          {txns.length > 0 && (
            <Card size="small" title={`Транзакции · ${txns.length}`}>
              <Table dataSource={txns} rowKey="id" size="small" pagination={false}>
                <Table.Column dataIndex="createdAt" title="Создана" width={140} render={(v: string) => dt(v)} />
                <Table.Column dataIndex="status" title="Статус" width={130} />
                <Table.Column
                  dataIndex="amount"
                  title="Сумма"
                  align="right"
                  render={(v: number) => money(v)}
                />
                <Table.Column dataIndex="provider" title="Провайдер" width={110} />
              </Table>
            </Card>
          )}

          {refunds.length > 0 && (
            <Card size="small" title={`Возвраты · ${refunds.length}`}>
              <Table dataSource={refunds} rowKey="id" size="small" pagination={false}>
                <Table.Column dataIndex="createdAt" title="Создан" width={140} render={(v: string) => dt(v)} />
                <Table.Column dataIndex="status" title="Статус" width={130} />
                <Table.Column
                  dataIndex="amount"
                  title="Сумма"
                  align="right"
                  render={(v: number) => money(v)}
                />
              </Table>
            </Card>
          )}
        </Space>
      )}

      {inv && (
        <PrintDocument
          open={printing}
          onClose={() => setPrinting(false)}
          docType="Счёт"
          number={inv.invoiceNumber}
          date={dt(inv.createdAt)}
          fields={[
            { label: 'Статус', value: INVOICE_STATUS.find((s) => s.value === inv.status)?.label ?? inv.status },
            { label: 'Сумма', value: money(inv.amount, inv.currency ?? 'RUB') },
            { label: 'Партнёр', value: inv.partner?.name ?? '—' },
            ...(payer
              ? [{ label: 'Плательщик', value: [payer.name, payer.phone].filter(Boolean).join(' · '), wide: true }]
              : []),
            { label: 'Клиент', value: inv.customerName ?? '—' },
            { label: 'Email / телефон', value: [inv.customerEmail, inv.customerPhone].filter(Boolean).join(' · ') || '—', wide: true },
            { label: 'Создан', value: dt(inv.createdAt) },
            { label: 'Оплачен', value: dt(inv.paidAt) },
            { label: 'Описание', value: inv.description ?? '—', wide: true },
          ]}
          table={
            txns.length > 0
              ? {
                  columns: ['Дата', 'Статус', 'Сумма', 'Провайдер'],
                  rows: txns.map((t) => [dt(t.createdAt), t.status, money(t.amount), t.provider]),
                }
              : undefined
          }
          footNote={`Документ сформирован из админ-панели Love&Pay. ID счёта: ${inv.id}`}
        />
      )}
    </Drawer>
  )
}
