import { useState } from 'react'
import { Modal, Input, Typography, Alert, Space } from 'antd'

const { Text, Paragraph } = Typography

/**
 * Подтверждение необратимого действия.
 *
 * Обычный «вы уверены?» кликается на автомате, поэтому для действий, которые
 * двигают деньги или уходят клиентам, требуем впечатать слово: это заставляет
 * прочитать, что именно произойдёт.
 */
export function DangerConfirm({
  open,
  title,
  what,
  confirmWord,
  okText,
  loading,
  onOk,
  onCancel,
  children,
}: {
  open: boolean
  title: string
  /** Что случится — прямым текстом, без эвфемизмов. */
  what: string
  /** Слово, которое надо впечатать. Без него — только кнопка. */
  confirmWord?: string
  okText: string
  loading?: boolean
  onOk: () => void
  onCancel: () => void
  children?: React.ReactNode
}) {
  const [typed, setTyped] = useState('')
  const armed = !confirmWord || typed.trim().toUpperCase() === confirmWord.toUpperCase()

  const close = () => {
    setTyped('')
    onCancel()
  }

  return (
    <Modal
      open={open}
      title={title}
      okText={okText}
      cancelText="Отмена"
      okButtonProps={{ danger: true, disabled: !armed, loading }}
      onOk={() => {
        onOk()
        setTyped('')
      }}
      onCancel={close}
      destroyOnHidden
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert type="warning" showIcon message={what} />
        {children}
        {confirmWord && (
          <div>
            <Paragraph style={{ marginBottom: 6 }}>
              Впечатайте <Text code strong>{confirmWord}</Text>, чтобы подтвердить:
            </Paragraph>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmWord}
              autoFocus
            />
          </div>
        )}
      </Space>
    </Modal>
  )
}
