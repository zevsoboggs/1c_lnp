import { Modal, Alert, Input, Typography, Space } from 'antd'

const { Text } = Typography

/**
 * Показ секрета, который API отдаёт ровно один раз (API-секрет партнёра,
 * секрет вебхука). Закрыли окно — значение больше взять неоткуда,
 * только перевыпуск. Поэтому окно закрывается одной явной кнопкой.
 */
export function SecretOnce({
  open,
  title,
  secret,
  hint,
  onClose,
}: {
  open: boolean
  title: string
  secret: string | null
  hint?: string
  onClose: () => void
}) {
  return (
    <Modal
      open={open && !!secret}
      title={title}
      okText="Я сохранил, закрыть"
      onOk={onClose}
      onCancel={onClose}
      cancelButtonProps={{ style: { display: 'none' } }}
      closable={false}
      maskClosable={false}
      width={560}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="warning"
          showIcon
          message="Значение показывается один раз"
          description={hint ?? 'После закрытия окна получить его снова будет нельзя — только перевыпустить.'}
        />
        <Input.TextArea value={secret ?? ''} readOnly autoSize rows={2} />
        <Text copyable={{ text: secret ?? '' }}>Скопировать значение</Text>
      </Space>
    </Modal>
  )
}
