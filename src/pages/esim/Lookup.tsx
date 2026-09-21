import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Alert, Button, Card, Collapse, Descriptions, Empty, Input, Space, Table, Tag, Typography,
} from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { dt } from '../../lib/format'

const { Text, Paragraph } = Typography

type Support = {
  reference: string
  /** Сходится ли наша запись с тем, что показывает провайдер. */
  matchesOurRecord: boolean
  owner?: {
    telegramId?: number | string
    username?: string | null
    kycStatus?: string | null
  } | null
  esim?: {
    iccid?: string
    status?: string
    tariff?: string
    country?: string
    createdAt?: string
    activatedAt?: string | null
    expiresAt?: string | null
    qr?: string | null
  } | null
  provider?: {
    active?: boolean
    tariff?: string | null
    trafficLeft?: string | number | null
    expiresAt?: string | null
  } | null
  payments?: Array<{
    id?: string
    amount?: number | string
    currency?: string
    method?: string
    status?: string
    createdAt?: string
    refunded?: boolean
  }>
}

/**
 * Поиск eSIM по короткому номеру.
 *
 * Номер вида ES-XNRR3S клиент называет по телефону, поэтому принимаем его в
 * любом написании — приводит к одному виду сервер.
 *
 * Главное здесь — строка расхождения. Случай, когда у нас симка числится
 *активной с тарифом, а у провайдера тарифа нет, раньше разбирали вручную по
 * полчаса. Теперь он виден первым, до того как оператор начнёт читать поля.
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
            placeholder="ES-XNRR3S"
            allowClear
            autoFocus
          />
          <Button type="primary" icon={<SearchOutlined />} loading={find.isPending} onClick={search}>
            Найти
          </Button>
        </Space.Compact>
        <Paragraph type="secondary" style={{ fontSize: 12, margin: '8px 0 0' }}>
          Номер можно вводить как угодно: ES-XNRR3S, es-xnrr3s или просто XNRR3S.
        </Paragraph>
      </Card>

      {find.isError && (
        <Alert type="error" showIcon message={(find.error as Error).message} />
      )}

      {!find.isPending && !find.isError && !data && (
        <Empty description="Введите номер eSIM — он есть у клиента в мини-аппе" />
      )}

      {data && (
        <>
          {/* Расхождение показываем первым: ради него поиск и делался. */}
          <Alert
            type={data.matchesOurRecord ? 'success' : 'error'}
            showIcon
            message={
              data.matchesOurRecord
                ? 'Наша запись сходится с провайдером'
                : 'Расхождение: наша запись и состояние у провайдера не совпадают'
            }
            description={
              data.matchesOurRecord
                ? undefined
                : 'Обычно это значит, что у нас тариф числится, а у провайдера его нет. Сверьте поля ниже.'
            }
          />

          <Card size="small" title={`eSIM ${data.reference}`}>
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="ICCID">
                {data.esim?.iccid ? <Text copyable>{data.esim.iccid}</Text> : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Статус у нас">
                {data.esim?.status ? <Tag>{data.esim.status}</Tag> : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Тариф">{data.esim?.tariff ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Страна">{data.esim?.country ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Куплена">{dt(data.esim?.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="Активирована">
                {data.esim?.activatedAt ? dt(data.esim.activatedAt) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Действует до">
                {data.esim?.expiresAt ? dt(data.esim.expiresAt) : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title="Что показывает провайдер">
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Тариф активен">
                <Tag color={data.provider?.active ? 'success' : 'error'}>
                  {data.provider?.active ? 'да' : 'нет'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Тариф">{data.provider?.tariff ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Остаток трафика">
                {data.provider?.trafficLeft ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Срок">
                {data.provider?.expiresAt ? dt(data.provider.expiresAt) : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title="Владелец">
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="Telegram ID">
                {data.owner?.telegramId ? (
                  <Text copyable>{String(data.owner.telegramId)}</Text>
                ) : (
                  '—'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Username">
                {data.owner?.username ? `@${data.owner.username}` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="KYC">
                {data.owner?.kycStatus ? <Tag>{data.owner.kycStatus}</Tag> : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          <Card size="small" title={`Платежи · ${data.payments?.length ?? 0}`}>
            {data.payments && data.payments.length > 0 ? (
              <Table
                dataSource={data.payments}
                rowKey={(r, i) => r.id ?? String(i)}
                size="small"
                pagination={false}
                columns={[
                  { title: 'Дата', dataIndex: 'createdAt', render: (v: string) => dt(v), width: 150 },
                  {
                    title: 'Сумма',
                    width: 120,
                    render: (_: unknown, r) =>
                      r.amount === undefined ? '—' : `${r.amount} ${r.currency ?? ''}`.trim(),
                  },
                  { title: 'Способ', dataIndex: 'method', width: 130 },
                  {
                    title: 'Статус',
                    width: 140,
                    render: (_: unknown, r) => (
                      <Space size={4}>
                        {r.status && <Tag>{r.status}</Tag>}
                        {r.refunded && <Tag color="orange">возврат</Tag>}
                      </Space>
                    ),
                  },
                ]}
              />
            ) : (
              <Text type="secondary">Платежей по этой симке нет</Text>
            )}
          </Card>

          {/* Ответ целиком. Поля выше разложены по названиям, о которых мы
              договорились; если сервис вернёт что-то ещё или назовёт иначе,
              оператор всё равно увидит данные, а не прочерки. */}
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
