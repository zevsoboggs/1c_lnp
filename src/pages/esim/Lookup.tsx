import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Alert, Button, Card, Collapse, Descriptions, Empty, Input, Progress, Space, Table, Tag, Typography,
} from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { dt } from '../../lib/format'

const { Text, Paragraph } = Typography

/** Ответ /api/admin/support/esim/:reference — имена сверены с живым ответом. */
type Support = {
  esim: {
    reference: string
    iccid: string
    status: string
    planName: string | null
    activePlanId: string | null
    planActivatedAt: string | null
    planExpiredAt: string | null
    qrCode: string | null
    createdAt: string
  }
  user: {
    id: string
    telegramUserId: number | string
    username: string | null
    firstName: string | null
    kycStatus: string | null
  } | null
  provider: {
    activePlanId: string | null
    planActivatedAt: string | null
    planExpiredAt: string | null
    statusQr: string | null
    dataPackageMb: number | null
    dataUsedMb: number | null
    dataLeftMb: number | null
    /** Сходится ли наша запись с тем, что показывает провайдер. */
    matchesOurRecord: boolean
  } | null
  payments: Array<{
    id: string
    createdAt: string
    type: string
    status: string
    amount: number
    currency: string
    description: string | null
    iccid: string | null
  }>
}

const gb = (mb: number | null | undefined) =>
  mb === null || mb === undefined ? '—' : `${(mb / 1024).toFixed(2)} ГБ`

/**
 * Поиск eSIM по короткому номеру.
 *
 * Номер вида ES-GLUXFG клиент называет по телефону, поэтому принимаем его в
 * любом написании — приводит к одному виду сервер.
 *
 * Первым идёт признак расхождения с провайдером: случай «у нас числится
 * активной с тарифом, а у провайдера тарифа нет» раньше разбирали вручную по
 * полчаса, ради него поиск и делался.
 */
export function EsimLookup() {
  const [value, setValue] = useState('')

  const find = useMutation({
    mutationFn: async (reference: string) => {
      const res = await fetch(`/api/miniapp/support/esim/${encodeURIComponent(reference)}`)
      const body = await res.json().catch(() => null)
      if (!res.ok || body?.success === false) {
        throw new Error(body?.error ?? `Ошибка ${res.status}`)
      }
      return body as Support
    },
  })

  const data = find.data
  const search = () => {
    const v = value.trim()
    if (v) find.mutate(v)
  }

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card size="small">
        <Space.Compact style={{ width: '100%', maxWidth: 420 }}>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onPressEnter={search}
            placeholder="ES-GLUXFG"
            allowClear
            autoFocus
          />
          <Button type="primary" icon={<SearchOutlined />} loading={find.isPending} onClick={search}>
            Найти
          </Button>
        </Space.Compact>
        <Paragraph type="secondary" style={{ fontSize: 12, margin: '8px 0 0' }}>
          Номер можно вводить как угодно: ES-GLUXFG, es-gluxfg или просто GLUXFG.
        </Paragraph>
      </Card>

      {find.isError && <Alert type="error" showIcon message={(find.error as Error).message} />}

      {!find.isPending && !find.isError && !data && (
        <Empty description="Введите номер eSIM — он есть у клиента в мини-аппе" />
      )}

      {data && (
        <>
          {/* Ради этой строки поиск и делался, поэтому она первая. */}
          <Alert
            type={data.provider?.matchesOurRecord ? 'success' : 'error'}
            showIcon
            message={
              data.provider == null
                ? 'Провайдер не ответил — сверить состояние не с чем'
                : data.provider.matchesOurRecord
                  ? 'Наша запись сходится с провайдером'
                  : 'Расхождение: наша запись и состояние у провайдера не совпадают'
            }
            description={
              data.provider != null && !data.provider.matchesOurRecord
                ? 'Обычно это значит, что у нас тариф числится, а у провайдера его нет. Сверьте тариф и даты ниже.'
                : undefined
            }
          />

          <Card size="small" title={`eSIM ${data.esim.reference}`}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="ICCID">
                <Text copyable>{data.esim.iccid}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Статус у нас">
                <Tag color={data.esim.status === 'ACTIVE' ? 'success' : undefined}>
                  {data.esim.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Тариф">{data.esim.planName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Куплена">{dt(data.esim.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Тариф активирован">
                {data.esim.planActivatedAt ? dt(data.esim.planActivatedAt) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Тариф истёк">
                {data.esim.planExpiredAt ? dt(data.esim.planExpiredAt) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="QR для установки">
                {data.esim.qrCode ? <Text copyable code>{data.esim.qrCode}</Text> : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title="Что показывает провайдер">
            {data.provider ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {/* Трафик — то, ради чего клиент обычно и звонит. */}
                {data.provider.dataPackageMb != null && (
                  <div>
                    <Progress
                      percent={Math.round(
                        ((data.provider.dataUsedMb ?? 0) / data.provider.dataPackageMb) * 100,
                      )}
                      size="small"
                      status="normal"
                    />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Осталось {gb(data.provider.dataLeftMb)} из {gb(data.provider.dataPackageMb)}
                      {' · израсходовано '}
                      {gb(data.provider.dataUsedMb)}
                    </Text>
                  </div>
                )}
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label="Состояние QR">
                    {data.provider.statusQr ?? '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Тариф у провайдера">
                    {data.provider.activePlanId ? (
                      <Text code copyable>{data.provider.activePlanId}</Text>
                    ) : (
                      <Text type="danger">не найден</Text>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Активирован">
                    {data.provider.planActivatedAt ? dt(data.provider.planActivatedAt) : '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Истекает">
                    {data.provider.planExpiredAt ? dt(data.provider.planExpiredAt) : '—'}
                  </Descriptions.Item>
                </Descriptions>
              </Space>
            ) : (
              <Text type="secondary">Провайдер не ответил</Text>
            )}
          </Card>

          <Card size="small" title="Владелец">
            {data.user ? (
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="Имя">{data.user.firstName ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Telegram">
                  {data.user.username ? `@${data.user.username}` : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Telegram ID">
                  <Text copyable>{String(data.user.telegramUserId)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="KYC">
                  <Tag color={data.user.kycStatus === 'APPROVED' ? 'success' : 'warning'}>
                    {data.user.kycStatus ?? '—'}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Text type="secondary">Владелец не найден</Text>
            )}
          </Card>

          <Card
            size="small"
            title={`Платежи покупателя · ${data.payments?.length ?? 0}`}
            extra={
              <Text type="secondary" style={{ fontSize: 12 }}>
                выделены относящиеся к этой eSIM
              </Text>
            }
          >
            {data.payments?.length ? (
              <Table
                dataSource={data.payments}
                rowKey="id"
                size="small"
                pagination={data.payments.length > 10 ? { pageSize: 10 } : false}
                // Список приходит по всему покупателю, а не по одной симке:
                // помечаем свои, чтобы оператор не искал их глазами по ICCID.
                rowClassName={(r) => (r.iccid === data.esim.iccid ? 'onec-row-accent' : '')}
                columns={[
                  { title: 'Дата', dataIndex: 'createdAt', width: 150, render: (v: string) => dt(v) },
                  {
                    title: 'Сумма',
                    width: 110,
                    align: 'right',
                    render: (_: unknown, r) => `${r.amount} ${r.currency}`,
                  },
                  {
                    title: 'Статус',
                    width: 190,
                    render: (_: unknown, r) => (
                      <Space size={4} wrap>
                        <Tag color={r.status === 'COMPLETED' ? 'success' : undefined}>{r.status}</Tag>
                        {r.type?.includes('REFUND') && <Tag color="orange">возврат</Tag>}
                      </Space>
                    ),
                  },
                  { title: 'Назначение', dataIndex: 'description', render: (v: string) => v ?? '—' },
                ]}
              />
            ) : (
              <Text type="secondary">Платежей нет</Text>
            )}
          </Card>

          <Collapse
            size="small"
            items={[
              {
                key: 'raw',
                label: 'Ответ сервиса целиком',
                children: (
                  <Input.TextArea
                    value={JSON.stringify(data, null, 2)}
                    readOnly
                    autoSize={{ minRows: 6, maxRows: 24 }}
                    style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}
                  />
                ),
              },
            ]}
          />
        </>
      )}
    </Space>
  )
}
