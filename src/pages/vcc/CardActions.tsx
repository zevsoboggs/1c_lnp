import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Modal, Input, InputNumber, Space, Typography, Alert, App, Descriptions, Button } from 'antd'
import { EyeInvisibleOutlined } from '@ant-design/icons'
import { DangerConfirm } from '../../components/DangerAction'
import { vccApi, type Card } from '../../api/vcc'

const { Text, Paragraph } = Typography

/** Показ полного PAN/CVV — отдельным запросом и с явным закрытием. */
export function RevealModal({ card, onClose }: { card: Card | null; onClose: () => void }) {
  const { message } = App.useApp()
  const [data, setData] = useState<{ card_no: string; cvv: string; exp_date: string } | null>(null)

  const load = useMutation({
    mutationFn: () => vccApi.reveal(card!.card_id),
    onSuccess: setData,
    onError: (e: Error) => message.error(e.message),
  })

  const close = () => {
    setData(null)
    onClose()
  }

  return (
    <Modal
      open={!!card}
      title="Реквизиты карты"
      onCancel={close}
      onOk={close}
      okText="Закрыть"
      cancelButtonProps={{ style: { display: 'none' } }}
      destroyOnHidden
      width={480}
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Alert
          type="warning"
          showIcon
          message="Полные данные карты"
          description="Номер и CVV достаточны для оплаты. Не показывайте экран посторонним и не пересылайте эти данные в переписке."
        />
        {!data ? (
          <Button
            type="primary"
            danger
            icon={<EyeInvisibleOutlined />}
            loading={load.isPending}
            onClick={() => load.mutate()}
            block
          >
            Показать номер и CVV
          </Button>
        ) : (
          <Descriptions
            size="small"
            column={1}
            bordered
            items={[
              {
                key: 'n',
                label: 'Номер',
                children: <Text copyable code>{data.card_no}</Text>,
              },
              { key: 'e', label: 'Срок', children: <Text code>{data.exp_date}</Text> },
              { key: 'c', label: 'CVV', children: <Text copyable code>{data.cvv}</Text> },
            ]}
          />
        )}
      </Space>
    </Modal>
  )
}

/** Пополнение и вывод: суммы двигают реальные деньги, потому подтверждаем. */
export function AmountModal({
  card,
  mode,
  onClose,
  onDone,
}: {
  card: Card | null
  mode: 'topup' | 'withdraw'
  onClose: () => void
  onDone: () => void
}) {
  const { message } = App.useApp()
  const [amt, setAmt] = useState<number | null>(null)

  const run = useMutation({
    mutationFn: () =>
      mode === 'topup'
        ? vccApi.topup({ card_id: card!.card_id, amt: String(amt) })
        : vccApi.withdraw({ card_id: card!.card_id, amt: String(amt) }),
    onSuccess: (r: any) => {
      // Провайдер отвечает pending — деньги приходят не мгновенно.
      message.success(
        `${mode === 'topup' ? 'Пополнение' : 'Вывод'} принят${r?.status ? ` · ${r.status}` : ''}. Проверьте статус карты через минуту.`,
        6,
      )
      setAmt(null)
      onDone()
      onClose()
    },
    onError: (e: Error) => message.error(e.message, 8),
  })

  const isTopup = mode === 'topup'

  return (
    <DangerConfirm
      open={!!card}
      title={isTopup ? 'Пополнить карту?' : 'Вывести с карты?'}
      what={
        isTopup
          ? `На карту ${card?.card_no} будет зачислено ${amt ?? 0} ${card?.currency ?? 'USD'}. Сумма спишется с баланса VCC-аккаунта.`
          : `С карты ${card?.card_no} будет списано ${amt ?? 0} ${card?.currency ?? 'USD'} обратно на баланс аккаунта.`
      }
      okText={isTopup ? 'Пополнить' : 'Вывести'}
      loading={run.isPending}
      onOk={() => run.mutate()}
      onCancel={() => {
        setAmt(null)
        onClose()
      }}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Paragraph style={{ marginBottom: 0 }}>
          Баланс карты сейчас:{' '}
          <Text strong>
            {card?.balance} {card?.currency}
          </Text>
        </Paragraph>
        <div>
          <Text style={{ display: 'block', marginBottom: 4 }}>Сумма</Text>
          <InputNumber
            style={{ width: '100%' }}
            min={0.01}
            step={1}
            precision={2}
            value={amt ?? undefined}
            onChange={(v) => setAmt(v ?? null)}
            addonAfter={card?.currency ?? 'USD'}
            autoFocus
          />
        </div>
        {!isTopup && amt != null && card && amt > card.balance && (
          <Alert type="error" showIcon message="Сумма больше баланса карты" />
        )}
      </Space>
    </DangerConfirm>
  )
}

/** Смена email/телефона карты. */
export function ContactModal({
  card,
  field,
  onClose,
  onDone,
}: {
  card: Card | null
  field: 'email' | 'phone'
  onClose: () => void
  onDone: () => void
}) {
  const { message } = App.useApp()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [zone, setZone] = useState('7')

  const run = useMutation({
    mutationFn: () =>
      field === 'email'
        ? vccApi.updateEmail({ card_id: card!.card_id, email })
        : vccApi.updatePhone({ card_id: card!.card_id, phone_number: phone, zone_number: zone }),
    onSuccess: () => {
      message.success('Сохранено')
      setEmail('')
      setPhone('')
      onDone()
      onClose()
    },
    onError: (e: Error) => message.error(e.message),
  })

  return (
    <Modal
      open={!!card}
      title={field === 'email' ? 'Email карты' : 'Телефон карты'}
      okText="Сохранить"
      cancelText="Отмена"
      confirmLoading={run.isPending}
      onOk={() => run.mutate()}
      onCancel={onClose}
      destroyOnHidden
      width={440}
    >
      {field === 'email' ? (
        <div>
          <Text style={{ display: 'block', marginBottom: 4 }}>Новый email</Text>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </div>
      ) : (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <div>
            <Text style={{ display: 'block', marginBottom: 4 }}>Код страны</Text>
            <Input value={zone} onChange={(e) => setZone(e.target.value)} style={{ width: 100 }} />
          </div>
          <div>
            <Text style={{ display: 'block', marginBottom: 4 }}>Номер</Text>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </Space>
      )}
    </Modal>
  )
}
