import { Platform } from "react-native";

export const theme = {
  colors: {
    ink: "#17212B",
    inkSoft: "#425466",
    brand: "#E31C5F",
    brandPressed: "#C8144D",
    brandSoft: "#FFF0F5",
    background: "#F7F7F5",
    surface: "#FFFFFF",
    surfaceMuted: "#F0F2F4",
    line: "#E2E6EA",
    text: "#17212B",
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
      shadowColor: "#17212B",
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
  navy: theme.colors.ink,
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
