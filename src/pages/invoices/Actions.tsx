import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Space, Input, InputNumber, Alert, App, Typography, Popconfirm } from 'antd'
import { SyncOutlined, RollbackOutlined } from '@ant-design/icons'
import { DangerConfirm } from '../../components/DangerAction'
import { money } from '../../lib/format'
import { action } from '../../api/actions'

const { Text } = Typography

type SyncResult = { invoiceNumber: string; status: string; changed: boolean; message?: string; errors?: string[] }

/** Синхронизация статуса одного счёта у провайдера. */
export function SyncInvoiceButton({ invoice, onDone }: { invoice: any; onDone: () => void }) {
  const { message } = App.useApp()

  const sync = useMutation({
    mutationFn: () => action<SyncResult>(`/invoices/${invoice.id}/sync`),
    onSuccess: (r) => {
      // Ответ всегда 200: провал провайдера приезжает в errors, а не в статусе.
      if (r.errors?.length) {
        message.warning(`${r.invoiceNumber}: ${r.errors.join('; ')}`, 8)
      } else if (r.changed) {
        message.success(`${r.invoiceNumber}: статус обновлён → ${r.status}`)
      } else {
        message.info(`${r.invoiceNumber}: без изменений (${r.status})`)
      }
      onDone()
    },
    onError: (e: Error) => message.error(e.message),
  })

  return (
    <Button
      size="small"
      icon={<SyncOutlined />}
      title="Спросить статус у провайдера"
      loading={sync.isPending}
      onClick={() => sync.mutate()}
    />
  )
}

/** Ручная отметка возврата — только бухгалтерия, провайдер не вызывается. */
export function MarkRefundedButton({ invoice, onDone }: { invoice: any; onDone: () => void }) {
  const { message } = App.useApp()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [amount, setAmount] = useState<number | null>(null)

  const mark = useMutation({
    mutationFn: () =>
      action(`/invoices/${invoice.id}/mark-refunded`, {
        body: {
          reason: reason || undefined,
          // Сумма уходит в копейках, как её ждёт API.
          amount: amount != null ? Math.round(amount * 100) : undefined,
        },
      }),
    onSuccess: () => {
      setOpen(false)
      setReason('')
      setAmount(null)
      message.success('Счёт отмечен как возвращённый')
      onDone()
    },
    onError: (e: Error) => message.error(e.message),
  })

  if (invoice.status !== 'PAID') return null

  return (
    <>
      <Button
        size="small"
        danger
        icon={<RollbackOutlined />}
        title="Отметить возврат вручную"
        onClick={() => setOpen(true)}
      />
      <DangerConfirm
        open={open}
        title="Отметить возврат вручную?"
        what={`Счёт ${invoice.invoiceNumber} станет REFUNDED в учёте. Деньги при этом НЕ возвращаются — провайдер не вызывается. Используйте, только если возврат уже сделан вне системы.`}
        confirmWord="ОТМЕТИТЬ"
        okText="Отметить возврат"
        loading={mark.isPending}
        onOk={() => mark.mutate()}
        onCancel={() => setOpen(false)}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Alert
            type="info"
            message={
              <span>
                Чтобы вернуть деньги по-настоящему, нужна заявка на возврат и кнопка «Исполнить» в
                разделе «Возвраты».
              </span>
            }
          />
          <div>
            <Text style={{ display: 'block', marginBottom: 4 }}>
              Сумма возврата, ₽ (по умолчанию вся: {money(invoice.amount)})
            </Text>
            <InputNumber
              style={{ width: '100%' }}
              min={0.01}
              max={invoice.amount / 100}
              precision={2}
              value={amount ?? undefined}
              onChange={(v) => setAmount(v ?? null)}
              placeholder={String(invoice.amount / 100)}
            />
          </div>
          <div>
            <Text style={{ display: 'block', marginBottom: 4 }}>Причина</Text>
            <Input.TextArea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Возврат отмечен через Admin API (1C)"
            />
          </div>
        </Space>
      </DangerConfirm>
    </>
  )
}

/** Массовая синхронизация: у бэкенда бюджет ~40 секунд, остаток надо дожимать. */
export function BulkSyncButton({ onDone }: { onDone: () => void }) {
  const { message } = App.useApp()

  const bulk = useMutation({
    mutationFn: () => action<{ results: any }>('/invoices/sync', { body: {} }),
    onSuccess: (r) => {
      const x = r.results ?? {}
      const parts = [
        `проверено ${x.checkedCount ?? 0}`,
        x.paidCount ? `оплачено ${x.paidCount}` : null,
        x.expiredCount ? `просрочено ${x.expiredCount}` : null,
      ].filter(Boolean)
      if (x.timedOut && x.remaining > 0) {
        message.warning(`${parts.join(', ')}. Не успели: осталось ${x.remaining} — запустите ещё раз.`, 10)
      } else {
        message.success(parts.join(', ') || 'Нечего синхронизировать')
      }
      if (x.errors?.length) message.warning(`Ошибок: ${x.errors.length}`, 6)
      onDone()
    },
    onError: (e: Error) => message.error(e.message),
  })

  return (
    <Popconfirm
      title="Синхронизировать счета за сегодня?"
      description={
        <span style={{ maxWidth: 300, display: 'block' }}>
          Статусы PENDING и EXPIRED будут перепроверены у провайдера, зависшие PENDING старше часа —
          помечены просроченными. Занимает до 40 секунд.
        </span>
      }
      okText="Запустить"
      cancelText="Отмена"
      onConfirm={() => bulk.mutate()}
    >
      <Button size="small" icon={<SyncOutlined />} loading={bulk.isPending}>
        Синхронизировать за сегодня
      </Button>
    </Popconfirm>
  )
}
