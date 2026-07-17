import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Card,
  Space,
  Typography,
  Input,
  Select,
  Button,
  App,
  Table,
  Tag,
  Progress,
  Alert,
  Upload,
  Image,
  Statistic,
} from 'antd'
import { SoundOutlined, PictureOutlined, DeleteOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd'
import { dt } from '../../lib/format'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { DangerConfirm } from '../../components/DangerAction'
import { broadcasts, AUDIENCES, type Broadcast } from '../../api/miniappUsers'
import { useRowMenu } from '../../components/useRowMenu'

const { Text, Paragraph } = Typography

export const MiniappBroadcast = () => {
  const { message: msg } = App.useApp()
  const [text, setText] = useState('')
  const [audience, setAudience] = useState('all')
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [running, setRunning] = useState<string | null>(null)

  const history = useQuery({
    queryKey: ['broadcast-history'],
    queryFn: broadcasts.history,
    // Пока рассылка идёт, состояние меняется — опрашиваем чаще.
    refetchInterval: running ? 2000 : false,
  })

  const live = useQuery({
    queryKey: ['broadcast-status', running],
    queryFn: () => broadcasts.status(running!),
    enabled: !!running,
    refetchInterval: 2000,
  })

  const start = useMutation({
    mutationFn: () => broadcasts.start({ message: text, audience, photo }),
    onSuccess: (r) => {
      setConfirm(false)
      setRunning(r.broadcastId)
      msg.success(`Рассылка запущена: ${r.total} получателей`)
      history.refetch()
    },
    onError: (e: Error) => msg.error(e.message, 8),
  })

  const cur = live.data
  const done = cur ? cur.sent + cur.blocked + cur.failed : 0
  const pct = cur?.total ? Math.round((done / cur.total) * 100) : 0

  // Рассылка закончилась — через пару секунд перестаём опрашивать статус,
  // оставив результат на экране.
  useEffect(() => {
    if (cur?.status !== 'completed' || !running) return
    const t = setTimeout(() => setRunning(null), 3000)
    return () => clearTimeout(t)
  }, [cur?.status, running])

  const clearPhoto = () => {
    setPhoto(null)
    setPreview(null)
  }

  const { onRow, menu } = useRowMenu<Broadcast>((r) => [
    r.message && {
      key: 'reuse',
      label: 'Подставить этот текст',
      onClick: () => setText(r.message),
    },
    r.message && {
      key: 'copy',
      label: 'Копировать текст',
      onClick: () => navigator.clipboard.writeText(r.message),
    },
    r.status !== 'completed' && {
      key: 'watch',
      label: 'Следить за прогрессом',
      onClick: () => setRunning(r.id),
    },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}
      <Card title="Рассылка в мини-апп" size="small">
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="Сообщение уходит в Telegram реальным пользователям"
          description="Отменить отправленное нельзя — у API мини-аппа нет ни отмены, ни удаления рассылки."
        />

        <Space align="start" size={16} wrap>
          <Space direction="vertical" size={12} style={{ width: 420 }}>
            <Field label="Аудитория">
              <Select
                style={{ width: '100%' }}
                value={audience}
                onChange={setAudience}
                options={AUDIENCES}
              />
            </Field>

            <Field label="Текст (поддерживается HTML: <b>, <i>, <a>)">
              <Input.TextArea
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Что сообщить пользователям"
                showCount
              />
            </Field>

            <Field label="Картинка (необязательно)">
              <Space>
                <Upload
                  accept="image/*"
                  maxCount={1}
                  showUploadList={false}
                  beforeUpload={(file) => {
                    setPhoto(file)
                    setPreview(URL.createObjectURL(file))
                    return false // не загружаем сами — отправим вместе с рассылкой
                  }}
                  fileList={[] as UploadFile[]}
                >
                  <Button icon={<PictureOutlined />}>Выбрать фото</Button>
                </Upload>
                {photo && (
                  <Button size="small" icon={<DeleteOutlined />} onClick={clearPhoto}>
                    Убрать
                  </Button>
                )}
              </Space>
            </Field>

            <Button
              type="primary"
              danger
              icon={<SoundOutlined />}
              disabled={!text.trim() || !!running}
              onClick={() => setConfirm(true)}
            >
              Разослать
            </Button>
          </Space>

          <Card size="small" title="Как увидит пользователь" style={{ width: 340, background: '#fafafa' }}>
            {preview && (
              <Image src={preview} style={{ maxWidth: '100%', marginBottom: 8, borderRadius: 4 }} />
            )}
            {/* Апстрим шлёт с parse_mode: HTML, поэтому теги реально применятся. */}
            <div
              style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}
              dangerouslySetInnerHTML={{ __html: text || '<i style="color:#999">…</i>' }}
            />
          </Card>
        </Space>
      </Card>

      {cur && (
        <Card size="small" title={`Идёт рассылка · ${cur.status === 'completed' ? 'завершена' : 'выполняется'}`}>
          <Progress
            percent={pct}
            status={cur.status === 'completed' ? 'success' : 'active'}
            format={() => `${done} / ${cur.total}`}
          />
          <Space size={32} wrap style={{ marginTop: 12 }}>
            <Statistic title="Доставлено" value={cur.sent} valueStyle={{ color: '#389e0d' }} />
            <Statistic
              title="Заблокировали бота"
              value={cur.blocked}
              valueStyle={{ color: '#d46b08' }}
            />
            <Statistic
              title="Ошибок"
              value={cur.failed}
              valueStyle={{ color: cur.failed ? '#cf1322' : undefined }}
            />
          </Space>
        </Card>
      )}

      <Card size="small" title="История рассылок">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="История живёт в памяти процесса мини-аппа"
          description="После его перезапуска список очищается, и хранится максимум 20 последних рассылок. Сейчас он пуст не потому, что рассылок не было."
        />
        <Toolbar
          total={history.data?.broadcasts?.length}
          loading={history.isFetching}
          onRefresh={() => history.refetch()}
        />
        <Table
          dataSource={history.data?.broadcasts ?? []}
          loading={history.isFetching}
          rowKey="id"
          size="small"
          pagination={false}
          scroll={{ x: 800 }}
          onRow={onRow}
        >
          <Table.Column dataIndex="createdAt" title="Когда" width={140} render={(v: string) => dt(v)} />
          <Table.Column
            dataIndex="status"
            title="Статус"
            width={120}
            render={(v: string) => (
              <Tag color={v === 'completed' ? 'success' : 'processing'}>
                {v === 'completed' ? 'Завершена' : 'Идёт'}
              </Tag>
            )}
          />
          <Table.Column
            title="Прогресс"
            width={170}
            render={(_: unknown, r: Broadcast) => (
              <Progress
                percent={r.total ? Math.round(((r.sent + r.blocked + r.failed) / r.total) * 100) : 0}
                size="small"
                status={r.status === 'completed' ? 'success' : 'active'}
              />
            )}
          />
          <Table.Column
            dataIndex="sent"
            title="Доставлено"
            width={110}
            align="right"
            render={(v: number) => <Text style={{ color: '#389e0d' }}>{v}</Text>}
          />
          <Table.Column
            dataIndex="blocked"
            title="Заблокировали"
            width={130}
            align="right"
            render={(v: number) => (v ? <Text type="warning">{v}</Text> : '—')}
          />
          <Table.Column
            dataIndex="failed"
            title="Ошибки"
            width={90}
            align="right"
            render={(v: number) => (v ? <Text type="danger">{v}</Text> : '—')}
          />
          <Table.Column
            dataIndex="message"
            title="Текст"
            ellipsis
            render={(v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>}
          />
        </Table>
      </Card>

      <DangerConfirm
        open={confirm}
        title="Разослать сообщение?"
        what={`Сообщение уйдёт в Telegram всем, кто попадает в выборку «${AUDIENCES.find((a) => a.value === audience)?.label}». Отменить отправку нельзя.`}
        confirmWord="РАЗОСЛАТЬ"
        okText="Разослать"
        loading={start.isPending}
        onOk={() => start.mutate()}
        onCancel={() => setConfirm(false)}
      >
        <Card size="small" title="Будет отправлено" style={{ background: '#fafafa' }}>
          {preview && <Image src={preview} style={{ maxWidth: '100%', marginBottom: 8 }} />}
          <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0, fontSize: 13 }}>
            {text}
          </Paragraph>
        </Card>
      </DangerConfirm>
    </Space>
  )
}
