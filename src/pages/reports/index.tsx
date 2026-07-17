import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Card,
  Space,
  Select,
  Button,
  Typography,
  Table,
  Statistic,
  Alert,
  Empty,
  Divider,
  DatePicker,
  Tag,
} from 'antd'
import { BarChartOutlined, FileExcelOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { dt, money } from '../../lib/format'
import { action } from '../../api/actions'
import { exportToExcel, rub, type ExportColumn } from '../../lib/export'

const { Text, Title } = Typography

/** Тип отчёта: как запросить данные и как их показать/выгрузить. */
type ReportDef = {
  key: string
  label: string
  needsPeriod: boolean
  hint: string
}

const REPORTS: ReportDef[] = [
  { key: 'finance', label: 'Финансовая сводка', needsPeriod: true, hint: 'Оборот, комиссия, выручка и возвраты за период' },
  { key: 'transactions', label: 'Реестр транзакций', needsPeriod: true, hint: 'Список всех транзакций партнёра за период' },
  { key: 'invoices', label: 'Реестр счетов', needsPeriod: true, hint: 'Список выставленных счетов за период' },
  { key: 'refunds', label: 'Возвраты', needsPeriod: false, hint: 'Заявки на возврат по партнёру' },
  { key: 'kyc', label: 'KYC-верификации', needsPeriod: true, hint: 'Верификации клиентов партнёра' },
]

type Applied = {
  type: string
  partnerId: string
  partnerName: string
  from: string
  to: string
}

// Каждый отчёт строит свой запрос к admin-api. Партнёр везде — UUID, но имя
// параметра и параметры периода различаются по эндпоинтам.
function buildUrl(a: Applied): string {
  const p = new URLSearchParams()
  switch (a.type) {
    case 'finance':
      p.set('partner', a.partnerId)
      p.set('startDate', a.from)
      p.set('endDate', a.to)
      return `/finance?${p}`
    case 'transactions':
      p.set('partner', a.partnerId)
      p.set('dateFrom', a.from)
      p.set('dateTo', a.to)
      p.set('limit', '500')
      return `/transactions?${p}`
    case 'invoices':
      p.set('partner', a.partnerId)
      p.set('dateFrom', a.from)
      p.set('dateTo', a.to)
      p.set('limit', '500')
      return `/invoices?${p}`
    case 'refunds':
      p.set('partnerId', a.partnerId)
      p.set('limit', '500')
      return `/refund-requests?${p}`
    case 'kyc':
      p.set('partnerId', a.partnerId)
      p.set('dateFrom', a.from)
      p.set('dateTo', a.to)
      p.set('limit', '500')
      return `/kyc-verifications?${p}`
    default:
      return ''
  }
}

export const Reports = () => {
  const [type, setType] = useState('finance')
  const [partnerId, setPartnerId] = useState<string>()
  const [partnerName, setPartnerName] = useState<string>('')
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs()])
  const [applied, setApplied] = useState<Applied | null>(null)

  const def = REPORTS.find((r) => r.key === type)!

  const q = useQuery({
    queryKey: ['report', applied],
    queryFn: () => action<any>(buildUrl(applied!), { method: 'GET' }),
    enabled: !!applied,
    retry: 0,
  })

  const run = () => {
    if (!partnerId) return
    setApplied({
      type,
      partnerId,
      partnerName,
      from: range[0].format('YYYY-MM-DD'),
      to: range[1].format('YYYY-MM-DD'),
    })
  }

  const err = q.error as any
  const noAccess = err?.code === 'NO_ACCESS'

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card title="Отчёты по партнёрам" size="small">
        <Space wrap align="end" size={12}>
          <Field label="Партнёр">
            <PartnerSelect
              value={partnerId}
              onChange={(v, label) => {
                setPartnerId(v)
                setPartnerName(label ?? '')
              }}
              width={260}
            />
          </Field>
          <Field label="Тип отчёта">
            <Select
              style={{ width: 220 }}
              value={type}
              onChange={setType}
              options={REPORTS.map((r) => ({ value: r.key, label: r.label }))}
            />
          </Field>
          {def.needsPeriod && (
            <Field label="Период">
              <DatePicker.RangePicker
                value={range}
                onChange={(v) => v?.[0] && v?.[1] && setRange([v[0], v[1]])}
                format="DD.MM.YYYY"
                allowClear={false}
                style={{ width: 240 }}
              />
            </Field>
          )}
          <Button type="primary" icon={<BarChartOutlined />} disabled={!partnerId} onClick={run}>
            Сформировать
          </Button>
        </Space>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          {def.hint}
        </Text>
      </Card>

      {!applied && <Empty description="Выберите партнёра и тип отчёта" />}

      {applied && noAccess && (
        <Alert
          type="warning"
          showIcon
          message="Нет доступа к данным этого отчёта"
          description="Отчёт использует раздел, закрытый вашей ролью. Обратитесь к администратору за правом на соответствующий раздел."
        />
      )}

      {applied && err && !noAccess && (
        <Alert type="error" showIcon message="Ошибка формирования отчёта" description={err.message} />
      )}

      {applied && !err && (
        <ReportResult applied={applied} data={q.data} loading={q.isFetching} />
      )}
    </Space>
  )
}

// ── Рендер результата по типу ────────────────────────────────────────────────

function ReportResult({
  applied,
  data,
  loading,
}: {
  applied: Applied
  data: any
  loading: boolean
}) {
  const title = `${REPORTS.find((r) => r.key === applied.type)?.label} · ${applied.partnerName || 'партнёр'}`
  const periodLabel = `${dayjs(applied.from).format('DD.MM.YYYY')} — ${dayjs(applied.to).format('DD.MM.YYYY')}`

  // ── Финансовая сводка ───────────────────────────────────────────────────────
  if (applied.type === 'finance') {
    const row = data?.partners?.[0]
    return (
      <Card size="small" loading={loading}>
        <Title level={5} style={{ marginTop: 0 }}>
          {title}
        </Title>
        <Text type="secondary">Период: {periodLabel}</Text>
        <Divider style={{ margin: '12px 0' }} />
        {!row ? (
          <Empty description="Нет данных за период" />
        ) : (
          <Space size={32} wrap>
            <Statistic title="Оборот" value={(row.grossInvoiceAmount ?? 0) / 100} precision={2} suffix="₽" />
            <Statistic title="Оборот, USDT" value={row.totalInvoiceAmountUsdt ?? 0} precision={2} suffix="USDT" />
            <Statistic
              title="Комиссия платформы"
              value={(row.platformCommissionAmount ?? 0) / 100}
              precision={2}
              suffix="₽"
            />
            <Statistic title="Выручка партнёра" value={(row.partnerRevenue ?? 0) / 100} precision={2} suffix="₽" />
            <Statistic
              title="Возвраты"
              value={(row.refundedAmount ?? 0) / 100}
              precision={2}
              suffix="₽"
              valueStyle={{ color: row.refundedAmount ? '#cf1322' : undefined }}
            />
            <Statistic title="Счетов" value={row.invoiceCount ?? 0} />
            <Statistic title="Средний счёт" value={(row.averageInvoice ?? 0) / 100} precision={2} suffix="₽" />
          </Space>
        )}
      </Card>
    )
  }

  // ── Табличные отчёты ─────────────────────────────────────────────────────────
  const configs: Record<
    string,
    { rows: any[]; columns: { title: string; key: string; render: (r: any) => any; width?: number }[]; exportCols: ExportColumn<any>[] }
  > = {
    transactions: {
      rows: data?.transactions ?? [],
      columns: [
        { title: 'Дата', key: 'c', render: (r) => dt(r.createdAt), width: 150 },
        { title: 'Статус', key: 's', render: (r) => r.status, width: 130 },
        { title: 'Сумма', key: 'a', render: (r) => money(r.amount, r.orderCurrency ?? 'RUB'), width: 130 },
        { title: 'Провайдер', key: 'p', render: (r) => r.provider, width: 110 },
        { title: 'Инвойс', key: 'i', render: (r) => r.invoice?.invoiceNumber ?? '—', width: 160 },
        { title: 'Внешний ID', key: 'e', render: (r) => r.externalOrderId ?? '—' },
      ],
      exportCols: [
        { title: 'Дата', value: (r) => dt(r.createdAt) },
        { title: 'Статус', value: (r) => r.status },
        { title: 'Сумма, ₽', value: (r) => rub(r.amount) },
        { title: 'Валюта', value: (r) => r.orderCurrency ?? '' },
        { title: 'Провайдер', value: (r) => r.provider ?? '' },
        { title: 'Инвойс', value: (r) => r.invoice?.invoiceNumber ?? '' },
        { title: 'Внешний ID', value: (r) => r.externalOrderId ?? '' },
      ],
    },
    invoices: {
      rows: data?.invoices ?? [],
      columns: [
        { title: 'Создан', key: 'c', render: (r) => dt(r.createdAt), width: 150 },
        { title: 'Номер', key: 'n', render: (r) => r.invoiceNumber, width: 160 },
        { title: 'Статус', key: 's', render: (r) => r.status, width: 120 },
        { title: 'Сумма', key: 'a', render: (r) => money(r.amount, r.currency ?? 'RUB'), width: 130 },
        { title: 'Клиент', key: 'cl', render: (r) => r.customerName ?? r.customerEmail ?? '—' },
        { title: 'Оплачен', key: 'p', render: (r) => dt(r.paidAt), width: 150 },
      ],
      exportCols: [
        { title: 'Создан', value: (r) => dt(r.createdAt) },
        { title: 'Номер', value: (r) => r.invoiceNumber ?? '' },
        { title: 'Статус', value: (r) => r.status },
        { title: 'Сумма, ₽', value: (r) => rub(r.amount) },
        { title: 'Валюта', value: (r) => r.currency ?? '' },
        { title: 'Клиент', value: (r) => r.customerName ?? '' },
        { title: 'Email', value: (r) => r.customerEmail ?? '' },
        { title: 'Оплачен', value: (r) => (r.paidAt ? dt(r.paidAt) : '') },
      ],
    },
    refunds: {
      rows: data?.refundRequests ?? [],
      columns: [
        { title: 'Создан', key: 'c', render: (r) => dt(r.createdAt), width: 150 },
        { title: 'Статус', key: 's', render: (r) => r.status, width: 130 },
        { title: 'Сумма', key: 'a', render: (r) => money(r.amount), width: 130 },
        { title: 'Инвойс', key: 'i', render: (r) => r.invoice?.invoiceNumber ?? r.invoiceId ?? '—' },
        { title: 'Причина', key: 'r', render: (r) => r.reason ?? '—' },
      ],
      exportCols: [
        { title: 'Создан', value: (r) => dt(r.createdAt) },
        { title: 'Статус', value: (r) => r.status },
        { title: 'Сумма, ₽', value: (r) => rub(r.amount) },
        { title: 'Инвойс', value: (r) => r.invoice?.invoiceNumber ?? '' },
        { title: 'Причина', value: (r) => r.reason ?? '' },
      ],
    },
    kyc: {
      rows: data?.verifications ?? [],
      columns: [
        { title: 'Создана', key: 'c', render: (r) => dt(r.createdAt), width: 150 },
        { title: 'Статус', key: 's', render: (r) => <Tag>{r.status}</Tag>, width: 120 },
        { title: 'Клиент', key: 'n', render: (r) => r.customerName ?? [r.firstName, r.lastName].filter(Boolean).join(' ') ?? '—' },
        { title: 'Документ', key: 'd', render: (r) => r.documentType ?? '—', width: 150 },
        { title: 'Провайдер', key: 'p', render: (r) => r.provider ?? '—', width: 110 },
        { title: 'Проверена', key: 'v', render: (r) => dt(r.verifiedAt), width: 150 },
      ],
      exportCols: [
        { title: 'Создана', value: (r) => dt(r.createdAt) },
        { title: 'Статус', value: (r) => r.status },
        { title: 'Клиент', value: (r) => r.customerName ?? [r.firstName, r.lastName].filter(Boolean).join(' ') },
        { title: 'Документ', value: (r) => r.documentType ?? '' },
        { title: 'Номер документа', value: (r) => r.documentNumber ?? '' },
        { title: 'Провайдер', value: (r) => r.provider ?? '' },
        { title: 'Проверена', value: (r) => (r.verifiedAt ? dt(r.verifiedAt) : '') },
      ],
    },
  }

  const cfg = configs[applied.type]
  if (!cfg) return null

  // Отчёт тянет максимум 500 записей за раз. Если в периоде больше — честно
  // показываем, что список обрезан, иначе оператор решит, что видит всё.
  const total: number | undefined = data?.pagination?.total
  const capped = typeof total === 'number' && total > cfg.rows.length

  const doExport = () =>
    exportToExcel(
      cfg.rows,
      cfg.exportCols,
      `Отчёт_${REPORTS.find((r) => r.key === applied.type)?.label ?? applied.type}_${applied.partnerName || ''}`.replace(
        /\s+/g,
        '_',
      ),
    )

  return (
    <Card
      size="small"
      loading={loading}
      title={
        <Space direction="vertical" size={0}>
          <Text strong>{title}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {REPORTS.find((r) => r.key === applied.type)?.needsPeriod ? `Период: ${periodLabel} · ` : ''}
            Записей: {cfg.rows.length}
          </Text>
        </Space>
      }
      extra={
        <Button
          size="small"
          icon={<FileExcelOutlined />}
          disabled={!cfg.rows.length}
          onClick={doExport}
        >
          В Excel
        </Button>
      }
    >
      {capped && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={`Показаны первые ${cfg.rows.length} из ${total} записей`}
          description="Отчёт ограничен 500 строками за раз. Сузьте период, чтобы увидеть и выгрузить все данные."
        />
      )}
      <Table
        dataSource={cfg.rows}
        rowKey={(r: any, i) => r.id ?? String(i)}
        size="small"
        pagination={{ pageSize: 20 }}
        scroll={{ x: 1000 }}
        locale={{ emptyText: 'Нет данных за период' }}
      >
        {cfg.columns.map((c) => (
          <Table.Column key={c.key} title={c.title} width={c.width} render={(_: unknown, r: any) => c.render(r)} />
        ))}
      </Table>
    </Card>
  )
}
