import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  Space,
  Row,
  Col,
  Segmented,
  Table,
  Typography,
  Button,
  Tag,
  Divider,
} from 'antd'
import {
  ReloadOutlined,
  RiseOutlined,
  FallOutlined,
  DollarOutlined,
  FileTextOutlined,
  TeamOutlined,
  RollbackOutlined,
  BankOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { action } from '../../api/actions'
import { money, usdt } from '../../lib/format'

const { Text, Title } = Typography

type PartnerRow = {
  name?: string
  grossInvoiceAmount?: number
  platformCommissionAmount?: number
  partnerRevenue?: number
  refundedAmount?: number
  invoiceCount?: number
  totalInvoiceAmountUsdt?: number
}

type Summary = {
  gross: number
  usdtVol: number
  commission: number
  revenue: number
  refunded: number
  invoices: number
  activePartners: number
  top: Array<{ name: string; gross: number; invoices: number; usdt: number }>
}

const num = (v: unknown) => Number(v) || 0

function summarize(partners: PartnerRow[]): Summary {
  const sum = (k: keyof PartnerRow) => partners.reduce((a, p) => a + num(p[k]), 0)
  const active = partners.filter((p) => num(p.invoiceCount) > 0)
  return {
    gross: sum('grossInvoiceAmount'),
    usdtVol: sum('totalInvoiceAmountUsdt'),
    commission: sum('platformCommissionAmount'),
    revenue: sum('partnerRevenue'),
    refunded: sum('refundedAmount'),
    invoices: sum('invoiceCount'),
    activePartners: active.length,
    top: active
      .map((p) => ({
        name: p.name ?? '—',
        gross: num(p.grossInvoiceAmount),
        invoices: num(p.invoiceCount),
        usdt: num(p.totalInvoiceAmountUsdt),
      }))
      .sort((a, b) => b.gross - a.gross)
      .slice(0, 8),
  }
}

// Периоды: текущее окно и равное ему предыдущее — для стрелок динамики.
// finance считает по датам, endDate не включается, поэтому «сутки» — это
// [день, день+1).
type Period = 'today' | 'yesterday' | 'week'

function windows(period: Period) {
  const today = dayjs().startOf('day')
  if (period === 'today') {
    return {
      cur: [today, today.add(1, 'day')],
      prev: [today.subtract(1, 'day'), today],
      label: 'сегодня',
    }
  }
  if (period === 'yesterday') {
    return {
      cur: [today.subtract(1, 'day'), today],
      prev: [today.subtract(2, 'day'), today.subtract(1, 'day')],
      label: 'вчера',
    }
  }
  return {
    cur: [today.subtract(6, 'day'), today.add(1, 'day')],
    prev: [today.subtract(13, 'day'), today.subtract(6, 'day')],
    label: 'за 7 дней',
  }
}

const fmtDate = (d: dayjs.Dayjs) => d.format('YYYY-MM-DD')

async function fetchSummary([from, to]: dayjs.Dayjs[]): Promise<Summary> {
  const data = await action<{ partners?: PartnerRow[] }>(
    `/finance?startDate=${fmtDate(from)}&endDate=${fmtDate(to)}`,
    { method: 'GET' },
  )
  return summarize(data.partners ?? [])
}

/** Стрелка динамики: насколько текущее значение отличается от прошлого периода. */
function Delta({ cur, prev, invert = false }: { cur: number; prev: number; invert?: boolean }) {
  if (!prev && !cur) return null
  if (!prev) return <Tag color="blue" style={{ marginInlineStart: 8 }}>новое</Tag>
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return <Text type="secondary" style={{ fontSize: 12, marginInlineStart: 8 }}>0%</Text>
  const up = pct > 0
  // Для возвратов рост — это плохо, поэтому цвет инвертируется.
  const good = invert ? !up : up
  return (
    <Text
      style={{ fontSize: 12, marginInlineStart: 8, color: good ? '#3f8600' : '#cf1322' }}
    >
      {up ? <RiseOutlined /> : <FallOutlined />} {Math.abs(pct)}%
    </Text>
  )
}

export const Home = () => {
  const [period, setPeriod] = useState<Period>('today')
  const w = windows(period)

  const cur = useQuery({
    queryKey: ['home-finance', 'cur', period],
    queryFn: () => fetchSummary(w.cur),
  })
  const prev = useQuery({
    queryKey: ['home-finance', 'prev', period],
    queryFn: () => fetchSummary(w.prev),
  })

  const s = cur.data
  const p = prev.data
  const loading = cur.isFetching || prev.isFetching

  const refresh = () => {
    cur.refetch()
    prev.refetch()
  }

  const metric = (
    icon: React.ReactNode,
    title: string,
    value: React.ReactNode,
    delta?: React.ReactNode,
  ) => (
    <Card size="small" loading={loading} style={{ height: '100%' }}>
      <Space direction="vertical" size={2} style={{ width: '100%' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {icon} {title}
        </Text>
        <Space align="baseline" size={0} wrap>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em' }}>{value}</span>
          {delta}
        </Space>
      </Space>
    </Card>
  )

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card size="small">
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space direction="vertical" size={0}>
            <Title level={4} style={{ margin: 0 }}>
              Главная
            </Title>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Метрики {w.label}: {w.cur[0].format('DD.MM')}
              {period !== 'yesterday' && period !== 'today' ? ` — ${w.cur[1].subtract(1, 'day').format('DD.MM')}` : ''} · сравнение с прошлым периодом
            </Text>
          </Space>
          <Space>
            <Segmented
              value={period}
              onChange={(v) => setPeriod(v as Period)}
              options={[
                { label: 'Сегодня', value: 'today' },
                { label: 'Вчера', value: 'yesterday' },
                { label: '7 дней', value: 'week' },
              ]}
            />
            <Button icon={<ReloadOutlined />} loading={loading} onClick={refresh}>
              Обновить
            </Button>
          </Space>
        </Space>
      </Card>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={8}>
          {metric(
            <DollarOutlined />,
            'Оборот',
            money(s?.gross),
            <Delta cur={s?.gross ?? 0} prev={p?.gross ?? 0} />,
          )}
        </Col>
        <Col xs={24} sm={12} lg={8}>
          {metric(
            <DollarOutlined />,
            'Оборот в USDT',
            usdt(s?.usdtVol),
            <Delta cur={s?.usdtVol ?? 0} prev={p?.usdtVol ?? 0} />,
          )}
        </Col>
        <Col xs={24} sm={12} lg={8}>
          {metric(
            <FileTextOutlined />,
            'Оплачено счетов',
            new Intl.NumberFormat('ru-RU').format(s?.invoices ?? 0),
            <Delta cur={s?.invoices ?? 0} prev={p?.invoices ?? 0} />,
          )}
        </Col>
        <Col xs={24} sm={12} lg={8}>
          {metric(
            <TeamOutlined />,
            'Активных партнёров',
            new Intl.NumberFormat('ru-RU').format(s?.activePartners ?? 0),
            <Delta cur={s?.activePartners ?? 0} prev={p?.activePartners ?? 0} />,
          )}
        </Col>
        <Col xs={24} sm={12} lg={8}>
          {metric(
            <BankOutlined />,
            'Комиссия платформы',
            money(s?.commission),
            <Delta cur={s?.commission ?? 0} prev={p?.commission ?? 0} />,
          )}
        </Col>
        <Col xs={24} sm={12} lg={8}>
          {metric(
            <RollbackOutlined />,
            'Возвраты',
            money(s?.refunded),
            <Delta cur={s?.refunded ?? 0} prev={p?.refunded ?? 0} invert />,
          )}
        </Col>
      </Row>

      <Card size="small" title={`Топ партнёров · ${w.label}`} loading={loading}>
        {s && s.top.length === 0 ? (
          <Text type="secondary">Нет оплат за период</Text>
        ) : (
          <Table
            dataSource={s?.top ?? []}
            rowKey="name"
            size="small"
            pagination={false}
            scroll={{ x: 520 }}
          >
            <Table.Column
              title="#"
              width={44}
              render={(_: unknown, __: unknown, i: number) => (
                <Text type="secondary">{i + 1}</Text>
              )}
            />
            <Table.Column
              dataIndex="name"
              title="Партнёр"
              render={(v: string) => <Text strong>{v}</Text>}
            />
            <Table.Column
              dataIndex="gross"
              title="Оборот"
              width={170}
              align="right"
              render={(v: number) => <Text strong>{money(v)}</Text>}
            />
            <Table.Column
              dataIndex="usdt"
              title="USDT"
              width={130}
              align="right"
              render={(v: number) => usdt(v)}
            />
            <Table.Column
              dataIndex="invoices"
              title="Счетов"
              width={100}
              align="right"
              render={(v: number) => new Intl.NumberFormat('ru-RU').format(v)}
            />
          </Table>
        )}
        <Divider style={{ margin: '12px 0 8px' }} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Данные из финансовой сводки по всем партнёрам. Оборот и комиссия — в рублях по оплаченным счетам за период.
        </Text>
      </Card>
    </Space>
  )
}
