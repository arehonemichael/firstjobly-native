import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, IconButton, PrimaryButton, layout } from '@/components/ui';
import { theme } from '@/constants/theme';
import { getJob } from '@/lib/job-api';
import type { Job } from '@/lib/jobs';
import { useSavedJobs } from '@/hooks/use-saved-jobs';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSaved, toggleSave } = useSavedJobs();
  useEffect(() => { void (async () => { try { setLoading(true); setJob(await getJob(id)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'This opportunity is unavailable.'); } finally { setLoading(false); } })(); }, [id]);
  const save = async () => { const result = await toggleSave(id); if (!result.ok && result.reason === 'not-signed-in') router.push('/auth'); };
  const apply = async () => { if (job?.external_url && await Linking.canOpenURL(job.external_url)) await Linking.openURL(job.external_url); };
  const date = job?.closing_date ? new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(job.closing_date)) : null;
  if (loading) return <SafeAreaView style={[layout.page, styles.center]}><ActivityIndicator color={theme.colors.brand} /></SafeAreaView>;
  if (!job || error) return <SafeAreaView style={layout.page} edges={['top']}><View style={styles.notFound}><EmptyState icon="alert-circle-outline" title="That role is no longer available" body={error ?? 'It may have closed or been removed.'} action={<PrimaryButton label="Back to opportunities" onPress={() => router.back()} />}/></View></SafeAreaView>;
  return <SafeAreaView style={layout.page} edges={['top']}><ScrollView contentContainerStyle={layout.scroll} showsVerticalScrollIndicator={false}>
    <View style={styles.topbar}><IconButton icon="arrow-back" accessibilityLabel="Go back" onPress={() => router.back()} /><IconButton icon={isSaved(job.id) ? 'bookmark' : 'bookmark-outline'} selected={isSaved(job.id)} accessibilityLabel="Save job" onPress={() => void save()} /></View>
    <View style={styles.identity}><View style={styles.companyMark}><Text style={styles.companyMarkText}>{job.company_name.slice(0, 1).toUpperCase()}</Text></View><Text style={styles.company}>{job.company_name}</Text><Text style={styles.role}>{job.title}</Text><View style={styles.location}><Ionicons name="location-outline" size={16} color={theme.colors.textMuted} /><Text style={styles.locationText}>{job.city ? `${job.city}, ${job.province}` : job.province}</Text></View></View>
    <View style={styles.infoGrid}><Info icon="briefcase-outline" label="Opportunity" value={job.job_type ?? job.category.replace(/_/g, ' ')} /><Info icon="school-outline" label="Level" value={job.experience_level ?? 'Entry level'} />{date ? <Info icon="calendar-outline" label="Closing date" value={date} /> : null}</View>
    <Section title="The opportunity"><Text style={styles.copy}>{job.description}</Text></Section>
    <Bullets title="What you’ll do" values={job.responsibilities} />
    <Bullets title="What you’ll need" values={job.requirements} />
    <Bullets title="Bring along" values={job.required_documents} />
    <View style={styles.applyWrap}><PrimaryButton label={job.external_url ? 'Apply on employer site' : 'Application unavailable'} icon="arrow-forward" disabled={!job.external_url} onPress={() => void apply()} /></View>
  </ScrollView></SafeAreaView>;
}
function Info({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) { return <View style={styles.info}><Ionicons name={icon} size={18} color={theme.colors.brand}/><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue} numberOfLines={2}>{value}</Text></View>; }
function Section({ title, children }: { title: string; children: ReactNode }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>; }
function Bullets({ title, values }: { title: string; values: string[] }) { if (!values?.length) return null; return <Section title={title}><View style={styles.bullets}>{values.map((value) => <View key={value} style={styles.bullet}><View style={styles.dot}/><Text style={styles.bulletText}>{value}</Text></View>)}</View></Section>; }
const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' }, notFound: { flex: 1, justifyContent: 'center', paddingHorizontal: theme.space.md }, topbar: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: theme.space.sm },
  identity: { alignItems: 'center', paddingVertical: theme.space.xl }, companyMark: { height: 68, width: 68, borderRadius: theme.radius.md, backgroundColor: theme.colors.ink, justifyContent: 'center', alignItems: 'center' }, companyMarkText: { ...theme.type.display, color: '#FFFFFF' },
  company: { ...theme.type.label, color: theme.colors.textMuted, marginTop: theme.space.md }, role: { ...theme.type.display, color: theme.colors.ink, fontSize: 28, lineHeight: 34, textAlign: 'center', marginTop: theme.space.xxs, letterSpacing: -0.5 }, location: { flexDirection: 'row', gap: theme.space.xxs, alignItems: 'center', marginTop: theme.space.sm }, locationText: { ...theme.type.body, color: theme.colors.textMuted },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.sm }, info: { minWidth: '47%', flex: 1, padding: theme.space.sm, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line }, infoLabel: { ...theme.type.eyebrow, color: theme.colors.textMuted, marginTop: theme.space.xs }, infoValue: { ...theme.type.label, color: theme.colors.ink, marginTop: theme.space.xxs, textTransform: 'capitalize' },
  section: { marginTop: theme.space.xl }, sectionTitle: { ...theme.type.title, color: theme.colors.ink, marginBottom: theme.space.sm }, copy: { ...theme.type.body, color: theme.colors.inkSoft }, bullets: { gap: theme.space.sm }, bullet: { flexDirection: 'row', gap: theme.space.sm }, dot: { height: 7, width: 7, borderRadius: 4, backgroundColor: theme.colors.brand, marginTop: 8 }, bulletText: { ...theme.type.body, color: theme.colors.inkSoft, flex: 1 }, applyWrap: { marginTop: theme.space.xl },
});