import { theme as antdTheme } from 'antd';

/**
 * Monochrome design tokens — the single source of truth for the portal's
 * palette. The same values are mirrored as CSS variables in `src/index.css`
 * (`--g-*`, `--c-*`) so inline styles and Tailwind classes stay in sync.
 *
 * Only black, white and a neutral gray ramp are allowed. State is conveyed
 * with contrast, weight, fill vs. outline, borders, icons and text.
 */
export const INK = '#0a0a0a';
export const PAPER = '#ffffff';

export const GRAY = {
  50: '#fafafa',
  100: '#f4f4f4',
  150: '#ededed',
  200: '#e4e4e4',
  300: '#d1d1d1',
  400: '#a3a3a3',
  500: '#737373',
  600: '#525252',
  700: '#3d3d3d',
  800: '#262626',
  850: '#1c1c1c',
  900: '#141414',
};

export const FONT_DISPLAY = '"Archivo", "Helvetica Neue", Arial, sans-serif';
export const FONT_BODY = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif';
export const FONT_MONO = '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, monospace';

/** Per-mode semantic colours fed into the antd theme. */
const MODES = {
  light: {
    fg: INK,
    fg2: GRAY[600],
    fg3: GRAY[500],
    fg4: GRAY[400],
    bg: PAPER,
    layout: GRAY[100],
    surface2: GRAY[50],
    elevated: PAPER,
    line: GRAY[200],
    line2: GRAY[150],
    lineStrong: GRAY[300],
    fill: GRAY[100],
    fill2: GRAY[150],
    onInk: PAPER,
    warn: GRAY[700],
  },
  dark: {
    fg: '#fafafa',
    fg2: '#b8b8b8',
    fg3: '#929292',
    fg4: '#6b6b6b',
    bg: GRAY[900],
    layout: INK,
    surface2: GRAY[850],
    elevated: GRAY[850],
    line: '#2e2e2e',
    line2: '#242424',
    lineStrong: '#424242',
    fill: GRAY[850],
    fill2: GRAY[800],
    onInk: INK,
    warn: GRAY[300],
  },
};

export function buildAntdTheme(mode = 'light') {
  const c = MODES[mode] || MODES.light;
  const dark = mode === 'dark';

  return {
    algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      // Palette — every status colour collapses onto the monochrome ramp.
      colorPrimary: c.fg,
      colorInfo: c.fg,
      colorSuccess: c.fg,
      colorWarning: c.warn,
      colorError: c.fg,
      colorLink: c.fg,
      colorLinkHover: c.fg2,
      colorLinkActive: c.fg,
      colorTextBase: c.fg,
      colorBgBase: c.bg,
      colorText: c.fg,
      colorTextSecondary: c.fg2,
      colorTextTertiary: c.fg3,
      colorTextQuaternary: c.fg4,
      colorTextLightSolid: c.onInk,
      colorTextPlaceholder: c.fg3,
      colorBgLayout: c.layout,
      colorBgContainer: c.bg,
      colorBgElevated: c.elevated,
      colorBgSpotlight: c.fg,
      colorBgMask: dark ? 'rgba(0,0,0,0.72)' : 'rgba(10,10,10,0.55)',
      colorBorder: c.lineStrong,
      colorBorderSecondary: c.line,
      colorSplit: c.line,
      colorFill: c.fill2,
      colorFillSecondary: c.fill,
      colorFillTertiary: c.surface2,
      colorFillQuaternary: c.surface2,
      controlItemBgHover: c.fill,
      controlItemBgActive: c.fill2,
      controlItemBgActiveHover: c.fill2,
      controlOutline: dark ? 'rgba(250,250,250,0.18)' : 'rgba(10,10,10,0.12)',
      controlOutlineWidth: 2,
      lineWidthFocus: 2,

      // Type
      fontFamily: FONT_BODY,
      fontFamilyCode: FONT_MONO,
      fontSize: 13,
      fontSizeHeading1: 34,
      fontSizeHeading2: 26,
      fontSizeHeading3: 21,
      fontSizeHeading4: 17,
      fontSizeHeading5: 15,
      fontWeightStrong: 650,

      // Shape & rhythm
      borderRadius: 4,
      borderRadiusXS: 2,
      borderRadiusSM: 3,
      borderRadiusLG: 6,
      controlHeight: 34,
      controlHeightSM: 26,
      controlHeightLG: 42,
      boxShadow: dark
        ? '0 0 0 1px #2e2e2e, 0 12px 32px rgba(0,0,0,0.6)'
        : '0 0 0 1px rgba(10,10,10,0.08), 0 12px 32px -8px rgba(10,10,10,0.18)',
      boxShadowSecondary: dark
        ? '0 0 0 1px #2e2e2e, 0 12px 32px rgba(0,0,0,0.6)'
        : '0 0 0 1px rgba(10,10,10,0.08), 0 12px 32px -8px rgba(10,10,10,0.18)',
      boxShadowTertiary: 'none',

      // Motion — short and quiet
      motionDurationFast: '0.12s',
      motionDurationMid: '0.18s',
      motionDurationSlow: '0.2s',
      wireframe: false,
    },
    components: {
      Layout: {
        bodyBg: c.layout,
        headerBg: c.bg,
        siderBg: INK,
      },
      Menu: {
        itemBorderRadius: 3,
        subMenuItemBorderRadius: 3,
        itemSelectedBg: c.fill2,
        itemSelectedColor: c.fg,
        itemHoverBg: c.fill,
        itemActiveBg: c.fill2,
        activeBarBorderWidth: 0,
      },
      Button: {
        fontWeight: 600,
        primaryShadow: 'none',
        defaultShadow: 'none',
        dangerShadow: 'none',
        defaultBorderColor: c.lineStrong,
        defaultColor: c.fg,
        defaultBg: c.bg,
        defaultHoverBorderColor: c.fg,
        defaultHoverColor: c.fg,
        defaultHoverBg: c.bg,
        defaultActiveBorderColor: c.fg,
        defaultActiveColor: c.fg,
        textHoverBg: c.fill,
        primaryColor: c.onInk,
        dangerColor: c.onInk,
        paddingInline: 14,
        contentFontSizeSM: 12,
      },
      Table: {
        headerBg: c.bg,
        headerColor: c.fg,
        headerSplitColor: 'transparent',
        headerBorderRadius: 0,
        borderColor: c.line,
        rowHoverBg: c.surface2,
        rowSelectedBg: c.fill,
        rowSelectedHoverBg: c.fill2,
        rowExpandedBg: c.surface2,
        cellPaddingBlock: 12,
        cellPaddingInline: 14,
        cellPaddingBlockMD: 10,
        footerBg: c.bg,
        fixedHeaderSortActiveBg: c.fill,
        headerSortActiveBg: c.fill,
        headerSortHoverBg: c.surface2,
        bodySortBg: c.surface2,
        headerFilterHoverBg: c.fill,
      },
      Card: {
        headerFontSize: 15,
        headerFontSizeSM: 14,
        headerHeight: 52,
        colorBorderSecondary: c.line,
        actionsBg: c.surface2,
      },
      Modal: {
        contentBg: c.elevated,
        headerBg: c.elevated,
        footerBg: c.elevated,
        titleFontSize: 17,
        titleColor: c.fg,
      },
      Drawer: {
        colorBgElevated: c.elevated,
        footerPaddingBlock: 12,
      },
      Input: {
        activeBorderColor: c.fg,
        hoverBorderColor: c.fg3,
        activeShadow: `0 0 0 3px ${dark ? 'rgba(250,250,250,0.14)' : 'rgba(10,10,10,0.08)'}`,
        errorActiveShadow: `0 0 0 3px ${dark ? 'rgba(250,250,250,0.18)' : 'rgba(10,10,10,0.12)'}`,
        warningActiveShadow: `0 0 0 3px ${dark ? 'rgba(250,250,250,0.18)' : 'rgba(10,10,10,0.12)'}`,
      },
      InputNumber: {
        activeBorderColor: c.fg,
        hoverBorderColor: c.fg3,
      },
      Mentions: {
        activeBorderColor: c.fg,
        hoverBorderColor: c.fg3,
      },
      DatePicker: {
        activeBorderColor: c.fg,
        hoverBorderColor: c.fg3,
        cellActiveWithRangeBg: c.fill,
        cellHoverWithRangeBg: c.fill2,
        cellRangeBorderColor: c.fg3,
      },
      Select: {
        activeBorderColor: c.fg,
        hoverBorderColor: c.fg3,
        optionSelectedBg: c.fill,
        optionSelectedColor: c.fg,
        optionSelectedFontWeight: 650,
        optionActiveBg: c.surface2,
        multipleItemBg: c.fill,
        multipleItemBorderColor: c.line,
      },
      Tag: {
        defaultBg: c.surface2,
        defaultColor: c.fg,
      },
      Badge: {
        dotSize: 7,
        indicatorHeight: 18,
        indicatorHeightSM: 14,
        textFontWeight: 650,
        statusSize: 7,
      },
      Tabs: {
        inkBarColor: c.fg,
        itemColor: c.fg2,
        itemSelectedColor: c.fg,
        itemHoverColor: c.fg,
        itemActiveColor: c.fg,
        titleFontSize: 13,
        horizontalItemPadding: '10px 0',
        horizontalItemGutter: 24,
      },
      Segmented: {
        itemSelectedBg: c.fg,
        itemSelectedColor: c.onInk,
        trackBg: c.fill,
        itemColor: c.fg2,
        itemHoverColor: c.fg,
        itemHoverBg: c.fill2,
      },
      Avatar: {
        groupBorderColor: c.bg,
        groupSpace: -6,
      },
      Dropdown: {
        controlItemBgHover: c.fill,
        controlItemBgActive: c.fill2,
        controlItemBgActiveHover: c.fill2,
        paddingBlock: 7,
      },
      Tooltip: {
        colorBgSpotlight: c.fg,
        colorTextLightSolid: c.onInk,
        borderRadius: 3,
      },
      Message: {
        contentBg: c.elevated,
        contentPadding: '10px 16px',
      },
      Notification: {
        colorBgElevated: c.elevated,
      },
      Progress: {
        defaultColor: c.fg,
        remainingColor: c.fill2,
      },
      Switch: {
        handleShadow: 'none',
      },
      Checkbox: {
        borderRadiusSM: 2,
      },
      Pagination: {
        itemActiveBg: c.fg,
        itemActiveColor: c.onInk,
        itemActiveColorHover: c.onInk,
      },
      Result: {
        titleFontSize: 22,
        subtitleFontSize: 13,
      },
      Form: {
        labelColor: c.fg,
        labelFontSize: 12,
        labelRequiredMarkColor: c.fg,
        verticalLabelPadding: '0 0 6px',
      },
      Descriptions: {
        labelColor: c.fg3,
      },
      List: {
        itemPadding: '10px 0',
      },
      Spin: {
        dotSizeSM: 14,
      },
      Skeleton: {
        gradientFromColor: c.fill,
        gradientToColor: c.fill2,
      },
    },
  };
}
