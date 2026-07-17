import type { ThemeConfig } from 'antd'

/**
 * Стилизация под интерфейс «Такси» из 1С:Предприятие.
 *
 * Опорные признаки оригинала: жёлтая боковая панель с синими ссылками-пунктами,
 * почти прямые углы, плотная сетка с мелким шрифтом, жёлтая подсветка строки,
 * серые плоские кнопки. Всё задаётся токенами AntD, чтобы не городить CSS-хаки.
 */

export const C1 = {
  sidebarBg: '#FDF6D3',
  sidebarHover: '#FBEDA8',
  sidebarActive: '#F7E58B',
  link: '#0D5AA7',
  headerBg: '#F2F2F2',
  rowHover: '#FFFCE8',
  rowSelected: '#FFF7C4',
  border: '#D4D4D4',
  gridBorder: '#E4E4E4',
  text: '#1A1A1A',
} as const

export const oneCTheme: ThemeConfig = {
  token: {
    colorPrimary: C1.link,
    colorLink: C1.link,
    colorLinkHover: '#1273CE',
    colorText: C1.text,
    colorBorder: C1.border,
    borderRadius: 2,
    fontSize: 13,
    controlHeight: 28,
    fontFamily:
      "'Segoe UI', 'Helvetica Neue', Arial, 'Noto Sans', sans-serif",
  },
  components: {
    Layout: {
      siderBg: C1.sidebarBg,
      bodyBg: '#FFFFFF',
      headerBg: '#FFFFFF',
    },
    Menu: {
      itemBg: C1.sidebarBg,
      subMenuItemBg: C1.sidebarBg,
      itemColor: C1.link,
      itemHoverBg: C1.sidebarHover,
      itemHoverColor: C1.link,
      itemSelectedBg: C1.sidebarActive,
      itemSelectedColor: C1.text,
      itemBorderRadius: 0,
      itemMarginInline: 0,
      itemMarginBlock: 0,
      itemHeight: 34,
      iconSize: 15,
    },
    Table: {
      headerBg: C1.headerBg,
      headerColor: C1.text,
      headerSplitColor: C1.border,
      borderColor: C1.gridBorder,
      rowHoverBg: C1.rowHover,
      rowSelectedBg: C1.rowSelected,
      rowSelectedHoverBg: C1.rowSelected,
      cellPaddingBlockSM: 5,
      cellPaddingInlineSM: 8,
      headerBorderRadius: 0,
      fontSize: 12.5,
    },
    Card: {
      borderRadiusLG: 2,
      paddingLG: 12,
    },
    Button: {
      borderRadius: 2,
      defaultBg: '#FCFCFC',
      defaultBorderColor: '#C6C6C6',
    },
    Select: { borderRadius: 2 },
    Input: { borderRadius: 2 },
    Tag: { borderRadiusSM: 2 },
  },
}
