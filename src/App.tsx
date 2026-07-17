import { Refine, Authenticated } from '@refinedev/core'
import { useNotificationProvider, ErrorComponent } from '@refinedev/antd'
import routerProvider, { NavigateToResource, CatchAllNavigate } from '@refinedev/react-router'
import { BrowserRouter, Routes, Route, Outlet } from 'react-router'
import { App as AntdApp, ConfigProvider } from 'antd'
import ruRU from 'antd/locale/ru_RU'
import {
  SwapOutlined,
  FileTextOutlined,
  ApartmentOutlined,
  TeamOutlined,
  CreditCardOutlined,
  CalculatorOutlined,
  DesktopOutlined,
  NotificationOutlined,
  GlobalOutlined,
  ApiOutlined,
  RollbackOutlined,
  DollarOutlined,
  BankOutlined,
  PercentageOutlined,
  ShopOutlined,
  BranchesOutlined,
  SafetyCertificateOutlined,
  IdcardOutlined,
  ExportOutlined,
  SecurityScanOutlined,
  FileProtectOutlined,
  AuditOutlined,
  SolutionOutlined,
  ClusterOutlined,
  WalletOutlined,
  ProfileOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
  MobileOutlined,
  ShoppingOutlined,
  SoundOutlined,
  SettingOutlined,
  SafetyOutlined,
  ToolOutlined,
  BarChartOutlined,
} from '@ant-design/icons'
import '@refinedev/antd/dist/reset.css'
import './styles/onec.css'

import { oneCTheme } from './theme'
import { dataProvider } from './api/dataProvider'
import { authProvider } from './api/authProvider'
import { accessControlProvider } from './api/accessControl'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/login'
import { AdminUsers } from './pages/admin-users'
import { AdminRoles } from './pages/admin-roles'
import { TransactionList } from './pages/transactions/list'
import { InvoiceList } from './pages/invoices/list'
import { PartnerList } from './pages/partners/list'
import { UserList } from './pages/users/list'
import { PayoutList } from './pages/payouts/list'
import { PayoutSheet } from './pages/payout-sheet'
import { TerminalList } from './pages/terminals/list'
import { InfoBotPage } from './pages/info-bot'
import { EsimPage } from './pages/esim'
import { WebhookList } from './pages/webhooks/list'
import { RefundList } from './pages/refunds/list'
import { FinancePage } from './pages/finance'
import { SettlementsPage } from './pages/settlements'
import { WithdrawalList } from './pages/withdrawals/list'
import { MarkupList } from './pages/markups/list'
import { PosMarkupList } from './pages/pos-markups/list'
import { ReferralOverrideList } from './pages/referral-overrides/list'
import { KycBillingList } from './pages/kyc-billing/list'
import { KycVerificationList } from './pages/kyc-verifications/list'
import { DeclarationList } from './pages/declarations/list'
import { HierarchyPage } from './pages/hierarchy'
import { AmlGuardPage } from './pages/aml-guard'
import { PayerAuditPage } from './pages/payer-audit'
import { PartnerModerationPage } from './pages/partner-moderation'
import { VccPage } from './pages/vcc'
import { ApiLogList } from './pages/api-logs/list'
import { AuditLogList } from './pages/audit-logs/list'
import { MiniappOrders } from './pages/miniapp-orders'
import { MiniappUsers } from './pages/miniapp-users'
import { MiniappBroadcast } from './pages/miniapp-broadcast'
import { MiniappReferrals } from './pages/miniapp-referrals'
import { MiniappMaintenance } from './pages/miniapp-maintenance'
import { Reports } from './pages/reports'

export default function App() {
  return (
    <BrowserRouter>
      <ConfigProvider locale={ruRU} theme={oneCTheme}>
        <AntdApp>
          <Refine
            dataProvider={dataProvider}
            routerProvider={routerProvider}
            authProvider={authProvider}
            accessControlProvider={accessControlProvider}
            notificationProvider={useNotificationProvider}
            options={{ syncWithLocation: true, warnWhenUnsavedChanges: true }}
            resources={[
              {
                name: 'transactions',
                list: '/transactions',
                meta: { label: 'Транзакции', icon: <SwapOutlined /> },
              },
              {
                name: 'invoices',
                list: '/invoices',
                meta: { label: 'Инвойсы', icon: <FileTextOutlined /> },
              },
              {
                name: 'partners',
                list: '/partners',
                meta: { label: 'Партнёры', icon: <ApartmentOutlined /> },
              },
              {
                name: 'partner-moderation',
                list: '/partner-moderation',
                meta: { label: 'Модерация', icon: <SolutionOutlined /> },
              },
              {
                name: 'hierarchy',
                list: '/hierarchy',
                meta: { label: 'Иерархия', icon: <ClusterOutlined /> },
              },
              {
                name: 'users',
                list: '/users',
                meta: { label: 'Пользователи', icon: <TeamOutlined /> },
              },
              {
                name: 'refund-requests',
                list: '/refund-requests',
                meta: { label: 'Возвраты', icon: <RollbackOutlined /> },
              },

              // ── Финансы ──────────────────────────────────────────────
              { name: 'money', meta: { label: 'Финансы', icon: <DollarOutlined /> } },
              {
                name: 'finance',
                list: '/finance',
                meta: { label: 'Сводка', parent: 'money', icon: <DollarOutlined /> },
              },
              {
                name: 'settlements',
                list: '/settlements',
                meta: { label: 'Расчёты', parent: 'money', icon: <BankOutlined /> },
              },
              {
                name: 'payouts',
                list: '/payouts',
                meta: { label: 'Выплаты', parent: 'money', icon: <CreditCardOutlined /> },
              },
              {
                name: 'withdrawals',
                list: '/withdrawals',
                meta: { label: 'Выводы', parent: 'money', icon: <ExportOutlined /> },
              },
              {
                name: 'payout-sheet',
                list: '/payout-sheet',
                meta: { label: 'Расчёт заработка', parent: 'money', icon: <CalculatorOutlined /> },
              },
              {
                name: 'markups',
                list: '/markups',
                meta: { label: 'Наценки', parent: 'money', icon: <PercentageOutlined /> },
              },
              {
                name: 'pos-markups',
                list: '/pos-markups',
                meta: { label: 'POS-наценки', parent: 'money', icon: <ShopOutlined /> },
              },
              {
                name: 'referral-overrides',
                list: '/referral-overrides',
                meta: { label: 'Реф. наценки', parent: 'money', icon: <BranchesOutlined /> },
              },
              {
                name: 'vcc',
                list: '/vcc',
                meta: { label: 'Виртуальные карты', parent: 'money', icon: <WalletOutlined /> },
              },
              {
                name: 'reports',
                list: '/reports',
                meta: { label: 'Отчёты по партнёрам', parent: 'money', icon: <BarChartOutlined /> },
              },

              // ── Безопасность ─────────────────────────────────────────
              { name: 'security', meta: { label: 'Безопасность', icon: <SecurityScanOutlined /> } },
              {
                name: 'aml-guard',
                list: '/aml-guard',
                meta: { label: 'AML-Guard', parent: 'security', icon: <SecurityScanOutlined /> },
              },
              {
                name: 'payer-audit',
                list: '/payer-audit',
                meta: { label: 'Аудит плательщиков', parent: 'security', icon: <AuditOutlined /> },
              },
              {
                name: 'declarations',
                list: '/declarations',
                meta: { label: 'Декларации', parent: 'security', icon: <FileProtectOutlined /> },
              },

              // ── Журналы ──────────────────────────────────────────────
              { name: 'logs', meta: { label: 'Журналы', icon: <ProfileOutlined /> } },
              {
                name: 'api-logs',
                list: '/api-logs',
                meta: { label: 'API-логи', parent: 'logs', icon: <ThunderboltOutlined /> },
              },
              {
                name: 'audit-logs',
                list: '/audit-logs',
                meta: { label: 'Аудит действий', parent: 'logs', icon: <HistoryOutlined /> },
              },

              // ── KYC ──────────────────────────────────────────────────
              { name: 'kyc', meta: { label: 'KYC', icon: <SafetyCertificateOutlined /> } },
              {
                name: 'kyc-verifications',
                list: '/kyc-verifications',
                meta: { label: 'Верификации', parent: 'kyc', icon: <IdcardOutlined /> },
              },
              {
                name: 'kyc-billing',
                list: '/kyc-billing',
                meta: { label: 'Биллинг', parent: 'kyc', icon: <SafetyCertificateOutlined /> },
              },
              {
                name: 'terminals',
                list: '/terminals',
                meta: { label: 'Терминалы', icon: <DesktopOutlined /> },
              },
              {
                name: 'info-bot',
                list: '/info-bot',
                meta: { label: 'Info-бот', icon: <NotificationOutlined /> },
              },
              {
                name: 'webhooks',
                list: '/webhooks',
                meta: { label: 'Вебхуки', icon: <ApiOutlined /> },
              },
              {
                name: 'esim',
                list: '/esim',
                meta: { label: 'eSIM', icon: <GlobalOutlined /> },
              },
              // ── Мини-апп ─────────────────────────────────────────────
              { name: 'miniapp', meta: { label: 'Мини-апп', icon: <MobileOutlined /> } },
              {
                name: 'miniapp-orders',
                list: '/miniapp-orders',
                meta: { label: 'Заказы', parent: 'miniapp', icon: <ShoppingOutlined /> },
              },
              {
                name: 'miniapp-users',
                list: '/miniapp-users',
                meta: { label: 'Пользователи', parent: 'miniapp', icon: <TeamOutlined /> },
              },
              {
                name: 'miniapp-referrals',
                list: '/miniapp-referrals',
                meta: { label: 'Рефералка', parent: 'miniapp', icon: <BranchesOutlined /> },
              },
              {
                name: 'miniapp-broadcast',
                list: '/miniapp-broadcast',
                meta: { label: 'Рассылки', parent: 'miniapp', icon: <SoundOutlined /> },
              },
              {
                name: 'miniapp-maintenance',
                list: '/miniapp-maintenance',
                meta: { label: 'Техработы', parent: 'miniapp', icon: <ToolOutlined /> },
              },

              // ── Администрирование ────────────────────────────────────
              { name: 'admin', meta: { label: 'Администрирование', icon: <SettingOutlined /> } },
              {
                name: 'admin-users',
                list: '/admin-users',
                meta: { label: 'Пользователи системы', parent: 'admin', icon: <IdcardOutlined /> },
              },
              {
                name: 'admin-roles',
                list: '/admin-roles',
                meta: { label: 'Роли', parent: 'admin', icon: <SafetyOutlined /> },
              },
            ]}
          >
            <Routes>
              {/* Без сессии любой адрес уводит на вход. */}
              <Route
                element={
                  <Authenticated key="in" fallback={<CatchAllNavigate to="/login" />}>
                    <Layout>
                      <Outlet />
                    </Layout>
                  </Authenticated>
                }
              >
                <Route index element={<NavigateToResource resource="transactions" />} />
                <Route path="/transactions" element={<TransactionList />} />
                <Route path="/invoices" element={<InvoiceList />} />
                <Route path="/partners" element={<PartnerList />} />
                <Route path="/users" element={<UserList />} />
                <Route path="/payouts" element={<PayoutList />} />
                <Route path="/payout-sheet" element={<PayoutSheet />} />
                <Route path="/refund-requests" element={<RefundList />} />
                <Route path="/finance" element={<FinancePage />} />
                <Route path="/settlements" element={<SettlementsPage />} />
                <Route path="/withdrawals" element={<WithdrawalList />} />
                <Route path="/markups" element={<MarkupList />} />
                <Route path="/pos-markups" element={<PosMarkupList />} />
                <Route path="/referral-overrides" element={<ReferralOverrideList />} />
                <Route path="/kyc-verifications" element={<KycVerificationList />} />
                <Route path="/kyc-billing" element={<KycBillingList />} />
                <Route path="/partner-moderation" element={<PartnerModerationPage />} />
                <Route path="/hierarchy" element={<HierarchyPage />} />
                <Route path="/aml-guard" element={<AmlGuardPage />} />
                <Route path="/payer-audit" element={<PayerAuditPage />} />
                <Route path="/declarations" element={<DeclarationList />} />
                <Route path="/vcc" element={<VccPage />} />
                <Route path="/api-logs" element={<ApiLogList />} />
                <Route path="/audit-logs" element={<AuditLogList />} />
                <Route path="/miniapp-orders" element={<MiniappOrders />} />
                <Route path="/miniapp-users" element={<MiniappUsers />} />
                <Route path="/miniapp-referrals" element={<MiniappReferrals />} />
                <Route path="/miniapp-broadcast" element={<MiniappBroadcast />} />
                <Route path="/miniapp-maintenance" element={<MiniappMaintenance />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/webhooks" element={<WebhookList />} />
                <Route path="/terminals" element={<TerminalList />} />
                <Route path="/info-bot" element={<InfoBotPage />} />
                <Route path="/esim" element={<EsimPage />} />
                <Route path="/admin-users" element={<AdminUsers />} />
                <Route path="/admin-roles" element={<AdminRoles />} />
                <Route path="*" element={<ErrorComponent />} />
              </Route>

              {/* Вошедшего страница входа не показывает — сразу внутрь. */}
              <Route
                element={
                  <Authenticated key="out" fallback={<Outlet />}>
                    <NavigateToResource resource="transactions" />
                  </Authenticated>
                }
              >
                <Route path="/login" element={<LoginPage />} />
              </Route>
            </Routes>
          </Refine>
        </AntdApp>
      </ConfigProvider>
    </BrowserRouter>
  )
}
