import { Select, Tooltip, Typography } from 'antd'
import { GlobalOutlined } from '@ant-design/icons'
import {
  TIMEZONES,
  setTimezoneOffset,
  timezoneLabel,
  useTimezoneOffset,
  type TimezoneOffset,
} from '../lib/timezone'

const { Text } = Typography

/**
 * Выбор часового пояса для всех дат панели.
 *
 * В базе время хранится в UTC, и до этого переключателя каждый видел даты
 * в поясе своего браузера: у оператора в Екатеринбурге оплата 12:42 по
 * Москве выглядела как 14:42, и сверка с выпиской не сходилась. Теперь пояс
 * выбирается явно и запоминается на этом рабочем месте.
 *
 * compact — для шапки телефона: там подпись не помещается, остаётся только
 * значение вида «UTC+3».
 */
export function TimezonePicker({ compact = false }: { compact?: boolean } = {}) {
  const offset = useTimezoneOffset()

  const select = (
    <Select<TimezoneOffset>
      size="small"
      value={offset}
      onChange={setTimezoneOffset}
      style={{ width: compact ? 88 : 190 }}
      variant={compact ? 'borderless' : 'outlined'}
      popupMatchSelectWidth={210}
      options={TIMEZONES.map((value) => ({
        value,
        label: compact ? `UTC+${value}` : timezoneLabel(value),
        title: timezoneLabel(value),
      }))}
    />
  )

  if (compact) {
    return <Tooltip title={`Часовой пояс дат: ${timezoneLabel(offset)}`}>{select}</Tooltip>
  }

  return (
    <div className="onec-tz">
      <Text type="secondary" style={{ fontSize: 12 }}>
        <GlobalOutlined /> Часовой пояс дат
      </Text>
      {select}
    </div>
  )
}
