import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  Space,
  Select,
  InputNumber,
  Typography,
  Button,
  Alert,
  Descriptions,
  Statistic,
  Divider,
  Table,
  Input,
  Popconfirm,
  App,
} from 'antd'
import {
  CalculatorOutlined,
  SaveOutlined,
  DeleteOutlined,
  FileExcelOutlined,
  PrinterOutlined,
  FilePdfOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { money, usdt, dt } from '../../lib/format'
import { api, type SavedSheet } from '../../api/backend'
import { useRowMenu } from '../../components/useRowMenu'
import { recentPeriods, lastPeriod } from '../../lib/week'
import { exportToExcel } from '../../lib/export'
import { PrintDocument } from '../../components/PrintDocument'

const { Text } = Typography

export const PayoutSheet = () => {
  const { message } = App.useApp()
  const qc = useQueryClient()

  const periods = recentPeriods(12)
  const [partnerId, setPartnerId] = useState<string>()
  // По умолчанию — прошедший период: он закрыт, выплата по нему уже прошла.
  const [periodStart, setPeriodStart] = useState<string>(lastPeriod().from.format('YYYY-MM-DD'))
  const [percent, setPercent] = useState<number>(0)
  const [comment, setComment] = useState('')

  const period = periods.find((p) => p.value === periodStart)?.period ?? lastPeriod()

  const input = {
    partnerId,
    dateFrom: period.from.format('YYYY-MM-DD'),
    dateTo: period.to.format('YYYY-MM-DD'),
    percent,
  }

  const rate = useQuery({
    queryKey: ['rate'],
    queryFn: api.rate,
    refetchInterval: 60_000,
  })

  const calc = useMutation({
    mutationFn: () => api.preview(input),
    onError: (e: Error) => message.error(e.message),
  })

  const save = useMutation({
    mutationFn: () => api.save({ ...input, comment: comment || undefined }),
    onSuccess: (s) => {
      message.success(`Сохранён лист ${s.number}`)
      setComment('')
      calc.reset()
      qc.invalidateQueries({ queryKey: ['sheets'] })
    },
    onError: (e: Error) => message.error(e.message),
  })

  const sheets = useQuery({ queryKey: ['sheets'], queryFn: api.list })

  const del = useMutation({
    mutationFn: api.remove,
    onSuccess: () => {
      message.success('Лист удалён')
      qc.invalidateQueries({ queryKey: ['sheets'] })
    },
    onError: (e: Error) => message.error(e.message),
  })

  const s = calc.data
  const [printSheet, setPrintSheet] = useState<SavedSheet | null>(null)

  // Документ открываем прямой ссылкой в новой вкладке: он выглядит как
  // печатная форма, а «Сохранить как PDF» в браузере даёт готовый PDF.
  const docUrl = (id: string) => `/api/sheets/${id}/document`

  const { onRow, menu } = useRowMenu<SavedSheet>((r) => [
    {
      key: 'doc',
      label: 'Открыть документ / PDF',
      onClick: () => window.open(docUrl(r.id), '_blank', 'noopener'),
    },
    { key: 'print', label: 'Печать (в окне)', onClick: () => setPrintSheet(r) },
    {
      key: 'again',
      label: 'Пересчитать этот период',
      onClick: () => {
        setPartnerId(r.partner_id)
        setPeriodStart(r.date_from)
        setPercent(Number(r.percent))
        calc.reset()
      },
    },
    { type: 'divider' },
    { key: 'num', label: 'Копировать номер', onClick: () => navigator.clipboard.writeText(r.number) },
    { key: 'del', label: 'Удалить лист', danger: true, onClick: () => del.mutate(r.id) },
  ])

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {menu}
      <Card title="Расчёт заработка" size="small">
        <Space wrap align="end" size={12}>
          <Field label="Партнёр">
            <PartnerSelect
              value={partnerId}
              onChange={(v) => {
                setPartnerId(v)
                calc.reset()
              }}
              width={260}
            />
          </Field>
          <Field label="Период (вт — пн)">
            <Select
              style={{ width: 290 }}
              value={periodStart}
              options={periods.map(({ value, label }) => ({ value, label }))}
              onChange={(v) => {
                setPeriodStart(v)
                calc.reset()
              }}
            />
          </Field>
          <Field label="Процент заработка, %">
            <InputNumber
              style={{ width: 150 }}
              value={percent}
              min={0}
              max={100}
              precision={2}
              onChange={(v) => {
                setPercent(v ?? 0)
                calc.reset()
              }}
            />
          </Field>
          <Button
            type="primary"
            icon={<CalculatorOutlined />}
            loading={calc.isPending}
            disabled={!partnerId}
            onClick={() => calc.mutate()}
          >
            Рассчитать
          </Button>
        </Space>

        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Курс RAPIRA USDT/RUB:{' '}
            {rate.data ? (
              <Text strong>{rate.data.rate.toFixed(2)} ₽</Text>
            ) : rate.isError ? (
              <Text type="danger">недоступен</Text>
            ) : (
              '…'
            )}
            {rate.data && ` · обновлён ${dt(rate.data.at)}`}
          </Text>
        </div>

        {s && (
          <>
            <Divider style={{ margin: '12px 0' }} />

            {s.usdtMissing > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 12 }}
                message={`У ${s.usdtMissing} из ${s.invoicesPaid} оплаченных счетов нет курса в USDT`}
                description="На рублёвый оборот это не влияет — он считается по всем счетам."
              />
            )}

            <Space size={16} align="start" wrap>
              <Card size="small" style={{ minWidth: 240, background: '#eaf2fd' }}>
                <Statistic
                  title="Заработок, ₽"
                  value={s.payoutRub / 100}
                  precision={2}
                  suffix="₽"
                  valueStyle={{ fontSize: 24, fontWeight: 700 }}
                />
                <Divider style={{ margin: '8px 0' }} />
                <Statistic
                  title="Заработок, USDT"
                  value={s.payoutUsdt}
                  precision={2}
                  suffix="USDT"
                  valueStyle={{ fontSize: 24, fontWeight: 700, color: '#0D5AA7' }}
                />
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                  {money(s.turnoverRub)} × {s.percent}% ÷ {s.rate.toFixed(2)} ₽
                </Text>
              </Card>

              <Descriptions
                size="small"
                column={1}
                bordered
                style={{ minWidth: 330 }}
                items={[
                  { key: 'p', label: 'Партнёр', children: s.partner.name },
                  {
                    key: 'd',
                    label: 'Период',
                    children: `${dayjs(s.dateFrom).format('DD.MM.YYYY')} — ${dayjs(s.dateTo).format('DD.MM.YYYY')}`,
                  },
                  { key: 'i', label: 'Оплачено счетов', children: s.invoicesPaid },
                  {
                    key: 'tr',
                    label: 'Оборот, ₽',
                    children: <Text strong>{money(s.turnoverRub)}</Text>,
                  },
                  { key: 'tu', label: 'Оборот, USDT', children: usdt(s.turnoverUsdt) },
                  { key: 'pc', label: 'Процент', children: `${s.percent}%` },
                  {
                    key: 'rate',
                    label: 'Курс RAPIRA',
                    children: `${s.rate.toFixed(2)} ₽ · ${dt(s.rateAt)}`,
                  },
                ]}
              />

              <Space direction="vertical" size={8}>
                <Field label="Комментарий">
                  <Input.TextArea
                    rows={3}
                    style={{ width: 260 }}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="необязательно"
                  />
                </Field>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={save.isPending}
                  onClick={() => save.mutate()}
                >
                  Сохранить лист
                </Button>
              </Space>
            </Space>

            {s.apiTurnoverUsdt > 0 && Math.abs(s.apiTurnoverUsdt - s.turnoverUsdt) > 0.01 && (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 12 }}
                message={`Оборот по курсу RAPIRA: ${usdt(s.turnoverUsdt)}, а по курсам самих счетов: ${usdt(s.apiTurnoverUsdt)}`}
                description="Расхождение нормальное: RAPIRA даёт курс на сейчас, а счета пересчитаны по курсу на момент оплаты. Считаем по RAPIRA, как договорились."
              />
            )}
          </>
        )}
      </Card>

      <Card
        title={`Сохранённые листы · ${sheets.data?.total ?? 0}`}
        size="small"
        extra={
          <Button
            size="small"
            icon={<FileExcelOutlined />}
            onClick={() =>
              exportToExcel(
                sheets.data?.sheets ?? [],
                [
                  { title: 'Номер', value: (r) => r.number },
                  { title: 'Партнёр', value: (r) => r.partner_name },
                  { title: 'Период с', value: (r) => dayjs(r.date_from).format('DD.MM.YYYY') },
                  { title: 'Период по', value: (r) => dayjs(r.date_to).format('DD.MM.YYYY') },
                  { title: 'Оборот, ₽', value: (r) => Number(r.turnover_rub) / 100 },
                  { title: 'Процент, %', value: (r) => Number(r.percent) },
                  { title: 'Курс', value: (r) => Number(r.rate_usdt_rub) },
                  { title: 'Заработок, ₽', value: (r) => Number(r.payout_rub) / 100 },
                  { title: 'Заработок, USDT', value: (r) => Number(r.payout_usdt) },
                  { title: 'Создан', value: (r) => dt(r.created_at) },
                ],
                'Расчётные_листы',
              )
            }
          >
            В Excel
          </Button>
        }
      >
        <Table
          dataSource={sheets.data?.sheets ?? []}
          loading={sheets.isFetching}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1000 }}
          onRow={onRow}
        >
          <Table.Column dataIndex="number" title="Номер" width={100} />
          <Table.Column dataIndex="partner_name" title="Партнёр" width={180} />
          <Table.Column
            title="Период"
            width={180}
            render={(_: unknown, r: SavedSheet) =>
              `${dayjs(r.date_from).format('DD.MM.YY')} — ${dayjs(r.date_to).format('DD.MM.YY')}`
            }
          />
          <Table.Column
            dataIndex="turnover_rub"
            title="Оборот, ₽"
            width={130}
            align="right"
            render={(v: string) => money(Number(v))}
          />
          <Table.Column
            dataIndex="percent"
            title="%"
            width={70}
            align="right"
            render={(v: string) => `${Number(v)}%`}
          />
          <Table.Column
            dataIndex="rate_usdt_rub"
            title="Курс"
            width={90}
            align="right"
            render={(v: string) => Number(v).toFixed(2)}
          />
          <Table.Column
            dataIndex="payout_rub"
            title="Заработок, ₽"
            width={140}
            align="right"
            render={(v: string) => <Text strong>{money(Number(v))}</Text>}
          />
          <Table.Column
            dataIndex="payout_usdt"
            title="Заработок, USDT"
            width={140}
            align="right"
            render={(v: string) => (
              <Text strong style={{ color: '#0D5AA7' }}>
                {usdt(Number(v))}
              </Text>
            )}
          />
          <Table.Column
            dataIndex="created_at"
            title="Создан"
            width={140}
            render={(v: string) => dt(v)}
          />
          <Table.Column
            title=""
            width={120}
            render={(_: unknown, r: SavedSheet) => (
              <Space size={4}>
                <Button
                  size="small"
                  icon={<FilePdfOutlined />}
                  title="Открыть документ / PDF"
                  href={docUrl(r.id)}
                  target="_blank"
                />
                <Button
                  size="small"
                  icon={<PrinterOutlined />}
                  title="Печать / документ"
                  onClick={() => setPrintSheet(r)}
                />
                <Popconfirm
                  title="Удалить лист?"
                  description={`${r.number} — ${r.partner_name}`}
                  okText="Удалить"
                  cancelText="Отмена"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => del.mutate(r.id)}
                >
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )}
          />
        </Table>
      </Card>

      {printSheet && (
        <PrintDocument
          open={!!printSheet}
          onClose={() => setPrintSheet(null)}
          docType="Расчётный лист"
          number={printSheet.number.replace(/^РЛ-/, '')}
          date={dt(printSheet.created_at)}
          fields={[
            { label: 'Партнёр', value: printSheet.partner_name, wide: true },
            {
              label: 'Период',
              value: `${dayjs(printSheet.date_from).format('DD.MM.YYYY')} — ${dayjs(printSheet.date_to).format('DD.MM.YYYY')}`,
              wide: true,
            },
            { label: 'Оборот', value: money(Number(printSheet.turnover_rub)) },
            { label: 'Процент', value: `${Number(printSheet.percent)}%` },
            { label: 'Курс USDT/RUB (RAPIRA)', value: Number(printSheet.rate_usdt_rub).toFixed(2) },
            { label: 'Заработок, ₽', value: money(Number(printSheet.payout_rub)) },
            { label: 'Заработок, USDT', value: usdt(Number(printSheet.payout_usdt)) },
            ...(printSheet.comment ? [{ label: 'Комментарий', value: printSheet.comment, wide: true }] : []),
          ]}
          footNote={`Расчёт: оборот ${money(Number(printSheet.turnover_rub))} × ${Number(printSheet.percent)}% ÷ курс ${Number(printSheet.rate_usdt_rub).toFixed(2)} ₽. Документ ${printSheet.number} сформирован в админ-панели Love&Pay.`}
        />
      )}
    </Space>
  )
}
