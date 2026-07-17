import { Button, Space, Typography, Tooltip } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

const { Text } = Typography

/** Полоса действий над таблицей — место 1С-шного «Найти / Ещё», но по делу. */
export function Toolbar({
  total,
  loading,
  onRefresh,
  children,
}: {
  total?: number
  loading?: boolean
  onRefresh?: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="onec-toolbar">
      <Space size={8}>
        <Tooltip title="Перечитать с сервера">
          <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
            Обновить
          </Button>
        </Tooltip>
        {children}
        {total != null && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Найдено: {new Intl.NumberFormat('ru-RU').format(total)}
          </Text>
        )}
      </Space>
    </div>
  )
}
