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
  { key: 'payers', label: 'Повторные плательщики', needsPeriod: true, hint: 'Сколько раз каждый плательщик платил за период — кто платил несколько раз, вверху. Партнёра можно не выбирать — тогда отчёт по всем партнёрам сразу, с колонкой «у скольких партнёров платил».' },
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

/** Запрос к своему бэкенду (не к admin-api через прокси). */
async function fetchBackend<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' } })
  const body = await res.json().catch(() => null)
  if (!res.ok || body?.success === false) throw new Error(body?.error ?? `Ошибка ${res.status}`)
  return body as T
}

/**
 * Загрузка данных отчёта.
 *
 * «Повторные плательщики» идут в отдельный эндпоинт /api/repeat-payers: он
 * считает плательщиков по ЖИВЫМ транзакциям, а не по payer-audit (тот в этом
 * окружении заморожен на 01.07 и свежих платежей не отдаёт). Границы — from/to,
 * to берём +сутки, иначе последний день выпадает.
 */
async function runReport(a: Applied) {
  if (a.type === 'payers') {
    const p = new URLSearchParams()
    if (a.partnerId) p.set('partnerId', a.partnerId)
    p.set('from', a.from)
    p.set('to', dayjs(a.to).add(1, 'day').format('YYYY-MM-DD'))
    return fetchBackend<any>(`/api/repeat-payers?${p}`)
  }
  return action<any>(buildUrl(a), { method: 'GET' })
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
    queryFn: () => runReport(applied!),
    enabled: !!applied,
    retry: 0,
  })

  // «Повторные плательщики» умеют работать по всем партнёрам сразу — тогда
  // партнёра можно не выбирать. Остальным отчётам партнёр обязателен.
  const allPartnersOk = type === 'payers'

  const run = () => {
    if (!partnerId && !allPartnersOk) return
    setApplied({
      type,
      partnerId: partnerId ?? '',
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
          <Button
            type="primary"
            icon={<BarChartOutlined />}
            disabled={!partnerId && !allPartnersOk}
            onClick={run}
          >
            Сформировать
          </Button>
        </Space>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8 }}>
          {def.hint}
        </Text>
      </Card>

      {!applied && (
        <Empty
          description={
            allPartnersOk
              ? 'Выберите тип отчёта. Партнёра можно не выбирать — тогда по всем сразу'
              : 'Выберите партнёра и тип отчёта'
          }
        />
      )}

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
  const title = `${REPORTS.find((r) => r.key === applied.type)?.label} · ${applied.partnerName || 'все партнёры'}`
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

  // ── Повторные плательщики ───────────────────────────────────────────────────
  if (applied.type === 'payers') {
    const items: any[] = data?.items ?? []
    // Режим «все партнёры»: партнёра не выбрали — считаем ещё и у скольких
    // разных партнёров платил каждый (кросс-партнёрское дробление — сильный сигнал).
    const allPartners = !applied.partnerId
    // Группируем по плательщику. Ключ — телефон, если есть (он уникальнее
    // сокращённого ФИО «М Игорь Александрович»); иначе по имени.
    type PayerRow = {
      name: string
      phone: string
      count: number
      sum: number
      invoices: string[]
      partners: Set<string>
    }
    const map = new Map<string, PayerRow>()
    for (const it of items) {
      const name = it.actualName
      if (!name) continue
      const key = it.actualPhone || name
      const cur = map.get(key)
      if (cur) {
        cur.count++
        cur.sum += Number(it.amount || 0)
        cur.invoices.push(it.invoiceNumber)
        if (it.partnerName) cur.partners.add(it.partnerName)
      } else {
        map.set(key, {
          name,
          phone: it.actualPhone ?? '',
          count: 1,
          sum: Number(it.amount || 0),
          invoices: [it.invoiceNumber],
          partners: new Set(it.partnerName ? [it.partnerName] : []),
        })
      }
    }
    // По всем партнёрам вперёд выносим кросс-партнёрских — они важнее всего.
    const payers = [...map.values()].sort(
      (a, b) =>
        (allPartners ? b.partners.size - a.partners.size : 0) || b.count - a.count || b.sum - a.sum,
    )
    const repeat = payers.filter((p) => p.count > 1)
    const crossPartner = payers.filter((p) => p.partners.size > 1)
    // Сервер выставляет capped, если упёрся в потолок и охватил не все транзакции.
    const totalCapped = !!data?.capped

    return (
      <Card
        size="small"
        loading={loading}
        title={
          <Space direction="vertical" size={0}>
            <Text strong>{title}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Период: {periodLabel}
            </Text>
          </Space>
        }
        extra={
          <Button
            size="small"
            icon={<FileExcelOutlined />}
            disabled={!payers.length}
            onClick={() =>
              exportToExcel(
                payers,
                [
                  { title: 'Плательщик', value: (p) => p.name },
                  { title: 'Телефон', value: (p) => p.phone },
                  { title: 'Платежей', value: (p) => p.count },
                  ...(allPartners
                    ? [
                        { title: 'Партнёров', value: (p: PayerRow) => p.partners.size },
                        { title: 'Партнёры', value: (p: PayerRow) => [...p.partners].join(', ') },
                      ]
                    : []),
                  { title: 'Сумма, ₽', value: (p) => p.sum / 100 },
                  { title: 'Инвойсы', value: (p) => p.invoices.join(', ') },
                ],
                `Повторные_плательщики_${applied.partnerName || 'все'}`.replace(/\s+/g, '_'),
              )
            }
          >
            В Excel
          </Button>
        }
      >
        <Space size={32} wrap style={{ marginBottom: 12 }}>
          <Statistic title="Платежей" value={items.length} />
          <Statistic title="Уникальных плательщиков" value={payers.length} />
          <Statistic
            title="Платили несколько раз"
            value={repeat.length}
            valueStyle={{ color: repeat.length ? '#d46b08' : undefined }}
          />
          {allPartners && (
            <Statistic
              title="Платили у разных партнёров"
              value={crossPartner.length}
              valueStyle={{ color: crossPartner.length ? '#cf1322' : undefined }}
            />
          )}
        </Space>

        {totalCapped && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message={`Проверено ${data.scannedTransactions} из ${data.totalTransactions} транзакций за период`}
            description="Сузьте период или выберите одного партнёра, чтобы охватить всех."
          />
        )}

        <Table
          dataSource={payers}
          rowKey={(_r, i) => String(i)}
          size="small"
          pagination={{ pageSize: 30 }}
          scroll={{ x: allPartners ? 860 : 700 }}
          locale={{ emptyText: 'Нет платежей за период' }}
          // Повторных и кросс-партнёрских подсвечиваем — это сигнал для проверки.
          rowClassName={(p: any) => (p.count > 1 || p.partners.size > 1 ? 'onec-row-danger' : '')}
        >
          <Table.Column
            title="Плательщик"
            render={(_: unknown, p: any) => <Text strong>{p.name}</Text>}
          />
          <Table.Column
            title="Телефон"
            width={160}
            render={(_: unknown, p: any) => p.phone || <Text type="secondary">—</Text>}
          />
          {allPartners && (
            <Table.Column
              title="Партнёров"
              width={150}
              align="right"
              sorter={(a: any, b: any) => a.partners.size - b.partners.size}
              render={(_: unknown, p: any) =>
                p.partners.size > 1 ? (
                  <Tag color="red" style={{ fontWeight: 600 }} title={[...p.partners].join(', ')}>
                    {p.partners.size} партнёра
                  </Tag>
                ) : (
                  <Text type="secondary" title={[...p.partners].join(', ')}>
                    {[...p.partners][0] ?? '—'}
                  </Text>
                )
              }
            />
          )}
          <Table.Column
            title="Платежей"
            width={110}
            align="right"
            defaultSortOrder="descend"
            sorter={(a: any, b: any) => a.count - b.count}
            render={(_: unknown, p: any) =>
              p.count > 1 ? (
                <Tag color="orange" style={{ fontWeight: 600 }}>
                  {p.count}×
                </Tag>
              ) : (
                p.count
              )
            }
          />
          <Table.Column
            title="Сумма"
            width={130}
            align="right"
            sorter={(a: any, b: any) => a.sum - b.sum}
            render={(_: unknown, p: any) => <Text strong>{money(p.sum)}</Text>}
          />
        </Table>
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
        { title: 'Инвойс', key: 'i', render: (r) => r.invoiceNumber ?? r.invoice?.invoiceNumber ?? '—', width: 160 },
        { title: 'Внешний ID', key: 'e', render: (r) => r.externalOrderId ?? '—' },
      ],
      exportCols: [
        { title: 'Дата', value: (r) => dt(r.createdAt) },
        { title: 'Статус', value: (r) => r.status },
        { title: 'Сумма, ₽', value: (r) => rub(r.amount) },
        { title: 'Валюта', value: (r) => r.orderCurrency ?? '' },
        { title: 'Провайдер', value: (r) => r.provider ?? '' },
        { title: 'Инвойс', value: (r) => r.invoiceNumber ?? r.invoice?.invoiceNumber ?? '' },
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
        { title: 'Инвойс', key: 'i', render: (r) => r.invoiceNumber ?? r.invoice?.invoiceNumber ?? r.invoiceId ?? '—' },
        { title: 'Причина', key: 'r', render: (r) => r.reason ?? '—' },
      ],
      exportCols: [
        { title: 'Создан', value: (r) => dt(r.createdAt) },
        { title: 'Статус', value: (r) => r.status },
        { title: 'Сумма, ₽', value: (r) => rub(r.amount) },
        { title: 'Инвойс', value: (r) => r.invoiceNumber ?? r.invoice?.invoiceNumber ?? '' },
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
