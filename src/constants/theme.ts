export const theme = {
  colors: {
    ink: '#17212B',
    inkSoft: '#425466',
    brand: '#E31C5F',
    brandPressed: '#C8144D',
    brandSoft: '#FFF0F5',
    background: '#F7F7F5',
    surface: '#FFFFFF',
    surfaceMuted: '#F0F2F4',
    line: '#E2E6EA',
    text: '#17212B',
    textMuted: '#6B7785',
    success: '#147A62',
    successSoft: '#E8F7F2',
    warning: '#B45309',
    warningSoft: '#FFF6E5',
    danger: '#C43B43',
  },
  space: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32 },
  radius: { sm: 12, md: 16, lg: 24, pill: 999 },
  type: {
    eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
    label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
    body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
    bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
    title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
    display: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  },
  shadow: {
    card: {
      shadowColor: '#17212B',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 14,
      elevation: 3,
    },
  },
} as const;

export const CATEGORY_SHORTCUTS = [
  { label: 'Learnerships', icon: 'school-outline', value: 'learnership' },
  { label: 'Internships', icon: 'rocket-outline', value: 'internship' },
  { label: 'Graduate roles', icon: 'ribbon-outline', value: 'graduate_programme' },
  { label: 'Government', icon: 'business-outline', value: 'government' },
] as const;