import { useState } from 'react'
import { List, useTable } from '@refinedev/antd'
import { useQuery } from '@tanstack/react-query'
import {
  Table,
  Select,
  Space,
  Card,
  Input,
  Typography,
  Tag,
  Button,
  Drawer,
  Descriptions,
  Image,
  Alert,
  DatePicker,
  Spin,
} from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import type { CrudFilters } from '@refinedev/core'
import dayjs from 'dayjs'
import { dt } from '../../lib/format'
import { PartnerSelect } from '../../components/PartnerSelect'
import { Field } from '../../components/Field'
import { Toolbar } from '../../components/Toolbar'
import { StatusTag } from '../../components/StatusTag'
import { action } from '../../api/actions'
import { useRowMenu } from '../../components/useRowMenu'

const { Text } = Typography

const KYC_STATUS = [
  ['APPROVED', 'Одобрена', 'success'],
  ['DECLINED', 'Отклонена', 'error'],
  ['PENDING', 'Ожидает', 'processing'],
  ['IN_REVIEW', 'На проверке', 'blue'],
  ['EXPIRED', 'Истекла', 'default'],
  ['ABANDONED', 'Брошена', 'default'],
].map(([value, label, color]) => ({ value, label, color }))

const score = (v: number | null, good = 80) =>
  v == null ? (
    <Text type="secondary">—</Text>
  ) : (
    <Text strong style={{ color: v >= good ? '#389e0d' : v >= 50 ? '#d46b08' : '#cf1322' }}>
      {v}
    </Text>
  )

export const KycVerificationList = () => {
  const [viewing, setViewing] = useState<any>(null)

  const { tableProps, filters, setFilters, tableQuery } = useTable({
    resource: 'kyc-verifications',
    syncWithLocation: true,
    pagination: { pageSize: 50 },
  })

  const valueOf = (field: string) =>
    (filters as CrudFilters)?.find((f) => 'field' in f && f.field === field)?.value

  const apply = (field: string, value: unknown) =>
    setFilters([{ field, operator: 'eq', value }], 'merge')

  // Детальный GET не бесплатный: он ходит в Didit за свежими ссылками на медиа,
  // поэтому грузим только по клику и не кэшируем надолго.
  const detail = useQuery({
    queryKey: ['kyc-verification', viewing?.id],
    queryFn: () => action<{ verification: any; media: any }>(`/kyc-verifications/${viewing.id}`, { method: 'GET' }),
    enabled: !!viewing,
    staleTime: 60_000,
    retry: 0,
  })

  const v = detail.data?.verification
  const media = detail.data?.media

  const images: Array<{ src: string; label: string }> = []
  if (media && typeof media === 'object') {
    for (const [k, val] of Object.entries(media as Record<string, unknown>)) {
      if (typeof val === 'string' && /^https?:\/\//.test(val) && !/\.(mp4|webm|mov)(\?|$)/i.test(val)) {
        images.push({ src: val, label: k })
      }
    }
  }
  const videos: Array<{ src: string; label: string }> = []
  if (media && typeof media === 'object') {
    for (const [k, val] of Object.entries(media as Record<string, unknown>)) {
      if (typeof val === 'string' && /\.(mp4|webm|mov)(\?|$)/i.test(val)) videos.push({ src: val, label: k })
    }
  }

  const { onRow, menu } = useRowMenu<any>((r) => [
    { key: 'open', label: 'Открыть карточку', onClick: () => setViewing(r) },
    { type: 'divider' },
    r.status && {
      key: 'st',
      label: `Отобрать по статусу «${r.status}»`,
      onClick: () => apply('status', r.status),
    },
    r.partnerId && {
      key: 'p',
      label: `Верификации партнёра «${r.partnerName ?? r.partner?.name ?? ''}»`,
      onClick: () => apply('partnerId', r.partnerId),
    },
    r.documentNumber && {
      key: 'doc',
      label: 'Копировать номер документа',
      onClick: () => navigator.clipboard.writeText(r.documentNumber),
    },
  ])

  return (
    <List title="KYC-верификации">
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap align="end" size={12}>
          <Field label="Поиск">
            <Input.Search
              allowClear
              placeholder="Имя, документ, email…"
              style={{ width: 240 }}
              defaultValue={valueOf('search') as string}
              onSearch={(x) => apply('search', x || undefined)}
            />
          </Field>
          <Field label="Партнёр">
            <PartnerSelect
              value={valueOf('partnerId') as string}
              onChange={(x) => apply('partnerId', x)}
            />
          </Field>
          <Field label="Статус">
            <Select
              allowClear
              placeholder="Все"
              style={{ width: 160 }}
              options={KYC_STATUS.map(({ value, label }) => ({ value, label }))}
              value={valueOf('status') as string}
              onChange={(x) => apply('status', x)}
            />
          </Field>
          <Field label="Период">
            <DatePicker.RangePicker
              format="DD.MM.YYYY"
              style={{ width: 230 }}
              value={
                valueOf('dateFrom')
                  ? [dayjs(valueOf('dateFrom') as string), dayjs(valueOf('dateTo') as string)]
                  : null
              }
              onChange={(x) => {
                setFilters(
                  [
                    { field: 'dateFrom', operator: 'eq', value: x?.[0]?.format('YYYY-MM-DD') },
                    { field: 'dateTo', operator: 'eq', value: x?.[1]?.format('YYYY-MM-DD') },
                  ],
                  'merge',
                )
              }}
            />
          </Field>
        </Space>
      </Card>

      <Toolbar
        total={tableQuery.data?.total}
        loading={tableQuery.isFetching}
        onRefresh={() => tableQuery.refetch()}
      />

      {menu}

      <Table {...tableProps} rowKey="id" size="small" scroll={{ x: 1250 }} onRow={onRow}>
        <Table.Column dataIndex="createdAt" title="Создана" width={140} render={(x: string) => dt(x)} />
        <Table.Column
          dataIndex="status"
          title="Статус"
          width={120}
          render={(x: string) => <StatusTag list={KYC_STATUS} value={x} />}
        />
        <Table.Column
          dataIndex="customerName"
          title="Клиент"
          width={200}
          render={(x: string, r: any) =>
            x ?? [r.firstName, r.lastName].filter(Boolean).join(' ') ?? '—'
          }
        />
        <Table.Column
          dataIndex="partnerName"
          title="Партнёр"
          width={150}
          render={(x: string, r: any) => x ?? r.partner?.name ?? '—'}
        />
        <Table.Column
          dataIndex="documentType"
          title="Документ"
          width={150}
          render={(x: string, r: any) => (
            <Space direction="vertical" size={0}>
              <span>{x ?? '—'}</span>
              {r.documentNumber && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {r.documentNumber}
                </Text>
              )}
            </Space>
          )}
        />
        <Table.Column
          dataIndex="faceMatchScore"
          title="Лицо"
          width={80}
          align="right"
          render={(x: number) => score(x)}
        />
        <Table.Column
          dataIndex="livenessScore"
          title="Живость"
          width={90}
          align="right"
          render={(x: number) => score(x)}
        />
        <Table.Column
          dataIndex="fraudScore"
          title="Фрод"
          width={80}
          align="right"
          render={(x: number) =>
            x == null ? <Text type="secondary">—</Text> : (
              <Text strong style={{ color: x > 50 ? '#cf1322' : '#389e0d' }}>{x}</Text>
            )
          }
        />
        <Table.Column dataIndex="provider" title="Провайдер" width={100} render={(x: string) => <Tag>{x}</Tag>} />
        <Table.Column dataIndex="verifiedAt" title="Проверена" width={140} render={(x: string) => dt(x)} />
        <Table.Column
          title=""
          width={50}
          fixed="right"
          render={(_: unknown, r: any) => (
            <Button
              size="small"
              icon={<EyeOutlined />}
              title="Открыть карточку"
              onClick={() => setViewing(r)}
            />
          )}
        />
      </Table>

      <Drawer
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Карточка верификации"
        width={860}
      >
        {detail.isFetching && (
          <Space style={{ marginBottom: 12 }}>
            <Spin size="small" />
            <Text type="secondary">Запрашиваем свежие ссылки на медиа у провайдера…</Text>
          </Space>
        )}
        {detail.isError && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message="Не удалось получить детали"
            description={(detail.error as Error)?.message}
          />
        )}

        {v && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Descriptions
              size="small"
              column={2}
              bordered
              items={[
                { key: 'n', label: 'Имя', children: [v.firstName, v.lastName].filter(Boolean).join(' ') || v.customerName || '—' },
                { key: 's', label: 'Статус', children: <StatusTag list={KYC_STATUS} value={v.status} /> },
                { key: 'dob', label: 'Дата рождения', children: v.dateOfBirth ? dayjs(v.dateOfBirth).format('DD.MM.YYYY') : '—' },
                { key: 'doc', label: 'Документ', children: `${v.documentType ?? '—'} ${v.documentNumber ?? ''}` },
                { key: 'dc', label: 'Страна документа', children: v.documentCountry ?? '—' },
                { key: 'de', label: 'Документ до', children: v.documentExpiry ? dayjs(v.documentExpiry).format('DD.MM.YYYY') : '—' },
                { key: 'fm', label: 'Совпадение лица', children: score(v.faceMatchScore) },
                { key: 'lv', label: 'Живость', children: score(v.livenessScore) },
                { key: 'fr', label: 'Фрод-скор', children: v.fraudScore ?? '—' },
                { key: 'aml', label: 'AML', children: v.amlStatus ?? '—' },
                { key: 'ip', label: 'IP', children: `${v.ipAddress ?? '—'} ${v.ipCountry ?? ''}` },
                { key: 'p', label: 'Партнёр', children: v.partnerName ?? v.partner?.name ?? '—' },
                { key: 'c', label: 'Создана', children: dt(v.createdAt) },
                { key: 'vf', label: 'Проверена', children: dt(v.verifiedAt) },
                { key: 'ex', label: 'Истекает', children: v.expiresAt ? dt(v.expiresAt) : 'бессрочно' },
                { key: 'api', label: 'Через API', children: v.createdViaApi ? 'да' : 'нет' },
              ]}
            />

            {images.length > 0 && (
              <Card size="small" title="Фото">
                <Image.PreviewGroup>
                  <Space wrap size={8}>
                    {images.map((im) => (
                      <div key={im.label} style={{ textAlign: 'center' }}>
                        <Image src={im.src} height={140} style={{ objectFit: 'cover' }} />
                        <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                          {im.label}
                        </Text>
                      </div>
                    ))}
                  </Space>
                </Image.PreviewGroup>
              </Card>
            )}

            {videos.length > 0 && (
              <Card size="small" title="Видео">
                <Space wrap size={8}>
                  {videos.map((vd) => (
                    <div key={vd.label}>
                      <video src={vd.src} controls style={{ maxWidth: 360, maxHeight: 240 }} />
                      <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                        {vd.label}
                      </Text>
                    </div>
                  ))}
                </Space>
              </Card>
            )}

            {!images.length && !videos.length && !detail.isFetching && (
              <Alert type="info" showIcon message="Медиа по этой верификации провайдер не отдал" />
            )}
          </Space>
        )}
      </Drawer>
    </List>
  )
}
