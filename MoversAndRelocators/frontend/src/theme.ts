import type { ThemeConfig } from 'antd'

/**
 * Crateway design tokens: the one place colours, type, radii and control sizes are defined.
 * Ant Design components read them through `appTheme`; custom CSS reads the same values as `--cw-*`
 * variables declared at the top of styles.css. Change a value here and in that :root block together.
 * Every text colour passes WCAG AA (4.5:1) on white and on the page background.
 */
export const tokens = {
  forest: '#0e2a1f',        // sidebar and dark surfaces
  brand: '#176b52',         // primary buttons, links, active states (6.4:1 with white text)
  brandHover: '#125a45',
  brandSoft: '#eef7f2',     // selected rows, table headers, soft highlights
  gold: '#a86f00',          // brand accent, used rarely
  ink: '#18241f',           // main text (16:1)
  text2: '#4b5b54',         // secondary text (7.2:1)
  muted: '#5c6b64',         // captions, help text, column labels (5.6:1) — the lightest text colour allowed
  line: '#dde5e0',          // borders and dividers
  lineSoft: '#e8eeea',
  canvas: '#f5f7f6',        // page background
  surface: '#ffffff',
  success: '#17663f', warning: '#9a5b00', danger: '#b42318', info: '#1d5fa8',
  font: "Inter, 'Segoe UI', system-ui, sans-serif",
  display: "Manrope, Inter, 'Segoe UI', sans-serif",  // page titles and large numbers only
} as const

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: tokens.brand, colorInfo: tokens.brand, colorLink: tokens.brand,
    colorSuccess: tokens.success, colorWarning: '#b26b00', colorError: tokens.danger,
    // Soft status fills are set explicitly: derived from the darker status colours they come out muddy.
    colorSuccessBg: '#e6f4ec', colorSuccessBorder: '#b7dfc6', colorWarningBg: '#fff4e0', colorWarningBorder: '#f3d49a',
    colorErrorBg: '#fdecea', colorErrorBorder: '#f5c2bc',
    colorText: tokens.ink, colorTextHeading: tokens.ink, colorTextSecondary: tokens.text2, colorTextTertiary: tokens.muted,
    colorTextDescription: tokens.muted, colorTextPlaceholder: '#7d8a84',
    colorBorder: '#d3ddd8', colorBorderSecondary: tokens.lineSoft, colorSplit: tokens.lineSoft,
    colorBgLayout: tokens.canvas, colorBgContainer: tokens.surface,
    fontFamily: tokens.font, fontSize: 14, fontSizeSM: 12,
    borderRadius: 6, borderRadiusSM: 4, borderRadiusLG: 10,
    controlHeight: 32,
  },
  components: {
    Layout: { siderBg: tokens.forest, bodyBg: tokens.canvas },
    Menu: { darkItemBg: tokens.forest, darkSubMenuItemBg: tokens.forest, darkItemSelectedBg: '#245441' },
    Table: { headerBg: '#f7f9f8', headerColor: tokens.muted, rowHoverBg: '#f3f9f6' },
    Tag: { defaultColor: tokens.text2 },
  },
}
