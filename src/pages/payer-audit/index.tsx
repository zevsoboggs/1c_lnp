import { useState } from 'react'
import { useCustom } from '@refinedev/core'
import { Card, Table, Space, Typography, Tag, Select, Input, Statistic, Alert, DatePicker } from 'antd'
import type { Dayjs } from 'dayjs'
import { dt, money } from '../../lib/format'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

type Row = {
  id: string
  invoiceNumber: string
  paidAt: string
  amount: number
  currency: string
  partnerId: string
  partnerName: string
  customerName: string | null
  expectedName: string | null
  actualName: string | null
  actualPhone: string | null
  status: 'MATCH' | 'THIRD_PARTY' | 'NOT_CHECKED' | string
}

type Stats = {
  total: number
  match: number
  thirdParty: number
  notChecked: number
  sumAmount: number
  sumThirdPartyAmount: number
  capped: boolean
}

const STATUS: Record<string, { label: string; color: string }> = {
  MATCH: { label: 'Совпадает', color: 'success' },
  THIRD_PARTY: { label: 'Третье лицо', color: 'error' },
  NOT_CHECKED: { label: 'Не проверялось', color: 'default' },
}

export const PayerAuditPage = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [status, setStatus] = useState<string>()
  const [partnerId, setPartnerId] = useState<string>()
  const [search, setSearch] = useState<string>()
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)

  const { query, result } = useCustom<{ items: Row[]; total: number; pages: number; stats: Stats }>({
    url: '/payer-audit',
    method: 'get',
    config: {
      query: {
        page,
        limit: pageSize,
        status,
        partnerId,
        search,
        // Здесь границы периода зовутся from/to — не dateFrom/dateTo и не startDate/endDate.
        from: range?.[0]?.format('YYYY-MM-DD'),
        to: range?.[1]?.format('YYYY-MM-DD'),
      },
    },
  })

  // Пагинация у этого эндпоинта лежит в корне ответа, а не в объекте pagination.
  const d = result.data
  const s = d?.stats

  const reset = () => setPage(1)

  const { onRow, menu } = useRowMenu<Row>((r) => [
    r.status && {
      key: 'st',
      label: `Отобрать «${STATUS[r.status]?.label ?? r.status}»`,
      onClick: () => {
        setStatus(r.status)
        reset()
      },
    },
    r.partnerId && {
      key: 'p',
      label: `Счета партнёра «${r.partnerName}»`,
      onClick: () => {
        setPartnerId(r.partnerId)
        reset()
      },
    },
    r.actualName && {
      key: 'name',
      label: 'Найти по плательщику',
      onClick: () => {
        setSearch(r.actualName!)
        reset()
      },
    },
    r.invoiceNumber && {
      key: 'inv',
      label: 'Копировать номер счёта',
      onClick: () => navigator.clipboard.writeText(r.invoiceNumber),
    },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}
      <Card title="Аудит плательщиков" size="small">
        <Space size={32} wrap>
          <Statistic title="Счетов в выборке" value={s?.total ?? 0} loading={query.isFetching} />
          <Statistic
            title="Совпадений"
            value={s?.match ?? 0}
            valueStyle={{ color: '#389e0d' }}
          />
          <Statistic
            title="Платежи от третьих лиц"
            value={s?.thirdParty ?? 0}
            valueStyle={{ color: s?.thirdParty ? '#cf1322' : undefined }}
          />
          <Statistic title="Не проверялось" value={s?.notChecked ?? 0} />
          <Statistic
            title="Сумма от третьих лиц"
            value={(s?.sumThirdPartyAmount ?? 0) / 100}
            precision={2}
            suffix="₽"
            valueStyle={{ color: s?.sumThirdPartyAmount ? '#cf1322' : undefined }}
          />
          <Statistic title="Сумма всего" value={(s?.sumAmount ?? 0) / 100} precision={2} suffix="₽" />
        </Space>

        {s?.capped && (
          <Alert
            type="info"
            showIcon
            style={{ marginTop: 12 }}
            message="Сводка посчитана по ограниченной выборке"
            description="API отдаёт статистику не по всей базе, а по срезу (сейчас — до 5000 счетов). Сузьте период или партнёра, чтобы цифры относились к конкретной группе."
          />
        )}
      </Card>

      <Card size="small">
        <Space wrap align="end" size={12} style={{ marginBottom: 12 }}>
          <Field label="Поиск">
            <Input.Search
              allowClear
              placeholder="Номер счёта, ФИО…"
              style={{ width: 240 }}
              onSearch={(v) => {
                setSearch(v || undefined)
                reset()
              }}
            />
          </Field>
          <Field label="Партнёр">
            <PartnerSelect
              value={partnerId}
              onChange={(v) => {
                setPartnerId(v)
                reset()
              }}
            />
          </Field>
          <Field label="Статус сверки">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 180 }}
              value={status}
              onChange={(v) => {
                setStatus(v)
                reset()
              }}
              options={Object.entries(STATUS).map(([value, { label }]) => ({ value, label }))}
            />
          </Field>
          <Field label="Период оплаты">
            <DatePicker.RangePicker
              format="DD.MM.YYYY"
              style={{ width: 240 }}
              value={range}
              onChange={(v) => {
                setRange(v?.[0] && v?.[1] ? [v[0], v[1]] : null)
                reset()
              }}
            />
          </Field>
        </Space>

        <Toolbar total={d?.total} loading={query.isFetching} onRefresh={() => query.refetch()} />

        <Table
          dataSource={d?.items ?? []}
          loading={query.isFetching}
          rowKey="id"
          size="small"
          scroll={{ x: 1150 }}
          pagination={{
            current: page,
            pageSize,
            total: d?.total ?? 0,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
          rowClassName={(r: Row) => (r.status === 'THIRD_PARTY' ? 'onec-row-danger' : '')}
          onRow={onRow}
        >
          <Table.Column dataIndex="paidAt" title="Оплачен" width={140} render={(v: string) => dt(v)} />
          <Table.Column
            dataIndex="status"
            title="Сверка"
            width={140}
            render={(v: string) => (
              <Tag color={STATUS[v]?.color ?? 'default'}>{STATUS[v]?.label ?? v}</Tag>
            )}
          />
          <Table.Column
            dataIndex="amount"
            title="Сумма"
            width={130}
            align="right"
            render={(v: number, r: Row) => <Text strong>{money(v, r.currency)}</Text>}
          />
          <Table.Column
            dataIndex="expectedName"
            title="Ожидался"
            width={200}
            render={(v: string) => v ?? <Text type="secondary">не указан</Text>}
          />
          <Table.Column
            dataIndex="actualName"
            title="Заплатил"
            width={200}
            render={(v: string, r: Row) => (
              <Space direction="vertical" size={0}>
                <Text strong={r.status === 'THIRD_PARTY'} type={r.status === 'THIRD_PARTY' ? 'danger' : undefined}>
                  {v ?? '—'}
                </Text>
                {r.actualPhone && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {r.actualPhone}
                  </Text>
                )}
              </Space>
            )}
          />
          <Table.Column dataIndex="partnerName" title="Партнёр" width={150} render={(v: string) => v ?? '—'} />
          <Table.Column
            dataIndex="invoiceNumber"
            title="Счёт"
            width={200}
            render={(v: string) => <Text copyable={!!v}>{v}</Text>}
          />
          <Table.Column
            dataIndex="customerName"
            title="Клиент в счёте"
            render={(v: string) => v ?? '—'}
          />
        </Table>
      </Card>
    </Space>
  )
}
