/**
 * Design system tokens — Energy Hub Partner App.
 *
 * Light is a cool paper surface with cobalt and solar accents.
 * Dark is a deep navy field with lifted cards, bright brand ink,
 * and the same accent language so both modes feel like one product.
 */

export type AppearanceMode = 'light' | 'dark';
export type ColorPalette = 'ocean' | 'solar' | 'forest' | 'violet';

export const COLOR_PALETTES = ['ocean', 'solar', 'forest', 'violet'] as const;

export const isColorPalette = (value: unknown): value is ColorPalette => (
  typeof value === 'string' && (COLOR_PALETTES as readonly string[]).includes(value)
);

const paletteInk = {
  ocean: { light: '#155EEF', dark: '#2F6FE0', ink: '#123B78', inkDark: '#D6E4FF', wash: '#E7EEFF', washDark: '#1A2C4E' },
  solar: { light: '#E66B12', dark: '#C6530A', ink: '#8A3E00', inkDark: '#FFD8BA', wash: '#FFF0E4', washDark: '#3A2416' },
  forest: { light: '#0F7A52', dark: '#0E8A5B', ink: '#0B5136', inkDark: '#C8F6E0', wash: '#E5F6EE', washDark: '#13281F' },
  violet: { light: '#6D3CC9', dark: '#7C4DDB', ink: '#4C248F', inkDark: '#E6DBFF', wash: '#F1E9FF', washDark: '#261A3E' },
} as const;

export function createThemeColors(mode: AppearanceMode, palette: ColorPalette = 'ocean') {
  const ink = paletteInk[palette];
  const dark = mode === 'dark';
  const primary = dark ? ink.dark : ink.light;
  const brandInk = dark ? ink.inkDark : ink.ink;
  const primaryLight = dark ? ink.washDark : ink.wash;
  const mainText = dark ? '#F4F7FB' : '#14243A';
  const secondaryText = dark ? '#A9B7C9' : '#52647A';
  const tertiaryText = dark ? '#7E8DA3' : '#71839A';
  const background = dark ? '#080C14' : '#F4F7FC';
  const surface = dark ? '#121A27' : '#FFFFFF';
  const surfaceVariant = dark ? '#1A2433' : '#EDF2F8';
  const border = dark ? '#2A3648' : '#DCE5F0';
  const borderStrong = dark ? '#3A4C66' : '#C7D4E4';
  const success = '#087747';
  const error = '#C62828';
  const warning = '#F28C00';
  const accent = dark ? '#FF8A2A' : '#FF7A00';

  return {
    primary,
    primaryDark: dark ? '#16325C' : '#123B78',
    primaryLight,
    primaryAction: primary,
    accent,
    accentDark: dark ? '#FFC089' : '#B84F00',
    accentLight: dark ? '#3A2614' : '#FFF0DF',
    electric: dark ? '#3DCFE6' : '#00A8C7',
    background,
    surface,
    surfaceVariant,
    surfaceElevated: dark ? '#182234' : '#FFFFFF',
    surfaceInverse: dark ? '#F4F7FB' : '#102447',
    // `primary` is the brand fill. Body copy uses mainText / text.
    secondary: secondaryText,
    tertiary: tertiaryText,
    inverse: '#FFFFFF',
    disabled: dark ? '#667588' : '#A7B2C1',
    onBrand: '#FFFFFF',
    onSurfaceVariant: mainText,
    success,
    successLight: dark ? '#10281E' : '#E3F8EF',
    successDark: dark ? '#8EEDC7' : '#087747',
    error,
    errorLight: dark ? '#3A1818' : '#FFF0EE',
    errorDark: dark ? '#FFC2BC' : '#A3201D',
    warning,
    warningLight: dark ? '#3A2A10' : '#FFF3DB',
    warningDark: dark ? '#FFD48A' : '#9B5700',
    info: dark ? '#1687A0' : '#00718C',
    infoLight: dark ? '#102830' : '#E2F7FC',
    infoDark: dark ? '#9BE7F5' : '#00617A',
    border,
    borderStrong,
    divider: dark ? '#243044' : '#E8EEF5',
    focusRing: primary,
    authCanvas: background,
    softBrand: primaryLight,
    mutedSurface: dark ? '#1A2433' : '#E2EAF4',
    deepBrandText: brandInk,
    brandInk,
    onLight: '#14243A',
    onLightMuted: '#52647A',
    mainText,
    secondaryText,
    textPrimary: mainText,
    textSecondary: secondaryText,
    textMuted: tertiaryText,
    textTertiary: tertiaryText,
    text: mainText,
    white: '#FFFFFF',
    onBrandSoft: 'rgba(255,255,255,0.78)',
    brandLine: borderStrong,
    quietLine: border,
    surfaceAlt: surfaceVariant,
    urgencySurface: dark ? '#3A2A10' : '#FFF3DB',
    secondaryHighlight: accent,
    primaryBackground: background,
    mainCard: surface,
    textInverse: '#FFFFFF',
    shadow: dark ? '#000000' : '#102447',
    online: success,
    warningText: dark ? '#FFD48A' : warning,
  };
}

export type ThemeColors = ReturnType<typeof createThemeColors>;

const styleRebuilders = new Set<() => void>();
let appliedSignature = '';

export function registerThemeStyles(rebuild: () => void) {
  styleRebuilders.add(rebuild);
}

export function applyActiveColors(next: ThemeColors) {
  const signature = `${next.background}|${next.surface}|${next.primary}|${next.mainText}|${next.brandInk}`;
  if (signature === appliedSignature) return;
  appliedSignature = signature;
  const active = theme.colors as Record<keyof ThemeColors, string>;
  (Object.keys(next) as (keyof ThemeColors)[]).forEach((key) => {
    active[key] = next[key];
  });
  styleRebuilders.forEach((rebuild) => rebuild());
}

export const theme = {
  colors: createThemeColors('light', 'ocean'),

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },

  borderRadius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    pill: 999,
  },

  typography: {
    displayLarge: {
      fontSize: 32,
      fontWeight: '800' as const,
      lineHeight: 40,
      letterSpacing: -0.5,
    },
    displayMedium: {
      fontSize: 28,
      fontWeight: '800' as const,
      lineHeight: 36,
      letterSpacing: -0.4,
    },
    titleLarge: {
      fontSize: 24,
      fontWeight: '700' as const,
      lineHeight: 32,
      letterSpacing: -0.3,
    },
    titleMedium: {
      fontSize: 20,
      fontWeight: '700' as const,
      lineHeight: 28,
      letterSpacing: -0.2,
    },
    titleSmall: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 24,
      letterSpacing: -0.1,
    },
    bodyLarge: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 24,
      letterSpacing: 0,
    },
    bodyMedium: {
      fontSize: 15,
      fontWeight: '400' as const,
      lineHeight: 22,
      letterSpacing: 0,
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 20,
      letterSpacing: 0,
    },
    captionLarge: {
      fontSize: 13,
      fontWeight: '500' as const,
      lineHeight: 18,
      letterSpacing: 0,
    },
    captionMedium: {
      fontSize: 12,
      fontWeight: '500' as const,
      lineHeight: 16,
      letterSpacing: 0,
    },
    captionSmall: {
      fontSize: 11,
      fontWeight: '600' as const,
      lineHeight: 14,
      letterSpacing: 0.5,
    },
    buttonLarge: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 20,
      letterSpacing: 0,
    },
    buttonMedium: {
      fontSize: 15,
      fontWeight: '600' as const,
      lineHeight: 20,
      letterSpacing: 0,
    },
    buttonSmall: {
      fontSize: 14,
      fontWeight: '600' as const,
      lineHeight: 18,
      letterSpacing: 0,
    },
    overline: {
      fontSize: 11,
      fontWeight: '700' as const,
      lineHeight: 14,
      letterSpacing: 1.5,
    },
  } as const,

  elevation: {
    none: {
      shadowColor: 'transparent',
      shadowOpacity: 0,
      shadowRadius: 0,
      shadowOffset: { width: 0, height: 0 },
      elevation: 0,
    },
    low: {
      shadowColor: '#102447',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    medium: {
      shadowColor: '#102447',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    raised: {
      shadowColor: '#102447',
      shadowOpacity: 0.09,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    card: {
      shadowColor: '#102447',
      shadowOpacity: 0.09,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
    high: {
      shadowColor: '#102447',
      shadowOpacity: 0.09,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 5,
    },
  },

  interaction: {
    pressedOpacity: 0.85,
    disabledOpacity: 0.5,
    focusRingColor: '#155EEF',
    focusRingWidth: 2,
    activeOpacity: 0.9,
    hoverOpacity: 0.92,
  },

  responsive: {
    compact: 375,
    standard: 768,
    expanded: 1024,
  } as const,

  roleLabels: {
    service_partner: 'Service Partner',
    repairing_partner: 'Repairing Partner',
    panel_maker: 'Panel Maker',
    supplier: 'Supplier',
  } as Record<string, string>,
};

export type Theme = typeof theme;

export const getBreakpoint = (width: number): 'compact' | 'standard' | 'expanded' => {
  if (width < theme.responsive.compact) return 'compact';
  if (width < theme.responsive.standard) return 'standard';
  return 'expanded';
};

export const responsiveSpacing = (base: number, width: number): number => {
  const bp = getBreakpoint(width);
  if (bp === 'expanded') return base * 1.5;
  if (bp === 'standard') return base * 1.25;
  return base;
};
