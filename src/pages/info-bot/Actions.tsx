import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button, Space, Input, Select, Alert, Typography, App, Card } from 'antd'
import { SoundOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { DangerConfirm } from '../../components/DangerAction'
import { TERMINAL_PROVIDERS, options } from '../../lib/apiEnums'
import { action } from '../../api/actions'

const { Text, Paragraph } = Typography

const MAX_TEXT = 3500

export function InfoBotActions({
  statusCount,
  incidentCount,
  onDone,
}: {
  statusCount: number
  incidentCount: number
  onDone: () => void
}) {
  const { message } = App.useApp()
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [text, setText] = useState('')
  const [incidentOpen, setIncidentOpen] = useState<'open' | 'resolve' | null>(null)
  const [provider, setProvider] = useState<string>('KANYON')
  const [reason, setReason] = useState('')

  const broadcast = useMutation({
    mutationFn: () => action<{ sent: number; failed: number }>('/info-bot/broadcast', { body: { text } }),
    onSuccess: (r) => {
      setBroadcastOpen(false)
      setText('')
      // BOT_TOKEN не задан → бэкенд молча вернёт нули вместо ошибки.
      if (r.sent === 0 && r.failed === 0) {
        message.warning('Никому не отправлено: нет подписчиков со статус-уведомлениями или не настроен бот')
      } else {
        message.success(`Отправлено: ${r.sent}${r.failed ? `, не доставлено: ${r.failed}` : ''}`)
      }
      onDone()
    },
    onError: (e: Error) => message.error(e.message),
  })

  const incident = useMutation({
    mutationFn: (act: 'open' | 'resolve') =>
      action<{ alreadyOpen?: boolean; resolved?: boolean; notified: { sent: number; failed: number } }>(
        '/info-bot/incident',
        { body: { provider, action: act, ...(act === 'open' ? { reason } : {}) } },
      ),
    onSuccess: (r, act) => {
      setIncidentOpen(null)
      setReason('')
      if (act === 'open' && r.alreadyOpen) {
        message.warning('Инцидент по этому провайдеру уже открыт — причина обновлена, повторных сообщений не было')
      } else if (act === 'resolve' && r.resolved === false) {
        message.warning('Открытых инцидентов по этому провайдеру не было — ничего не отправлено')
      } else {
        message.success(`Готово · оповещено: ${r.notified?.sent ?? 0}`)
      }
      onDone()
    },
    onError: (e: Error) => message.error(e.message),
  })

  return (
    <>
      <Space wrap>
        <Button icon={<SoundOutlined />} onClick={() => setBroadcastOpen(true)}>
          Рассылка
        </Button>
        <Button danger icon={<WarningOutlined />} onClick={() => setIncidentOpen('open')}>
          Открыть инцидент
        </Button>
        <Button icon={<CheckCircleOutlined />} onClick={() => setIncidentOpen('resolve')}>
          Закрыть инцидент
        </Button>
      </Space>

      <DangerConfirm
        open={broadcastOpen}
        title="Разослать сообщение клиентам?"
        what={`Сообщение уйдёт в Telegram всем ${statusCount} активным подписчикам со статус-уведомлениями. Отменить или удалить отправленное через это API нельзя.`}
        confirmWord="РАЗОСЛАТЬ"
        okText="Разослать"
        loading={broadcast.isPending}
        onOk={() => broadcast.mutate()}
        onCancel={() => setBroadcastOpen(false)}
      >
        <div>
          <Paragraph style={{ marginBottom: 6 }}>Текст сообщения:</Paragraph>
          <Input.TextArea
            rows={5}
            value={text}
            maxLength={MAX_TEXT}
            showCount
            onChange={(e) => setText(e.target.value)}
            placeholder="Что сообщить клиентам"
          />
        </div>
        <Card size="small" title="Так это увидит клиент" style={{ background: '#fafafa' }}>
          <Text strong>📢 Love&Pay</Text>
          <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0, marginTop: 8 }}>
            {text || <Text type="secondary">…</Text>}
          </Paragraph>
        </Card>
        {/* Бэкенд экранирует HTML, теги придут текстом — предупреждаем заранее. */}
        {/<[a-z][\s\S]*>/i.test(text) && (
          <Alert
            type="info"
            showIcon
            message="HTML-теги отправятся как обычный текст — форматирование не применится."
          />
        )}
      </DangerConfirm>

      <DangerConfirm
        open={incidentOpen === 'open'}
        title="Открыть инцидент провайдера?"
        what={`Всем ${incidentCount} подписчикам с уведомлениями об инцидентах уйдёт сообщение о проблемах с приёмом платежей.`}
        confirmWord="ОТКРЫТЬ"
        okText="Открыть инцидент"
        loading={incident.isPending}
        onOk={() => incident.mutate('open')}
        onCancel={() => {
          setIncidentOpen(null)
          setReason('')
        }}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <div>
            <Paragraph style={{ marginBottom: 4 }}>Провайдер:</Paragraph>
            <Select
              style={{ width: '100%' }}
              value={provider}
              onChange={setProvider}
              options={options(TERMINAL_PROVIDERS)}
            />
          </div>
          <div>
            <Paragraph style={{ marginBottom: 4 }}>Причина (обязательно):</Paragraph>
            <Input.TextArea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Например: провайдер не отвечает"
            />
          </div>
          {/* Важное расхождение: текст клиентам захардкожен на бэкенде. */}
          <Alert
            type="info"
            showIcon
            message="Провайдер и причина клиентам не показываются"
            description="Они видят только общий текст «Временные проблемы с приёмом платежей». Эти поля идут в базу и аудит — для вас."
          />
          <Card size="small" title="Так это увидит клиент" style={{ background: '#fafafa' }}>
            <Text strong>🔴 Временные проблемы с приёмом платежей</Text>
            <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
              Часть платежей по СБП может проходить с задержкой или не создаваться. Мы уже устраняем
              проблему…
            </Paragraph>
          </Card>
        </Space>
      </DangerConfirm>

      <DangerConfirm
        open={incidentOpen === 'resolve'}
        title="Закрыть инцидент?"
        what={`Подписчикам уйдёт сообщение, что приём платежей восстановлен. Счётчик ошибок провайдера обнулится.`}
        okText="Закрыть инцидент"
        loading={incident.isPending}
        onOk={() => incident.mutate('resolve')}
        onCancel={() => setIncidentOpen(null)}
      >
        <div>
          <Paragraph style={{ marginBottom: 4 }}>Провайдер:</Paragraph>
          <Select
            style={{ width: '100%' }}
            value={provider}
            onChange={setProvider}
            options={options(TERMINAL_PROVIDERS)}
          />
        </div>
      </DangerConfirm>
    </>
  )
}
