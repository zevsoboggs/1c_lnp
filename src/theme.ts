import type { ThemeConfig } from 'antd'

/**
 * Стилизация под новый интерфейс 1С:Предприятие 8.5.
 *
 * Отличия от прежней темы «Такси»: светлый сайдбар с серыми иконками вместо
 * жёлтого, светло-серый фон с контентом в белых карточках, крупные скругления,
 * синий primary-акцент, статусы-пилюли. Всё задаётся токенами AntD, чтобы
 * стиль лёг на все страницы разом.
 */

export const C1 = {
  // Фон приложения и карточки контента — светлые (новый UI 8.5).
  appBg: '#f3f4f6',
  cardBg: '#ffffff',
  // Сайдбар — жёлтый, как в интерфейсе «Такси» 1С (по просьбе). Контент
  // при этом остаётся светлым и современным.
  sidebarBg: '#FCF6D8',
  sidebarHover: '#F6EBAF',
  sidebarActive: '#F1DE86',
  sidebarBorder: '#E8DCAE',
  sidebarText: '#3a3a3a',
  sidebarLink: '#0D5AA7',
  // Синий акцент нового UI 1С (для контента).
  primary: '#1668dc',
  link: '#1668dc',
  icon: '#6b6b70',
  border: '#e4e4e7',
  gridBorder: '#eeeef0',
  headerBg: '#f7f7f8',
  rowHover: '#f6f9fe',
  rowSelected: '#eaf2fd',
  text: '#1a1a1c',
  textSecondary: '#71717a',
} as const

export const oneCTheme: ThemeConfig = {
  token: {
    colorPrimary: C1.primary,
    colorLink: C1.link,
    colorLinkHover: '#4090f0',
    colorText: C1.text,
    colorTextSecondary: C1.textSecondary,
    colorBorder: C1.border,
    colorBorderSecondary: C1.gridBorder,
    colorBgLayout: C1.appBg,
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    fontSize: 13,
    controlHeight: 32,
    fontFamily:
      "'Inter', 'Segoe UI', 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  },
  components: {
    Layout: {
      siderBg: C1.sidebarBg,
      bodyBg: C1.appBg,
      headerBg: C1.cardBg,
    },
    Menu: {
      itemBg: 'transparent',
      subMenuItemBg: 'transparent',
      itemColor: C1.sidebarText,
      itemHoverBg: C1.sidebarHover,
      itemHoverColor: C1.sidebarText,
      itemSelectedBg: C1.sidebarActive,
      itemSelectedColor: C1.sidebarLink,
      itemBorderRadius: 8,
      // Меньше отступов по бокам — длинным названиям («Администрирование»)
      // нужно больше места, чтобы не обрезаться.
      itemMarginInline: 6,
      itemMarginBlock: 2,
      itemHeight: 34,
      iconSize: 16,
      groupTitleColor: '#8a7f52',
    },
    Table: {
      headerBg: C1.headerBg,
      headerColor: C1.textSecondary,
      headerSplitColor: 'transparent',
      borderColor: C1.gridBorder,
      rowHoverBg: C1.rowHover,
      rowSelectedBg: C1.rowSelected,
      rowSelectedHoverBg: C1.rowSelected,
      cellPaddingBlockSM: 7,
      cellPaddingInlineSM: 10,
      headerBorderRadius: 0,
      fontSize: 13,
    },
    Card: {
      borderRadiusLG: 12,
      paddingLG: 16,
      colorBorderSecondary: C1.border,
    },
    Button: {
      borderRadius: 8,
      controlHeight: 32,
      defaultBg: '#ffffff',
      defaultBorderColor: C1.border,
      primaryShadow: 'none',
      defaultShadow: 'none',
    },
    Select: { borderRadius: 8, controlHeight: 32 },
    Input: { borderRadius: 8, controlHeight: 32 },
    DatePicker: { borderRadius: 8, controlHeight: 32 },
    // Статусы-пилюли: без рамки, скруглённые, мягкий фон.
    Tag: { borderRadiusSM: 10, defaultBg: '#f1f1f3' },
    Tabs: { horizontalItemPadding: '10px 4px', titleFontSize: 14 },
    Statistic: { titleFontSize: 12 },
    Drawer: { paddingLG: 20 },
    Modal: { borderRadiusLG: 14 },
  },
}
