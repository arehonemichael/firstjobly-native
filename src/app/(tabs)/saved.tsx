import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, JobCard, PrimaryButton, layout } from '@/components/ui';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useSavedJobs } from '@/hooks/use-saved-jobs';
import { supabase } from '@/lib/supabase';
import type { Job } from '@/lib/jobs';

export default function SavedScreen() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { savedIds, isSaved, toggleSave, loading: savingLoading, refreshSaved } = useSavedJobs();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(async () => {
    if (!isAuthenticated || !supabase || savedIds.length === 0) { setJobs([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase.from('jobs').select('*').in('id', savedIds).eq('approval_status', 'approved').eq('is_active', true);
      if (error) throw error;
      const byId = new Map((data ?? []).map((job) => [job.id, job as Job]));
      setJobs(savedIds.map((id) => byId.get(id)).filter((job): job is Job => Boolean(job)));
    } catch (error) {
      console.error('Could not load saved jobs:', error);
    } finally { setLoading(false); }
  }, [isAuthenticated, savedIds]);

  useEffect(() => { void loadJobs(); }, [loadJobs]);
  const refreshing = loading || savingLoading || authLoading;

  return (
    <SafeAreaView style={layout.page} edges={['top']}>
      <ScrollView contentContainerStyle={[layout.scroll, layout.pageTop]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refreshSaved(); void loadJobs(); }} tintColor={theme.colors.brand} />}>
        <Text style={styles.title}>Saved roles</Text><Text style={styles.subtitle}>A calm place to return to opportunities that caught your eye.</Text>
        {authLoading || loading ? <ActivityIndicator style={styles.loader} color={theme.colors.brand} /> : !isAuthenticated ? <EmptyState icon="bookmark-outline" title="Keep opportunities close" body="Sign in to save roles and pick up exactly where you left off." action={<PrimaryButton label="Sign in to save jobs" onPress={() => router.push('/auth')} />} /> : jobs.length === 0 ? <EmptyState icon="bookmark-outline" title="Nothing saved yet" body="Save roles you like, then come back when you are ready to apply." action={<PrimaryButton label="Explore opportunities" onPress={() => router.push('/jobs')} />} /> : <View style={styles.list}>{jobs.map((job) => <JobCard key={job.id} job={job} saved={isSaved(job.id)} onToggleSave={() => void toggleSave(job.id)} onPress={() => router.push({ pathname: '/jobs/[id]', params: { id: job.id } })} />)}</View>}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  title: { ...theme.type.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, color: theme.colors.ink },
  subtitle: { ...theme.type.body, color: theme.colors.textMuted, marginTop: theme.space.xs, maxWidth: 315 },
  loader: { marginVertical: theme.space.xl },
  list: { marginTop: theme.space.xl, gap: theme.space.sm },
});