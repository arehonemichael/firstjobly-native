import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CATEGORY_SHORTCUTS, theme } from '@/constants/theme';
import { EmptyState, IconButton, JobCard, SearchField, SectionHeading, Wordmark, layout } from '@/components/ui';
import { getJobs } from '@/lib/job-api';
import type { Job } from '@/lib/jobs';

export default function HomeScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      setJobs((await getJobs(0)).slice(0, 8));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not load fresh opportunities.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadJobs(); }, []);

  return (
    <SafeAreaView style={layout.page} edges={['top']}>
      <ScrollView contentContainerStyle={[layout.scroll, layout.pageTop]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View><Wordmark /><Text style={styles.greeting}>Opportunity, made personal.</Text></View>
          <IconButton icon="notifications-outline" accessibilityLabel="Notifications" />
        </View>

        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>START YOUR NEXT CHAPTER</Text>
            <Text style={styles.display}>Work that moves{'\n'}you forward.</Text>
            <Text style={styles.heroBody}>Find graduate roles, learnerships and internships worth applying for.</Text>
          </View>
          <Pressable onPress={() => router.push('/jobs')} style={styles.searchPress}>
            <SearchField editable={false} pointerEvents="none" placeholder="Search roles or companies" />
          </Pressable>
          <View style={styles.trust}><Ionicons name="sparkles" size={15} color="#FFFFFF" /><Text style={styles.trustText}>Fresh opportunities, updated daily</Text></View>
        </View>

        <SectionHeading title="Find your fit" />
        <View style={styles.shortcuts}>
          {CATEGORY_SHORTCUTS.map((item) => (
            <Pressable key={item.value} onPress={() => router.push('/jobs')} style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}>
              <View style={styles.shortcutIcon}><Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={22} color={theme.colors.brand} /></View>
              <Text style={styles.shortcutLabel}>{item.label}</Text>
              <Ionicons name="arrow-forward" size={16} color={theme.colors.textMuted} />
            </Pressable>
          ))}
        </View>

        <SectionHeading title="Recommended for you" action="See all" onPress={() => router.push('/jobs')} />
        {loading ? <ActivityIndicator style={styles.loader} color={theme.colors.brand} /> : error ? (
          <EmptyState icon="cloud-offline-outline" title="Live roles are unavailable" body={error} action={<Pressable onPress={() => void loadJobs()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>} />
        ) : jobs.length === 0 ? (
          <EmptyState icon="briefcase-outline" title="New roles are on their way" body="Check back shortly for opportunities matched to your ambitions." />
        ) : <View style={styles.jobList}>{jobs.map((job) => <JobCard key={job.id} job={job} onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: job.id } })} />)}</View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.space.lg },
  greeting: { ...theme.type.eyebrow, color: theme.colors.textMuted, marginTop: theme.space.xxs },
  hero: { backgroundColor: theme.colors.ink, borderRadius: theme.radius.lg, padding: theme.space.lg, overflow: 'hidden' },
  heroCopy: { gap: theme.space.sm },
  eyebrow: { ...theme.type.eyebrow, color: '#F9A7C1', letterSpacing: 0.9 },
  display: { ...theme.type.display, color: '#FFFFFF', letterSpacing: -0.8 },
  heroBody: { ...theme.type.body, color: '#D7DEE5', maxWidth: 285 },
  searchPress: { marginTop: theme.space.lg },
  trust: { flexDirection: 'row', gap: theme.space.xs, alignItems: 'center', marginTop: theme.space.md },
  trustText: { ...theme.type.eyebrow, color: '#F8C5D6' },
  shortcuts: { gap: theme.space.xs },
  shortcut: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, padding: theme.space.sm, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line },
  shortcutIcon: { height: 40, width: 40, borderRadius: theme.radius.sm, backgroundColor: theme.colors.brandSoft, justifyContent: 'center', alignItems: 'center' },
  shortcutLabel: { ...theme.type.bodyStrong, color: theme.colors.ink, flex: 1 },
  jobList: { gap: theme.space.sm },
  loader: { marginVertical: theme.space.xl },
  retry: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.pill, paddingVertical: theme.space.sm, paddingHorizontal: theme.space.md },
  retryText: { ...theme.type.label, color: '#FFFFFF' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
