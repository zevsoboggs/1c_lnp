import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Card,
  Space,
  Button,
  Typography,
  Table,
  Statistic,
  Alert,
  DatePicker,
  Divider,
  Drawer,
  Tag,
  App,
  Input,
} from 'antd'
import {
  CalculatorOutlined,
  SaveOutlined,
  FileExcelOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { DangerConfirm } from '../../components/DangerAction'
import { money } from '../../lib/format'
import { exportToExcel } from '../../lib/export'
import { salaryApi, type PreviewSheet, type SavedSheet } from '../../api/salary'
import { canWrite } from '../../api/accessControl'

dayjs.extend(isoWeek)

const { Text, Title } = Typography
const rub = (kopecks: number | string) => money(Number(kopecks))
const periodLabel = (from: string, to: string) =>
  `${dayjs(from).format('DD.MM.YYYY')} — ${dayjs(to).format('DD.MM.YYYY')}`

/** Прошлая неделя Пн–Вс — зарплату ПМ считает именно за неё. */
function lastMonSun(): [Dayjs, Dayjs] {
  const thisMonday = dayjs().startOf('day').subtract(dayjs().isoWeekday() - 1, 'day')
  const from = thisMonday.subtract(7, 'day')
  return [from, from.add(6, 'day')]
}

export const SalaryPage = () => {
  const { message } = App.useApp()
  const editable = canWrite('salary')

  const [range, setRange] = useState<[Dayjs, Dayjs]>(lastMonSun())
  const [preview, setPreview] = useState<PreviewSheet | null>(null)
  const [comment, setComment] = useState('')
  const [viewing, setViewing] = useState<SavedSheet | null>(null)
  const [removing, setRemoving] = useState<SavedSheet | null>(null)

  const sheetsQ = useQuery({ queryKey: ['salary-sheets'], queryFn: salaryApi.sheets })

  const from = range[0].format('YYYY-MM-DD')
  const to = range[1].format('YYYY-MM-DD')

  const calc = useMutation({
    mutationFn: () => salaryApi.preview({ dateFrom: from, dateTo: to }),
    onSuccess: (s) => setPreview(s),
    onError: (e: Error) => message.error(e.message, 6),
  })

  const save = useMutation({
    mutationFn: () => salaryApi.save({ dateFrom: from, dateTo: to, comment: comment || undefined }),
    onSuccess: (s) => {
      message.success(`Лист ${s.number} сохранён`)
      setComment('')
      sheetsQ.refetch()
    },
    onError: (e: Error) => message.error(e.message, 6),
  })

  const remove = useMutation({
    mutationFn: () => salaryApi.removeSheet(removing!.id),
    onSuccess: () => {
      setRemoving(null)
      message.success('Лист удалён')
      sheetsQ.refetch()
    },
    onError: (e: Error) => {
      setRemoving(null)
      message.error(e.message, 6)
    },
  })

  const run = () => {
    setPreview(null)
    calc.mutate()
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card title="Зарплата за период" size="small">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="Оборот × ставка по всем партнёрам"
          description="Выберите период (по умолчанию — прошлая неделя Пн–Вс). Считается оборот каждого партнёра со ставкой × его ставка, всё суммируется в один лист. Сохранённый лист замораживает проценты и обороты — история не меняется, даже если ставки потом поправят."
        />
        <Space wrap align="end" size={12}>
          <Field label="Период (неделя)">
            <DatePicker.RangePicker
              value={range}
              onChange={(v) => v?.[0] && v?.[1] && (setRange([v[0], v[1]]), setPreview(null))}
              format="DD.MM.YYYY"
              allowClear={false}
              style={{ width: 260 }}
            />
          </Field>
          <Button
            type="primary"
            icon={<CalculatorOutlined />}
            loading={calc.isPending}
            onClick={run}
          >
            Рассчитать
          </Button>
        </Space>
      </Card>

      {preview && (
        <Card
          size="small"
          title={
            <Space direction="vertical" size={0}>
              <Text strong>Зарплатный лист за период</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {periodLabel(preview.dateFrom, preview.dateTo)}
              </Text>
            </Space>
          }
          extra={
            <Space>
              <Button
                size="small"
                icon={<FileExcelOutlined />}
                disabled={!preview.lines.length}
                onClick={() =>
                  exportToExcel(
                    preview.lines,
                    [
                      { title: 'Партнёр', value: (l) => l.partnerName },
                      { title: 'Оборот, ₽', value: (l) => l.turnoverRub / 100 },
                      { title: 'Ставка, %', value: (l) => l.percent },
                      { title: 'Начислено, ₽', value: (l) => l.accruedRub / 100 },
                    ],
                    `Зарплата_${preview.dateFrom}_${preview.dateTo}`,
                  )
                }
              >
                В Excel
              </Button>
              {editable && (
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  loading={save.isPending}
                  onClick={() => save.mutate()}
                >
                  Сохранить лист
                </Button>
              )}
            </Space>
          }
        >
          <Space size={32} wrap style={{ marginBottom: 12 }}>
            <Statistic title="Партнёров" value={preview.partnersCount} />
            <Statistic
              title="Начислено за период"
              value={preview.totalRub / 100}
              precision={2}
              suffix="₽"
              valueStyle={{ color: '#3f8600', fontWeight: 700 }}
            />
          </Space>

          {preview.partnersCount === 0 ? (
            <Alert
              type="warning"
              showIcon
              message="Нет партнёров со ставкой"
              description="Назначьте партнёрам ставку в разделе «Проценты партнёров»."
            />
          ) : (
            <>
              <Table
                dataSource={preview.lines}
                rowKey="partnerId"
                size="small"
                pagination={false}
                scroll={{ x: 560 }}
              >
                <Table.Column
                  dataIndex="partnerName"
                  title="Партнёр"
                  render={(v: string) => <Text strong>{v}</Text>}
                />
                <Table.Column
                  dataIndex="turnoverRub"
                  title="Оборот"
                  width={160}
                  align="right"
                  render={(v: number) => rub(v)}
                />
                <Table.Column
                  dataIndex="percent"
                  title="Ставка"
                  width={90}
                  align="right"
                  render={(v: number) => <Tag color="green">{v}%</Tag>}
                />
                <Table.Column
                  dataIndex="accruedRub"
                  title="Начислено"
                  width={150}
                  align="right"
                  render={(v: number) => <Text strong>{rub(v)}</Text>}
                />
              </Table>
              {editable && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <Input
                    placeholder="Комментарий к листу (необязательно)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    style={{ maxWidth: 420 }}
                  />
                </>
              )}
            </>
          )}
        </Card>
      )}

      <Card size="small" title="Сохранённые зарплатные листы">
        <Toolbar total={sheetsQ.data?.sheets.length ?? 0} loading={sheetsQ.isFetching} onRefresh={() => sheetsQ.refetch()} />
        <Table
          dataSource={sheetsQ.data?.sheets ?? []}
          loading={sheetsQ.isFetching}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 680 }}
          locale={{ emptyText: 'Сохранённых листов пока нет' }}
        >
          <Table.Column dataIndex="number" title="Номер" width={110} render={(v: string) => <Text strong>{v}</Text>} />
          <Table.Column
            title="Период"
            width={220}
            render={(_: unknown, s: SavedSheet) => periodLabel(s.date_from, s.date_to)}
          />
          <Table.Column dataIndex="partners_count" title="Партнёров" width={110} align="right" />
          <Table.Column
            dataIndex="total_rub"
            title="Начислено"
            width={160}
            align="right"
            render={(v: string) => <Text strong style={{ color: '#3f8600' }}>{rub(v)}</Text>}
          />
          <Table.Column
            title=""
            width={90}
            fixed="right"
            render={(_: unknown, s: SavedSheet) => (
              <Space size={4}>
                <Button size="small" icon={<EyeOutlined />} onClick={() => setViewing(s)} />
                {editable && (
                  <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => setRemoving(s)} />
                )}
              </Space>
            )}
          />
        </Table>
      </Card>

      <SheetDrawer sheet={viewing} onClose={() => setViewing(null)} />

      <DangerConfirm
        open={!!removing}
        title="Удалить зарплатный лист?"
        what={`Лист ${removing?.number} за ${removing ? periodLabel(removing.date_from, removing.date_to) : ''} будет удалён.`}
        confirmWord="УДАЛИТЬ"
        okText="Удалить"
        loading={remove.isPending}
        onOk={() => remove.mutate()}
        onCancel={() => setRemoving(null)}
      />
    </Space>
  )
}

function SheetDrawer({ sheet, onClose }: { sheet: SavedSheet | null; onClose: () => void }) {
  const q = useQuery({
    queryKey: ['salary-sheet', sheet?.id],
    queryFn: () => salaryApi.sheet(sheet!.id),
    enabled: !!sheet,
  })
  const lines = q.data?.lines ?? []

  return (
    <Drawer open={!!sheet} onClose={onClose} width={640} title={`Зарплатный лист ${sheet?.number ?? ''}`}>
      {sheet && (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ margin: 0 }}>
              {periodLabel(sheet.date_from, sheet.date_to)}
            </Title>
            <Text type="secondary">Партнёров: {sheet.partners_count}</Text>
          </div>
          <Statistic
            title="Начислено"
            value={Number(sheet.total_rub) / 100}
            precision={2}
            suffix="₽"
            valueStyle={{ color: '#3f8600', fontWeight: 700 }}
          />
          {sheet.comment && <Alert type="info" message={sheet.comment} />}
          <Table dataSource={lines} rowKey="partner_id" size="small" pagination={false} loading={q.isFetching}>
            <Table.Column dataIndex="partner_name" title="Партнёр" render={(v: string) => <Text strong>{v}</Text>} />
            <Table.Column
              dataIndex="turnover_rub"
              title="Оборот"
              width={150}
              align="right"
              render={(v: string) => rub(v)}
            />
            <Table.Column
              dataIndex="percent"
              title="Ставка"
              width={80}
              align="right"
              render={(v: number) => <Tag color="green">{v}%</Tag>}
            />
            <Table.Column
              dataIndex="accrued_rub"
              title="Начислено"
              width={140}
              align="right"
              render={(v: string) => <Text strong>{rub(v)}</Text>}
            />
          </Table>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Проценты и обороты заморожены на момент сохранения листа.
          </Text>
        </Space>
      )}
    </Drawer>
  )
}
