import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Drawer, Descriptions, Spin, Alert, Space, Button, Tag, Typography, Card } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { dt, money } from '../../lib/format'
import { TRANSACTION_STATUS } from '../../lib/enums'
import { StatusTag } from '../../components/StatusTag'
import { PrintDocument } from '../../components/PrintDocument'
import { action } from '../../api/actions'

export function TransactionDetail({
  id,
  onClose,
}: {
  id: string | null
  onClose: () => void
}) {
  const [printing, setPrinting] = useState(false)

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['transaction', id],
    queryFn: () => action<{ transaction: any }>(`/transactions/${id}`, { method: 'GET' }),
    enabled: !!id,
  })

  const t = data?.transaction
  const pi = t?.paymentInfo ?? {}

  return (
    <Drawer
      open={!!id}
      onClose={onClose}
      width={720}
      title="Транзакция"
      extra={
        t && (
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

      {t && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Descriptions
            size="small"
            column={2}
            bordered
            items={[
              { key: 's', label: 'Статус', children: <StatusTag list={TRANSACTION_STATUS} value={t.status} /> },
              {
                key: 'a',
                label: 'Сумма',
                children: <Typography.Text strong>{money(t.amount, t.orderCurrency ?? 'RUB')}</Typography.Text>,
              },
              { key: 'c', label: 'Создана', children: dt(t.createdAt) },
              { key: 'comp', label: 'Завершена', children: dt(t.completedAt) },
              { key: 'prov', label: 'Провайдер', children: <Tag>{t.provider}</Tag> },
              { key: 'oc', label: 'Валюта заказа', children: t.orderCurrency ?? '—' },
              { key: 'pc', label: 'Валюта оплаты', children: t.paymentCurrency ?? '—' },
              { key: 'tsp', label: 'tspCode', children: t.tspCode ?? '—' },
              {
                key: 'ext',
                label: 'Внешний ID',
                span: 2,
                children: <Typography.Text copyable={!!t.externalOrderId}>{t.externalOrderId ?? '—'}</Typography.Text>,
              },
              {
                key: 'mo',
                label: 'Merchant order',
                span: 2,
                children: <Typography.Text copyable={!!t.merchantOrderId}>{t.merchantOrderId ?? '—'}</Typography.Text>,
              },
              { key: 'p', label: 'Партнёр', span: 2, children: t.partner?.name ?? t.partnerId ?? '—' },
              {
                key: 'err',
                label: 'Ошибка',
                span: 2,
                children: t.errorMessage ? <Typography.Text type="danger">{t.errorMessage}</Typography.Text> : '—',
              },
            ]}
          />

          {t.invoice && (
            <Card size="small" title="Связанный счёт">
              <Descriptions
                size="small"
                column={2}
                items={[
                  { key: 'n', label: 'Номер', children: t.invoice.invoiceNumber },
                  { key: 'a', label: 'Сумма', children: money(t.invoice.amount) },
                  { key: 's', label: 'Статус', children: t.invoice.status },
                  { key: 'pd', label: 'Оплачен', children: dt(t.invoice.paidAt) },
                ]}
              />
            </Card>
          )}

          {pi && Object.keys(pi).length > 0 && (
            <Card size="small" title="Данные провайдера">
              <Descriptions
                size="small"
                column={2}
                items={[
                  { key: 'st', label: 'Статус', children: pi.status ?? '—' },
                  { key: 'raw', label: 'Raw-статус', children: pi.rawStatus ?? '—' },
                  { key: 'payer', label: 'Плательщик', children: pi.payer ?? '—' },
                  {
                    key: 'tid',
                    label: 'ID у провайдера',
                    children: pi.transactionId ? <Typography.Text copyable>{pi.transactionId}</Typography.Text> : '—',
                  },
                ]}
              />
            </Card>
          )}
        </Space>
      )}

      {t && (
        <PrintDocument
          open={printing}
          onClose={() => setPrinting(false)}
          docType="Транзакция"
          number={t.externalOrderId ?? t.id.slice(0, 8)}
          date={dt(t.createdAt)}
          fields={[
            { label: 'Статус', value: TRANSACTION_STATUS.find((s) => s.value === t.status)?.label ?? t.status },
            { label: 'Сумма', value: money(t.amount, t.orderCurrency ?? 'RUB') },
            { label: 'Провайдер', value: t.provider },
            { label: 'Партнёр', value: t.partner?.name ?? t.partnerId ?? '—' },
            { label: 'Счёт', value: t.invoice?.invoiceNumber ?? '—' },
            { label: 'Внешний ID', value: t.externalOrderId ?? '—', wide: true },
            { label: 'Merchant order', value: t.merchantOrderId ?? '—', wide: true },
            { label: 'Создана', value: dt(t.createdAt) },
            { label: 'Завершена', value: dt(t.completedAt) },
          ]}
          footNote={`Документ сформирован из админ-панели Love&Pay. ID транзакции: ${t.id}`}
        />
      )}
    </Drawer>
  )
}
