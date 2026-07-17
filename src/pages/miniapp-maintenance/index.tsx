import { useEffect, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Card, Space, Typography, Input, Button, Switch, Alert, Tag, App, Divider } from 'antd'
import { ToolOutlined, EyeOutlined } from '@ant-design/icons'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { DangerConfirm } from '../../components/DangerAction'
import { canWrite } from '../../api/accessControl'

const { Text, Paragraph } = Typography

type Notice = { active: boolean; title: string; message: string; buttonText: string }

async function get(): Promise<Notice> {
  const r = await fetch('/api/miniapp/maintenance')
  const b = await r.json()
  if (!r.ok || b?.success === false) throw new Error(b?.error ?? 'Ошибка')
  return b.notice
}

async function save(v: Partial<Notice>) {
  const r = await fetch('/api/miniapp/maintenance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v),
  })
  const b = await r.json()
  if (!r.ok || b?.success === false) throw new Error(b?.error ?? 'Не удалось сохранить')
  return b
}

export const MiniappMaintenance = () => {
  const { message } = App.useApp()
  const editable = canWrite('miniapp-maintenance')

  const q = useQuery({ queryKey: ['maintenance'], queryFn: get })

  const [draft, setDraft] = useState<Notice | null>(null)
  const [confirm, setConfirm] = useState<'on' | 'off' | null>(null)

  // Подтягиваем текущее состояние в форму, но не затираем правки оператора.
  useEffect(() => {
    if (q.data && !draft) setDraft(q.data)
  }, [q.data, draft])

  const mut = useMutation({
    mutationFn: (v: Partial<Notice>) => save(v),
    onSuccess: async (_r, v) => {
      setConfirm(null)
      const on = v.active
      message.success(
        on === true
          ? 'Режим техработ включён — пользователи увидят уведомление'
          : on === false
            ? 'Режим техработ выключен'
            : 'Текст сохранён',
      )
      const fresh = await q.refetch()
      if (fresh.data) setDraft(fresh.data)
    },
    onError: (e: Error) => {
      setConfirm(null)
      message.error(e.message, 6)
    },
  })

  const cur = q.data
  const d = draft ?? cur

  const textChanged =
    !!cur &&
    !!draft &&
    (draft.title !== cur.title ||
      draft.message !== cur.message ||
      draft.buttonText !== cur.buttonText)

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card title="Режим техработ в мини-аппе" size="small">
        <Toolbar loading={q.isFetching} onRefresh={() => q.refetch()} />

        {/* Важно не создать иллюзию, что тумблер кладёт приложение. */}
        <Alert
          type="info"
          showIcon
          style={{ margin: '12px 0' }}
          message="Это уведомление, а не блокировка"
          description="При включении пользователи увидят окно с этим текстом при открытии мини-аппа. Приложение продолжает работать: платежи, карты и всё остальное доступны как обычно."
        />

        <Space size={16} align="center" style={{ marginBottom: 4 }}>
          <Tag
            color={cur?.active ? 'error' : 'success'}
            style={{ fontSize: 13, padding: '4px 12px' }}
          >
            {cur?.active ? '● Уведомление показывается' : '○ Выключено'}
          </Tag>
          {editable && (
            <Switch
              checked={!!cur?.active}
              loading={mut.isPending}
              onChange={(on) => setConfirm(on ? 'on' : 'off')}
              checkedChildren={<ToolOutlined />}
            />
          )}
        </Space>
      </Card>

      <Space align="start" size={16} wrap style={{ width: '100%' }}>
        <Card title="Текст уведомления" size="small" style={{ width: 460 }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Field label="Заголовок">
              <Input
                value={d?.title ?? ''}
                disabled={!editable}
                onChange={(e) => setDraft((p) => ({ ...(p ?? cur!), title: e.target.value }))}
              />
            </Field>
            <Field label="Текст">
              <Input.TextArea
                rows={5}
                value={d?.message ?? ''}
                disabled={!editable}
                onChange={(e) => setDraft((p) => ({ ...(p ?? cur!), message: e.target.value }))}
                showCount
              />
            </Field>
            <Field label="Кнопка">
              <Input
                style={{ width: 200 }}
                value={d?.buttonText ?? ''}
                disabled={!editable}
                onChange={(e) => setDraft((p) => ({ ...(p ?? cur!), buttonText: e.target.value }))}
              />
            </Field>

            {editable && (
              <Space>
                <Button
                  type="primary"
                  disabled={!textChanged}
                  loading={mut.isPending}
                  onClick={() =>
                    mut.mutate({
                      title: draft!.title,
                      message: draft!.message,
                      buttonText: draft!.buttonText,
                    })
                  }
                >
                  Сохранить текст
                </Button>
                {textChanged && (
                  <Button onClick={() => setDraft(cur ?? null)}>Отменить правки</Button>
                )}
              </Space>
            )}

            {textChanged && cur?.active && (
              <Alert
                type="warning"
                showIcon
                message="Уведомление сейчас показывается — правки увидят сразу после сохранения"
              />
            )}
          </Space>
        </Card>

        <Card
          title={
            <Space size={6}>
              <EyeOutlined />
              <span>Как увидит пользователь</span>
            </Space>
          }
          size="small"
          style={{ width: 340 }}
        >
          {/* Примерный вид окна в мини-аппе: заголовок, текст, одна кнопка. */}
          <div
            style={{
              background: '#f5f5f5',
              padding: 20,
              borderRadius: 8,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: '20px 18px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              }}
            >
              <div style={{ fontSize: 30, marginBottom: 8 }}>🛠</div>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                {d?.title || <Text type="secondary">Заголовок</Text>}
              </div>
              <Paragraph
                style={{ fontSize: 13, color: '#595959', marginBottom: 16, whiteSpace: 'pre-wrap' }}
              >
                {d?.message || '…'}
              </Paragraph>
              <div
                style={{
                  background: '#E4002B',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '9px 0',
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {d?.buttonText || 'Понятно'}
              </div>
            </div>
          </div>

          <Divider style={{ margin: '12px 0' }} />
          <Text type="secondary" style={{ fontSize: 11 }}>
            Вид приблизительный — точная вёрстка задаётся самим мини-аппом.
          </Text>
        </Card>
      </Space>

      <DangerConfirm
        open={confirm === 'on'}
        title="Включить режим техработ?"
        what="Все пользователи при открытии мини-аппа увидят это уведомление. Приложение при этом продолжит работать."
        okText="Включить"
        loading={mut.isPending}
        onOk={() =>
          mut.mutate({
            active: true,
            title: draft?.title,
            message: draft?.message,
            buttonText: draft?.buttonText,
          })
        }
        onCancel={() => setConfirm(null)}
      >
        <Card size="small" style={{ background: '#fafafa' }}>
          <Text strong>{d?.title}</Text>
          <Paragraph style={{ marginBottom: 0, marginTop: 6, fontSize: 13 }}>{d?.message}</Paragraph>
        </Card>
      </DangerConfirm>

      <DangerConfirm
        open={confirm === 'off'}
        title="Выключить режим техработ?"
        what="Уведомление перестанет показываться при открытии мини-аппа."
        okText="Выключить"
        loading={mut.isPending}
        onOk={() => mut.mutate({ active: false })}
        onCancel={() => setConfirm(null)}
      />
    </Space>
  )
}
