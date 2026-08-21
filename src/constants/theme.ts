import { Platform } from "react-native";

// Official FirstJobly brand colors. Keep these as the single source of truth for
// all primary brand usage in the native app.
const BRAND_PINK = "#E1225F";
const BRAND_NAVY = "#061A30";

export const theme = {
  colors: {
    brandPink: BRAND_PINK,
    brandNavy: BRAND_NAVY,
    ink: BRAND_NAVY,
    inkSoft: "#425466",
    brand: BRAND_PINK,
    brandPressed: "#C81D55",
    brandSoft: "#FFF0F5",
    background: "#F7F7F5",
    surface: "#FFFFFF",
    surfaceMuted: "#F0F2F4",
    line: "#E2E6EA",
    text: BRAND_NAVY,
    textMuted: "#6B7785",
    success: "#147A62",
    successSoft: "#E8F7F2",
    warning: "#B45309",
    warningSoft: "#FFF6E5",
    danger: "#C43B43",
    primaryForeground: "#FFFFFF",
    destructive: "#EF4444",
    selectedBorder: "#F7B1C9",
    toolSelectedBorder: "#F8D3E0",
    toolSwitchTrack: "#F6A8C4",
    heroSupportingText: "#D7DEE5",
    heroTrustText: "#F8C5D6",
    heroOverlaySoft: "rgba(6,26,48,0.50)",
    heroOverlayMedium: "rgba(6,26,48,0.72)",
    heroOverlayStrong: "rgba(6,26,48,0.94)",
    modalOverlay: "rgba(6,26,48,0.45)",
  },
  space: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32 },
  radius: { sm: 12, md: 16, lg: 24, pill: 999 },
  type: {
    eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: "600" as const },
    label: { fontSize: 14, lineHeight: 20, fontWeight: "600" as const },
    body: { fontSize: 15, lineHeight: 22, fontWeight: "400" as const },
    bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: "600" as const },
    title: { fontSize: 22, lineHeight: 28, fontWeight: "700" as const },
    display: { fontSize: 32, lineHeight: 38, fontWeight: "700" as const },
  },
  shadow: {
    card: {
      shadowColor: BRAND_NAVY,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
      elevation: 3,
    },
  },
} as const;

// Compatibility aliases for the existing real codebase. New/reworked UI should
// prefer semantic theme.* tokens, while older screens continue to resolve safely.
export const Colors = {
  background: theme.colors.background,
  foreground: theme.colors.ink,
  navy: theme.colors.brandNavy,
  ink: theme.colors.ink,
  inkSoft: theme.colors.inkSoft,

  primary: theme.colors.brand,
  brand: theme.colors.brand,
  primaryForeground: theme.colors.primaryForeground,
  primarySoft: theme.colors.brandSoft,
  primarySoftForeground: theme.colors.brand,
  primaryPressed: theme.colors.brandPressed,

  surface: theme.colors.surface,
  card: theme.colors.surface,
  secondary: theme.colors.surfaceMuted,
  mutedSurface: theme.colors.surfaceMuted,
  muted: theme.colors.textMuted,
  mutedSubtle: theme.colors.textMuted,

  border: theme.colors.line,
  input: theme.colors.line,
  line: theme.colors.line,
  ring: theme.colors.brand,

  error: theme.colors.danger,
  destructive: theme.colors.destructive,
  success: theme.colors.success,
  warning: theme.colors.warning,
  info: "#2563EB",
  text: theme.colors.text,
} as const;

export const Radius = {
  xs: 8,
  sm: theme.radius.sm,
  md: theme.radius.md,
  lg: theme.radius.lg,
  pill: theme.radius.pill,
} as const;

// The visual spec uses the platform/system sans stack. Keep these aliases so
// existing components can migrate incrementally without changing data or logic.
const systemFont = Platform.select({ ios: "System", android: "sans-serif", default: undefined });
const systemMedium = Platform.select({ ios: "System", android: "sans-serif-medium", default: undefined });

export const Fonts = {
  regular: systemFont,
  medium: systemMedium,
  semibold: systemMedium,
  bold: systemMedium,
  extraBold: systemMedium,
} as const;
