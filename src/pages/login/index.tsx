import { useState } from 'react'
import { useLogin } from '@refinedev/core'
import { Input, Button, Alert, Form } from 'antd'
import { LockOutlined, UserOutlined } from '@ant-design/icons'
import { Logo } from '../../components/Logo'

/**
 * Вход в админку.
 *
 * Прежний экран повторял окно запуска 1С: рамка, сетчатый фон, подписи слева
 * от полей. На телефоне это разваливалось — колонка подписей в 110 px съедала
 * половину ширины, а поля оставались в узком остатке.
 *
 * Здесь одна карточка по центру: на широком экране рядом с ней полоса с именем
 * системы, на узком — только карточка во всю ширину. Подписи над полями, а не
 * сбоку: так они не отнимают ширину у ввода.
 */
export function LoginPage() {
  const { mutate: login, isPending } = useLogin()
  const [error, setError] = useState<string | null>(null)
  const [form] = Form.useForm()

  const submit = async () => {
    const v = await form.validateFields()
    setError(null)
    login(
      { username: v.username.trim(), password: v.password },
      {
        onSuccess: (data: any) => {
          if (!data?.success) setError(data?.error?.message ?? 'Не удалось войти')
        },
        onError: (e: any) => setError(e?.message ?? 'Не удалось войти'),
      },
    )
  }

  return (
    <div className="onec-login">
      <div className="onec-login__card">
        <aside className="onec-login__side">
          <span className="onec-login__logo">
            <Logo height={34} />
          </span>
          <div>
            <p className="onec-login__title">
              Love<span className="onec-login__amp">&</span>Pay
            </p>
            <p className="onec-login__subtitle">Административная панель</p>
          </div>
          <p className="onec-login__note">
            Доступ только для сотрудников. Действия записываются в журнал.
          </p>
        </aside>

        <div className="onec-login__form">
          <div className="onec-login__brand-mobile">
            <span className="onec-login__logo">
              <Logo height={28} />
            </span>
            <p className="onec-login__title">
              Love<span className="onec-login__amp">&</span>Pay
            </p>
          </div>

          <h1 className="onec-login__heading">Вход в систему</h1>

          {error && (
            <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />
          )}

          <Form form={form} layout="vertical" size="large" onFinish={submit} requiredMark={false}>
            <Form.Item
              name="username"
              label="Пользователь"
              rules={[{ required: true, message: 'Введите логин' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#9ca3af' }} />}
                autoFocus
                autoComplete="username"
                placeholder="admin"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label="Пароль"
              rules={[{ required: true, message: 'Введите пароль' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#9ca3af' }} />}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={isPending} block size="large">
              Войти
            </Button>
          </Form>

          <p className="onec-login__foot">© Love&Pay, {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  )
}
