import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Input,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd'
import { EyeOutlined, FileExcelOutlined, SyncOutlined, UserOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import { dt } from '../../lib/format'
import { exportToExcel } from '../../lib/export'
import { statMoney } from '../../api/cards'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { LogRangePicker } from '../../components/LogRangePicker'
import { DataTable } from '../../components/DataTable'
import { useRowMenu } from '../../components/useRowMenu'
import {
  sberpayApi,
  SBER_STATUS,
  SBER_TYPE,
  NPAY_STATUS,
  rub,
  som,
  type SberOperation,
  type ProviderStatus,
} from '../../api/sberpay'

const { Text, Paragraph } = Typography

const who = (u: SberOperation['user']) =>
  u.username ? `@${u.username}` : u.firstName ?? (u.telegramUserId ? String(u.telegramUserId) : '—')

/**
 * SberPay: оплаты рублями через СберБанк и ВТБ по одноразовой ссылке NPay.
 *
 * Клиент платит рубли, NPay зачисляет нам сомы. Ссылки создаёт мини-апп —
 * для пополнения рублёвого счёта, выпуска и пополнения карты, — поэтому
 * операции берём у него, а у NPay сверяем остаток и статус каждой ссылки.
 */
export const SberPayPage = () => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [status, setStatus] = useState<string>()
  const [type, setType] = useState<string>()
  const [search, setSearch] = useState<string>()
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null)
  const [dates, setDates] = useState<{ fromDate?: string; toDate?: string }>({})
  const [viewing, setViewing] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const filters = { ...dates, status, type, search }

  const summary = useQuery({
    queryKey: ['sberpay-summary', dates, type, search],
    queryFn: () => sberpayApi.summary({ ...dates, type, search }),
  })

  const list = useQuery({
    queryKey: ['sberpay-ops', page, pageSize, filters],
    queryFn: () => sberpayApi.operations({ page, pageSize, ...filters }),
  })

  const reset = () => setPage(1)
  const s = summary.data
  const merchant = s?.merchant && !('error' in s.merchant) ? s.merchant : null
  const merchantError = s?.merchant && 'error' in s.merchant ? s.merchant.error : null

  const refresh = async () => {
    // Операции держатся на сервере минуту: «Обновить» просит перечитать их
    // у мини-аппа сразу, а не ждать.
    await sberpayApi.summary({ ...dates, fresh: '1' }).catch(() => null)
    summary.refetch()
    list.refetch()
  }

  /** Выгрузка всего, что попало в отбор, а не только текущей страницы. */
  const exportAll = async () => {
    setExporting(true)
    try {
      const rows: SberOperation[] = []
      for (let p = 1; p <= 100; p++) {
        const d = await sberpayApi.operations({ page: p, pageSize: 200, ...filters })
        rows.push(...d.rows)
        if (rows.length >= d.total || d.rows.length === 0) break
      }
      exportToExcel(
        rows,
        [
          { title: 'ID операции (externalId NPay)', value: (r) => r.id },
          { title: 'Создана', value: (r) => dt(r.createdAt) },
          { title: 'Оплачена', value: (r) => (r.paidAt ? dt(r.paidAt) : '') },
          { title: 'Вид', value: (r) => SBER_TYPE[r.type] ?? r.type },
          { title: 'Статус', value: (r) => SBER_STATUS[r.status]?.label ?? r.status },
          { title: 'Рубли', value: (r) => r.rub },
          { title: 'Сомы (выставлено в NPay)', value: (r) => r.som },
          { title: 'Сумма операции', value: (r) => r.amount },
          { title: 'Валюта операции', value: (r) => r.currency },
          { title: 'GUID NPay', value: (r) => r.guid },
          { title: 'Клиент', value: (r) => who(r.user) },
          { title: 'Telegram ID', value: (r) => r.user.telegramUserId },
        ],
        'sberpay',
      )
      message.success(`Выгружено: ${rows.length}`)
    } catch (e: any) {
      message.error(e.message)
    } finally {
      setExporting(false)
    }
  }

  const { onRow, menu } = useRowMenu<SberOperation>((r) => [
    { key: 'open', label: 'Открыть операцию', onClick: () => setViewing(r.id) },
    { type: 'divider' },
    {
      key: 'u',
      label: `Все операции ${who(r.user)}`,
      onClick: () => {
        setSearch(r.user.username ?? String(r.user.telegramUserId ?? r.user.userId))
        reset()
      },
    },
    { key: 'id', label: 'Копировать ID (externalId)', onClick: () => navigator.clipboard.writeText(r.id) },
    r.guid && { key: 'g', label: 'Копировать GUID NPay', onClick: () => navigator.clipboard.writeText(r.guid!) },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}

      {s?.operationsError && (
        <Alert
          type="warning"
          showIcon
          message="Операции мини-аппа не загрузились"
          description={`${s.operationsError}. Остаток у NPay ниже — настоящий, а итоги по операциям сейчас пустые.`}
        />
      )}

      <Card title="SberPay — оплаты через NPay" size="small" loading={summary.isLoading}>
        <Space wrap size={32}>
          <Statistic
            title="Остаток у NPay"
            value={merchant?.balance ?? '—'}
            formatter={statMoney}
            suffix={merchant ? 'сом' : undefined}
          />
          <Statistic title="Оплачено операций" value={s?.completed.count ?? 0} valueStyle={{ color: '#1a7f37' }} />
          <Statistic title="Получено от клиентов" value={s?.completed.rub ?? 0} formatter={statMoney} suffix="₽" />
          <Statistic title="Выставлено в NPay" value={s?.completed.som ?? 0} formatter={statMoney} suffix="сом" />
          <Statistic title="Ждут оплаты" value={s?.byStatus?.PENDING ?? 0} valueStyle={{ color: '#1668dc' }} />
          <Statistic title="Истекли / отменены" value={(s?.byStatus?.EXPIRED ?? 0) + (s?.byStatus?.CANCELLED ?? 0) + (s?.byStatus?.CANCELED ?? 0) + (s?.byStatus?.FAILED ?? 0)} />
        </Space>
        {merchantError && (
          <Paragraph type="danger" style={{ marginTop: 8, marginBottom: 0 }}>
            NPay не ответил: {merchantError}
          </Paragraph>
        )}
        {s && Object.keys(s.byType).length > 0 && (
          <Space wrap size={8} style={{ marginTop: 12 }}>
            {Object.entries(s.byType).map(([t, b]) => (
              <Tag key={t} style={{ padding: '4px 8px' }}>
                {SBER_TYPE[t] ?? t}: <b>{b.count}</b> · {rub(b.rub)} · {som(b.som)}
              </Tag>
            ))}
          </Space>
        )}
        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
          Деньгами считаются только оплаченные операции. Клиент платит рубли, NPay зачисляет сомы
          (минимум 150 ₽, ссылка живёт 30 минут). Итоги — за выбранный период в вашем часовом поясе.
        </Paragraph>
      </Card>

      <Card size="small">
        <Space wrap align="end" size={12}>
          <Field label="Период">
            <LogRangePicker
              value={range}
              onChange={(r, api) => {
                setRange(r)
                setDates({ fromDate: api.from, toDate: api.to })
                reset()
              }}
            />
          </Field>
          <Field label="Вид">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 230 }}
              value={type}
              onChange={(v) => {
                setType(v ?? undefined)
                reset()
              }}
              options={Object.entries(SBER_TYPE).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Статус">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 160 }}
              value={status}
              onChange={(v) => {
                setStatus(v ?? undefined)
                reset()
              }}
              options={['COMPLETED', 'PENDING', 'EXPIRED', 'FAILED', 'CANCELLED'].map((v) => ({
                value: v,
                label: SBER_STATUS[v]?.label ?? v,
              }))}
            />
          </Field>
          <Field label="Поиск">
            <Input.Search
              allowClear
              placeholder="ID, GUID, @username, Telegram ID"
              style={{ width: 280 }}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value || undefined)
                reset()
              }}
            />
          </Field>
        </Space>
      </Card>

      <Card size="small">
        <Toolbar total={list.data?.total} loading={list.isFetching} onRefresh={refresh}>
          <Button size="small" icon={<FileExcelOutlined />} loading={exporting} onClick={exportAll}>
            В Excel
          </Button>
        </Toolbar>

        <DataTable
          dataSource={list.data?.rows ?? []}
          loading={list.isFetching}
          rowKey="id"
          size="small"
          scroll={{ x: 1150 }}
          onRow={onRow}
          locale={{ emptyText: list.error ? (list.error as Error).message : 'Операций нет' }}
          pagination={{
            current: page,
            pageSize,
            total: list.data?.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100, 200],
            onChange: (p, ps) => {
              setPage(p)
              setPageSize(ps)
            },
          }}
        >
          <Table.Column dataIndex="createdAt" title="Создана" width={140} render={(v: string) => dt(v)} />
          <Table.Column
            dataIndex="type"
            title="Вид"
            width={210}
            render={(v: string) => <Tag>{SBER_TYPE[v] ?? v}</Tag>}
          />
          <Table.Column
            dataIndex="status"
            title="Статус"
            width={130}
            render={(v: string) => <Tag color={SBER_STATUS[v]?.color ?? 'default'}>{SBER_STATUS[v]?.label ?? v}</Tag>}
          />
          <Table.Column
            dataIndex="rub"
            title="Рубли"
            width={130}
            align="right"
            render={(v: number | null) => <Text strong>{rub(v)}</Text>}
          />
          <Table.Column dataIndex="som" title="Сомы" width={140} align="right" render={(v: number | null) => som(v)} />
          <Table.Column
            title="Клиент"
            width={190}
            render={(_: unknown, r: SberOperation) => (
              <Space size={4}>
                <UserOutlined style={{ color: '#8c8c8c' }} />
                <Space direction="vertical" size={0}>
                  <a
                    onClick={() => {
                      setSearch(r.user.username ?? String(r.user.telegramUserId ?? r.user.userId))
                      reset()
                    }}
                  >
                    {who(r.user)}
                  </a>
                  {r.user.telegramUserId && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {r.user.telegramUserId}
                    </Text>
                  )}
                </Space>
              </Space>
            )}
          />
          <Table.Column
            dataIndex="paidAt"
            title="Оплачена"
            width={140}
            render={(v: string | null) => (v ? dt(v) : '—')}
          />
          <Table.Column
            dataIndex="id"
            title="ID"
            ellipsis
            render={(v: string) => (
              <Text type="secondary" style={{ fontSize: 11 }}>
                {v}
              </Text>
            )}
          />
          <Table.Column
            title=""
            width={50}
            fixed="right"
            render={(_: unknown, r: SberOperation) => (
              <Button size="small" icon={<EyeOutlined />} onClick={() => setViewing(r.id)} />
            )}
          />
        </DataTable>
      </Card>

      <OperationDrawer id={viewing} onClose={() => setViewing(null)} />
    </Space>
  )
}

/**
 * Карточка операции и сверка с NPay.
 *
 * Расхождение статусов — главный повод сюда зайти: у нас «ждёт», у NPay
 * «оплачено» значит, что вебхук не дошёл и клиенту не зачислили.
 */
function OperationDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const [provider, setProvider] = useState<ProviderStatus | null>(null)
  const [providerError, setProviderError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const q = useQuery({
    queryKey: ['sberpay-op', id],
    queryFn: () => sberpayApi.operation(id!),
    enabled: !!id,
  })
  const op = q.data?.operation

  const close = () => {
    setProvider(null)
    setProviderError(null)
    onClose()
  }

  const check = async () => {
    if (!id) return
    setChecking(true)
    setProviderError(null)
    try {
      setProvider((await sberpayApi.provider(id)).provider)
    } catch (e: any) {
      setProvider(null)
      setProviderError(e.message)
    } finally {
      setChecking(false)
    }
  }

  const ourPaid = op?.status === 'COMPLETED'
  const theirPaid = provider?.status === 'COMPLETED'
  const mismatch = provider && op && ourPaid !== theirPaid

  return (
    <Drawer open={!!id} onClose={close} title="Операция SberPay" width={720} loading={q.isLoading}>
      {op && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Descriptions
            size="small"
            column={2}
            bordered
            items={[
              { key: 't', label: 'Вид', children: SBER_TYPE[op.type] ?? op.type },
              {
                key: 's',
                label: 'Статус у нас',
                children: <Tag color={SBER_STATUS[op.status]?.color}>{SBER_STATUS[op.status]?.label ?? op.status}</Tag>,
              },
              { key: 'r', label: 'Рубли', children: <Text strong>{rub(op.rub)}</Text> },
              { key: 'k', label: 'Сомы', children: som(op.som) },
              { key: 'a', label: 'Сумма операции', children: `${op.amount} ${op.currency ?? ''}` },
              { key: 'x', label: 'Курс', children: op.exchangeRate ?? '—' },
              { key: 'c', label: 'Создана', children: dt(op.createdAt) },
              { key: 'p', label: 'Оплачена', children: op.paidAt ? dt(op.paidAt) : '—' },
              {
                key: 'u',
                label: 'Клиент',
                span: 2,
                children: `${op.user.firstName ?? ''} ${op.user.username ? `@${op.user.username}` : ''} · ${op.user.telegramUserId ?? op.user.userId}`,
              },
              {
                key: 'id',
                label: 'ID (externalId)',
                span: 2,
                children: <Text copyable style={{ fontSize: 11 }}>{op.id}</Text>,
              },
              {
                key: 'g',
                label: 'GUID NPay',
                span: 2,
                children: op.guid ? <Text copyable style={{ fontSize: 11 }}>{op.guid}</Text> : '—',
              },
            ]}
          />

          <Card
            size="small"
            title="Сверка с NPay"
            extra={
              <Button size="small" icon={<SyncOutlined />} loading={checking} onClick={check}>
                Проверить в NPay
              </Button>
            }
          >
            {!provider && !providerError && (
              <Text type="secondary">Спросить у NPay статус этой ссылки по нашему ID.</Text>
            )}
            {providerError && <Alert type="warning" showIcon message={providerError} />}
            {provider && (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {mismatch && (
                  <Alert
                    type="error"
                    showIcon
                    message={
                      theirPaid
                        ? 'NPay говорит «оплачено», а у нас нет — вебхук не дошёл, клиенту не зачислено'
                        : 'У нас «оплачено», а NPay оплату не подтверждает — разобраться до выплат'
                    }
                  />
                )}
                <Descriptions
                  size="small"
                  column={2}
                  bordered
                  items={[
                    {
                      key: 's',
                      label: 'Статус у NPay',
                      children: provider.status ? (
                        <Tag color={NPAY_STATUS[provider.status]?.color}>
                          {NPAY_STATUS[provider.status]?.label ?? provider.status}
                        </Tag>
                      ) : (
                        '—'
                      ),
                    },
                    { key: 'a', label: 'Выставлено', children: som(provider.amount) },
                    { key: 'p', label: 'Оплачено', children: som(provider.paymentAmount) },
                    { key: 'e', label: 'Истекает', children: provider.expiresAt ? dt(provider.expiresAt) : '—' },
                  ]}
                />
              </Space>
            )}
          </Card>

          {op.metadata && (
            <Card size="small" title="metadata (вместе с вебхуком NPay)">
              <pre
                style={{
                  margin: 0,
                  maxHeight: 320,
                  overflow: 'auto',
                  fontSize: 11,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {JSON.stringify(op.metadata, null, 2)}
              </pre>
            </Card>
          )}
        </Space>
      )}
    </Drawer>
  )
}
