import { Platform } from "react-native";
/** Shared presentation tokens; brand colours remain unchanged. */
export const Colors = {
  background: "#F6F7F9",
  foreground: "#061A30",
  navy: "#061A30",

  primary: "#E1225F",
  primaryForeground: "#FFFFFF",
  primarySoft: "#FDEEF3",
  primarySoftForeground: "#B0164A",
  primaryPressed: "#B0164A",

  overlay: "rgba(6, 26, 48, 0.32)",
  surface: "#FFFFFF",
  card: "#FFFFFF",

  secondary: "#F1F5F9",
  mutedSurface: "#F1F5F9",
  muted: "#556274",
  mutedSubtle: "#627088",

  border: "#E8EBF0",
  input: "#8793A4",
  ring: "#B0164A",

  error: "#DC2626",
  errorBorder: "#FECACA",
  primaryBorder: "#F3B2C7",
  destructive: "#DC2626",
  success: "#16A34A",
  warning: "#F59E0B",
  info: "#2563EB",

  text: "#061A30",
} as const;

export const Radius = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  pill: 999,
} as const;

const face = (name: string) =>
  Platform.OS === "web"
    ? `${name}, system-ui, -apple-system, "Segoe UI", sans-serif`
    : name;
export const Fonts = {
  // Compatibility aliases keep supporting screens on the same sans-serif face.
  editorial: face("PlusJakartaSans_600SemiBold"),
  editorialItalic: face("PlusJakartaSans_600SemiBold"),
  regular: face("PlusJakartaSans_400Regular"),
  medium: face("PlusJakartaSans_500Medium"),
  semibold: face("PlusJakartaSans_600SemiBold"),
  bold: face("PlusJakartaSans_600SemiBold"),
  extraBold: face("PlusJakartaSans_600SemiBold"),
} as const;

export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;
export const Layout = { desktop: 900, content: 1120, reading: 800 } as const;
export const Type = {
  caption: 12,
  body: 14,
  lead: 16,
  section: 24,
  title: 36,
} as const;

/** Navigation states share the audited brand palette. */
export const NavigationColors = {
  selected: Colors.primary,
  selectedText: Colors.primaryPressed,
  selectedSurface: Colors.primarySoft,
  pressed: Colors.primaryPressed,
  foreground: Colors.navy,
} as const;

/** Canonical wordmark colours shared by Home and every auth mode. */
export const BrandColors = { first: Colors.primary, jobly: Colors.navy } as const;
