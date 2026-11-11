/** FirstJobly's light theme. Keep presentation values here, never in data models. */
export const Colors = {
  background: "#F7F6F3",
  foreground: "#202824",
  navy: "#202824",
  text: "#202824",
  primary: "#B72C50",
  primaryForeground: "#FFFFFF",
  primarySoft: "#F8EBEF",
  primarySoftForeground: "#92213E",
  primaryPressed: "#92213E",
  primaryBorder: "#E9BDCA",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  secondary: "#EFEFEB",
  mutedSurface: "#EFEFEB",
  muted: "#5D665F",
  mutedSubtle: "#667068",
  border: "#DFE3DC",
  input: "#89948A",
  ring: "#B72C50",
  error: "#B42318",
  destructive: "#B42318",
  errorBorder: "#E9BDB8",
  success: "#267047",
  warning: "#946200",
  info: "#286287",
} as const;

export const Radius = { xs: 4, sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;
export const Layout = {
  compact: 480,
  reading: 800,
  content: 1040,
  desktop: 900,
} as const;
export const Type = {
  caption: 12,
  body: 14,
  lead: 16,
  section: 18,
  title: 26,
} as const;
export const Fonts = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extraBold: "PlusJakartaSans_700Bold",
} as const;
