import { useState } from 'react'
import { useLogin } from '@refinedev/core'
import { Input, Button, Typography, Alert, Space } from 'antd'
import { Logo } from '../../components/Logo'

const { Text } = Typography

/**
 * Экран входа в духе 1С:Предприятие: рамка с сетчатым фоном, карточка
 * с подписями слева от полей, кнопки «Войти» / «Отмена» и плашка внизу.
 */
export function LoginPage() {
  const { mutate: login, isPending } = useLogin()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    if (!username.trim() || !password) {
      setError('Введите логин и пароль')
      return
    }
    setError(null)
    login(
      { username: username.trim(), password },
      {
        onSuccess: (data: any) => {
          if (!data?.success) setError(data?.error?.message ?? 'Не удалось войти')
        },
        onError: (e: any) => setError(e?.message ?? 'Не удалось войти'),
      },
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff',
        padding: 20,
      }}
    >
      <div style={{ width: 620, border: '1px solid #d9d9d9', background: '#fff' }}>
        {/* Сетчатый фон — как в оригинальном окне запуска 1С. */}
        <div
          style={{
            position: 'relative',
            padding: '56px 24px',
            backgroundColor: '#fdfdfd',
            backgroundImage: `
              radial-gradient(circle at 18% 30%, #e8e8e8 3px, transparent 3px),
              radial-gradient(circle at 62% 16%, #e8e8e8 5px, transparent 5px),
              radial-gradient(circle at 88% 42%, #ececec 4px, transparent 4px),
              radial-gradient(circle at 30% 78%, #ececec 6px, transparent 6px),
              radial-gradient(circle at 76% 84%, #e8e8e8 3px, transparent 3px),
              linear-gradient(115deg, transparent 49.7%, #f0f0f0 49.7%, #f0f0f0 50%, transparent 50%),
              linear-gradient(65deg, transparent 49.8%, #f0f0f0 49.8%, #f0f0f0 50%, transparent 50%),
              linear-gradient(160deg, transparent 49.8%, #f2f2f2 49.8%, #f2f2f2 50%, transparent 50%)
            `,
          }}
        >
          <div
            style={{
              width: 440,
              margin: '0 auto',
              background: '#fff',
              border: '1px solid #c9c9c9',
              padding: '18px 22px 20px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ fontSize: 19, color: '#3d3d3d', marginBottom: 18 }}>
              Love<span style={{ color: '#E4002B' }}>&</span>Pay — Админка
            </div>

            {error && (
              <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />
            )}

            {/* Подписи слева от полей — ключевая примета окна 1С. */}
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: '10px 8px', alignItems: 'center' }}>
              <Text style={{ textAlign: 'right', fontSize: 13 }}>Пользователь:</Text>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onPressEnter={submit}
                autoFocus
                autoComplete="username"
              />

              <Text style={{ textAlign: 'right', fontSize: 13 }}>Пароль:</Text>
              <Input.Password
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onPressEnter={submit}
                autoComplete="current-password"
              />
            </div>

            <Space style={{ marginTop: 18, justifyContent: 'center', width: '100%' }} size={8}>
              <Button type="primary" onClick={submit} loading={isPending} style={{ minWidth: 92 }}>
                Войти
              </Button>
              <Button
                onClick={() => {
                  setUsername('')
                  setPassword('')
                  setError(null)
                }}
                style={{ minWidth: 92 }}
              >
                Отмена
              </Button>
            </Space>
          </div>
        </div>

        <div
          style={{
            background: '#f0f0f0',
            borderTop: '1px solid #d9d9d9',
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.3, color: '#3d3d3d' }}>
              LOVE&PAY АДМИНКА
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              © Love&Pay, {new Date().getFullYear()}
            </Text>
          </div>
          <span style={{ color: '#E4002B' }}>
            <Logo height={30} />
          </span>
        </div>
      </div>
    </div>
  )
}
