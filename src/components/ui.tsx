import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { theme } from '@/constants/theme';
import type { Job } from '@/lib/jobs';

export function touchFeedback() {
  // Pressable's visual feedback keeps this shared kit dependency-free.
}

export function Wordmark({ inverse = false }: { inverse?: boolean }) {
  return <Text style={[styles.wordmark, inverse && { color: '#FFFFFF' }]}>First<Text style={styles.brand}>Jobly</Text></Text>;
}

export function IconButton({ icon, onPress, selected = false, accessibilityLabel }: { icon: keyof typeof Ionicons.glyphMap; onPress?: () => void; selected?: boolean; accessibilityLabel: string }) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel} onPress={() => { touchFeedback(); onPress?.(); }} style={({ pressed }) => [styles.iconButton, selected && styles.iconButtonSelected, pressed && styles.pressed]}>
      <Ionicons name={icon} size={21} color={selected ? theme.colors.brand : theme.colors.ink} />
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, disabled = false, icon }: { label: string; onPress: () => void; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable testID={`button-${label.toLowerCase().replace(/\s+/g, '-')}`} disabled={disabled} onPress={() => { touchFeedback(); onPress(); }} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabled, pressed && styles.pressed]}>
      {icon ? <Ionicons name={icon} size={18} color="#FFFFFF" /> : null}
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, icon }: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable onPress={() => { touchFeedback(); onPress(); }} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
      {icon ? <Ionicons name={icon} size={18} color={theme.colors.ink} /> : null}
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

export function SearchField(props: TextInputProps) {
  return <View style={styles.search}><Ionicons name="search" size={20} color={theme.colors.textMuted} /><TextInput placeholderTextColor={theme.colors.textMuted} style={styles.searchInput} {...props} /></View>;
}

export function Chip({ label, active = false, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  return <Pressable onPress={() => { touchFeedback(); onPress?.(); }} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></Pressable>;
}

export function SectionHeading({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{action ? <Pressable onPress={onPress}><Text style={styles.sectionAction}>{action}</Text></Pressable> : null}</View>;
}

export function JobCard({ job, onPress, saved, onToggleSave, compact = false }: { job: Job; onPress: () => void; saved?: boolean; onToggleSave?: () => void; compact?: boolean }) {
  const location = job.city ? `${job.city}, ${job.province}` : job.province;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.jobCard, compact && styles.jobCardCompact, pressed && styles.pressed]}>
      <View style={styles.logo}>
        {job.company_logo_url ? <Image source={{ uri: job.company_logo_url }} style={styles.logoImage} resizeMode="contain" /> : <Text style={styles.logoLetter}>{job.company_name.slice(0, 1).toUpperCase()}</Text>}
      </View>
      <View style={styles.jobContent}>
        <Text style={styles.jobTitle} numberOfLines={2}>{job.title}</Text>
        <Text style={styles.companyName} numberOfLines={1}>{job.company_name}</Text>
        <View style={styles.metaRow}><Ionicons name="location-outline" size={14} color={theme.colors.textMuted} /><Text style={styles.meta} numberOfLines={1}>{location}</Text></View>
        <View style={styles.tagRow}><View style={styles.jobTag}><Text style={styles.jobTagText}>{job.category.replace(/_/g, ' ')}</Text></View>{job.is_urgent ? <View style={styles.urgentTag}><Text style={styles.urgentText}>Closing soon</Text></View> : null}</View>
      </View>
      {onToggleSave ? <IconButton icon={saved ? 'bookmark' : 'bookmark-outline'} selected={saved} onPress={onToggleSave} accessibilityLabel={saved ? 'Remove saved job' : 'Save job'} /> : <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />}
    </Pressable>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; action?: ReactNode }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><Ionicons name={icon} size={28} color={theme.colors.brand} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyBody}>{body}</Text>{action ? <View style={styles.emptyAction}>{action}</View> : null}</View>;
}

export const layout = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  scroll: { paddingHorizontal: theme.space.md, paddingBottom: 118 },
  pageTop: { paddingTop: theme.space.sm },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.line, ...theme.shadow.card } as ViewStyle,
});

const styles = StyleSheet.create({
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
  wordmark: { ...theme.type.title, color: theme.colors.ink },
  brand: { color: theme.colors.brand },
  iconButton: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.line },
  iconButtonSelected: { backgroundColor: theme.colors.brandSoft, borderColor: '#F7B1C9' },
  primaryButton: { minHeight: 52, borderRadius: theme.radius.md, backgroundColor: theme.colors.brand, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: theme.space.xs, paddingHorizontal: theme.space.md },
  primaryText: { ...theme.type.bodyStrong, color: '#FFFFFF' },
  secondaryButton: { minHeight: 52, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: theme.space.xs, paddingHorizontal: theme.space.md },
  secondaryText: { ...theme.type.bodyStrong, color: theme.colors.ink },
  search: { height: 54, borderRadius: theme.radius.md, paddingHorizontal: theme.space.md, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, gap: theme.space.sm },
  searchInput: { flex: 1, ...theme.type.body, color: theme.colors.ink, height: '100%' },
  chip: { paddingHorizontal: theme.space.sm, paddingVertical: theme.space.xs, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line },
  chipActive: { backgroundColor: theme.colors.brandSoft, borderColor: '#F7B1C9' },
  chipText: { ...theme.type.eyebrow, color: theme.colors.inkSoft },
  chipTextActive: { color: theme.colors.brand },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.space.xl, marginBottom: theme.space.sm },
  sectionTitle: { ...theme.type.title, color: theme.colors.ink },
  sectionAction: { ...theme.type.label, color: theme.colors.brand },
  jobCard: { minHeight: 124, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, padding: theme.space.sm, flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.sm, ...theme.shadow.card },
  jobCardCompact: { minHeight: 112 },
  logo: { height: 48, width: 48, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceMuted, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  logoImage: { height: 48, width: 48 },
  logoLetter: { ...theme.type.title, color: theme.colors.ink },
  jobContent: { flex: 1, gap: theme.space.xxs },
  jobTitle: { ...theme.type.bodyStrong, color: theme.colors.ink },
  companyName: { ...theme.type.body, color: theme.colors.textMuted },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: theme.space.xxs },
  meta: { ...theme.type.eyebrow, color: theme.colors.textMuted, flexShrink: 1 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs, marginTop: theme.space.xxs },
  jobTag: { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.pill, paddingVertical: theme.space.xxs, paddingHorizontal: theme.space.xs },
  jobTagText: { ...theme.type.eyebrow, color: theme.colors.inkSoft, textTransform: 'capitalize' },
  urgentTag: { backgroundColor: theme.colors.brandSoft, borderRadius: theme.radius.pill, paddingVertical: theme.space.xxs, paddingHorizontal: theme.space.xs },
  urgentText: { ...theme.type.eyebrow, color: theme.colors.brand },
  empty: { alignItems: 'center', paddingHorizontal: theme.space.lg, paddingVertical: theme.space.xl, gap: theme.space.sm },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { ...theme.type.title, textAlign: 'center', color: theme.colors.ink },
  emptyBody: { ...theme.type.body, color: theme.colors.textMuted, textAlign: 'center' },
  emptyAction: { width: '100%', marginTop: theme.space.sm },
});