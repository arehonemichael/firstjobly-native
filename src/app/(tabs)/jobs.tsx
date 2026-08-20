import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, EmptyState, JobCard, SearchField, SectionHeading, layout } from '@/components/ui';
import { theme } from '@/constants/theme';
import { CATEGORIES, PROVINCES, filterJobs, type JobFilters } from '@/lib/job-filters';
import { getSearchJobs } from '@/lib/job-api';
import type { Job } from '@/lib/jobs';
import { useSavedJobs } from '@/hooks/use-saved-jobs';

export default function JobsScreen() {
  const params = useLocalSearchParams<{ query?: string }>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [query, setQuery] = useState(params.query ?? '');
  const [filters, setFilters] = useState<JobFilters>({});
  const [draft, setDraft] = useState<JobFilters>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isSaved, toggleSave } = useSavedJobs();

  const fetchJobs = async () => {
    try { setLoading(true); setError(null); setJobs(await getSearchJobs()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not load opportunities.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void fetchJobs(); }, []);
  const visible = useMemo(() => filterJobs(jobs, query, filters), [jobs, query, filters]);
  const openFilter = () => { setDraft(filters); setModalVisible(true); };

  return (
    <SafeAreaView style={layout.page} edges={['top']}>
      <ScrollView contentContainerStyle={[layout.scroll, layout.pageTop]} keyboardShouldPersistTaps="handled">
        <View style={styles.titleRow}><View><Text style={styles.title}>Explore jobs</Text><Text style={styles.subheading}>Roles built for where you are now.</Text></View><Pressable onPress={openFilter} style={styles.filter}><Ionicons name="options-outline" size={21} color={theme.colors.ink} /></Pressable></View>
        <SearchField value={query} onChangeText={setQuery} placeholder="Search roles, companies, places" returnKeyType="search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All roles" active={!filters.category && !filters.province} onPress={() => setFilters({})} />
          {CATEGORIES.slice(0, 5).map((item) => <Chip key={item.key} label={item.label} active={filters.category === item.key} onPress={() => setFilters((current) => ({ ...current, category: current.category === item.key ? undefined : item.key }))} />)}
        </ScrollView>
        <SectionHeading title={loading ? 'Loading roles' : `${visible.length} opportunities`} />
        {loading ? <ActivityIndicator style={styles.loader} color={theme.colors.brand} /> : error ? <EmptyState icon="cloud-offline-outline" title="Couldn’t load jobs" body={error} action={<Pressable onPress={() => void fetchJobs()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>} /> : visible.length === 0 ? <EmptyState icon="search-outline" title="No roles match yet" body="Try a wider search or clear your filters to see more." action={<Pressable onPress={() => { setQuery(''); setFilters({}); }} style={styles.retry}><Text style={styles.retryText}>Clear filters</Text></Pressable>} /> : <View style={styles.jobs}>{visible.map((job) => <JobCard key={job.id} job={job} saved={isSaved(job.id)} onToggleSave={() => void toggleSave(job.id)} onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: job.id } })} />)}</View>}
      </ScrollView>
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={layout.page} edges={['top', 'bottom']}><View style={styles.sheet}><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>Refine results</Text><Pressable onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color={theme.colors.ink} /></Pressable></View><Text style={styles.filterLabel}>Opportunity type</Text><View style={styles.wrap}>{CATEGORIES.map((item) => <Chip key={item.key} label={item.label} active={draft.category === item.key} onPress={() => setDraft((current) => ({ ...current, category: current.category === item.key ? undefined : item.key }))} />)}</View><Text style={styles.filterLabel}>Province</Text><View style={styles.wrap}>{PROVINCES.map((item) => <Chip key={item} label={item} active={draft.province === item} onPress={() => setDraft((current) => ({ ...current, province: current.province === item ? undefined : item }))} />)}</View><View style={styles.sheetFooter}><Pressable onPress={() => setDraft({})}><Text style={styles.clear}>Reset</Text></Pressable><Pressable onPress={() => { setFilters(draft); setModalVisible(false); }} style={styles.apply}><Text style={styles.applyText}>Show matching jobs</Text></Pressable></View></View></SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.space.md },
  title: { ...theme.type.display, color: theme.colors.ink, fontSize: 28, lineHeight: 34, letterSpacing: -0.6 },
  subheading: { ...theme.type.body, color: theme.colors.textMuted, marginTop: theme.space.xxs },
  filter: { height: 44, width: 44, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' },
  chips: { gap: theme.space.xs, paddingVertical: theme.space.md },
  jobs: { gap: theme.space.sm },
  loader: { marginVertical: theme.space.xl },
  retry: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.pill, paddingHorizontal: theme.space.md, paddingVertical: theme.space.sm },
  retryText: { ...theme.type.label, color: '#FFFFFF' },
  sheet: { flex: 1, padding: theme.space.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: theme.space.lg },
  sheetTitle: { ...theme.type.title, color: theme.colors.ink },
  filterLabel: { ...theme.type.label, color: theme.colors.ink, marginTop: theme.space.lg, marginBottom: theme.space.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.xs },
  sheetFooter: { marginTop: 'auto', paddingTop: theme.space.md, flexDirection: 'row', gap: theme.space.sm, alignItems: 'center' },
  clear: { ...theme.type.label, color: theme.colors.brand, paddingHorizontal: theme.space.sm },
  apply: { flex: 1, minHeight: 52, borderRadius: theme.radius.md, backgroundColor: theme.colors.brand, justifyContent: 'center', alignItems: 'center' },
  applyText: { ...theme.type.bodyStrong, color: '#FFFFFF' },
});