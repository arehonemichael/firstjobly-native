import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "../../hooks/use-is-focused";
import { SafeAreaView } from "react-native-safe-area-context";

import { getSearchJobs } from "../../lib/job-api";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { EmptyState } from "../../components/ui/app-ui";
import { JobListSkeleton } from "../../components/ui/skeleton";
import { NativeAdBlock } from "../../ads/NativeAdBlock";
import { MONETIZATION } from "../../ads/monetizationConfig";
import { theme } from "../../constants/theme";
import { formatCategoryLabel } from "../../lib/job-formatters";
import { isJobNew } from "../../lib/job-display";
import type { Job } from "../../lib/jobs";
import {
  CATEGORIES,
  EDUCATION_LEVELS,
  EMPTY_FILTERS,
  EXPERIENCE_LEVELS,
  PROVINCES,
  filterJobs,
  type JobFilters,
  type JobSort,
} from "../../lib/job-filters";

const PAGE_SIZE = 25;
const JOBS_STALE_MS = 7 * 60 * 1000;

function formatSalary(job: Job): string | null {
  const format = (value: number) => `R${Math.round(value).toLocaleString("en-ZA")}`;
  if (job.salary_min != null && job.salary_max != null) return `${format(job.salary_min)} - ${format(job.salary_max)}`;
  if (job.salary_min != null) return `From ${format(job.salary_min)}`;
  if (job.salary_max != null) return `Up to ${format(job.salary_max)}`;
  return null;
}

function postedLabel(job: Job) {
  const value = job.created_at ?? job.posted_at;
  const time = value ? new Date(value).getTime() : 0;
  if (!time || !Number.isFinite(time)) return "Recently posted";
  const hours = Math.max(1, Math.floor((Date.now() - time) / 3_600_000));
  if (hours < 24) return `Posted ${hours}h ago`;
  return `Posted ${Math.floor(hours / 24)}d ago`;
}

function johannesburgTodayUtc() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Johannesburg",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const year = Number(parts.find((part) => part.type === "year")?.value);
    const month = Number(parts.find((part) => part.type === "month")?.value);
    const day = Number(parts.find((part) => part.type === "day")?.value);
    if (year && month && day) return Date.UTC(year, month - 1, day);
  } catch {}
  const now = new Date(Date.now() + 2 * 60 * 60 * 1000);
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function closingCountdown(job: Job): string | null {
  if (!job.closing_date) return null;
  const dateOnly = String(job.closing_date).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return null;
  const closingUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const days = Math.round((closingUtc - johannesburgTodayUtc()) / 86_400_000);
  if (days < 0 || days > 10) return null;
  if (days === 0) return "Closing today";
  if (days === 1) return "Closing tomorrow";
  return `Closing in ${days} days`;
}

function tagsFor(job: Job) {
  return [job.category, job.job_type, job.experience_level]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(formatCategoryLabel)
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 3);
}

function SelectBlock({ label, value, values, onChange }: { label: string; value?: string; values: { value: string; label: string }[]; onChange: (value?: string) => void }) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.optionWrap}>
        <TouchableOpacity style={[styles.option, !value && styles.optionSelected]} onPress={() => onChange(undefined)}>
          <Text style={[styles.optionText, !value && styles.optionSelectedText]}>Any</Text>
        </TouchableOpacity>
        {values.map((item) => {
          const selected = value === item.value;
          return (
            <TouchableOpacity key={item.value} style={[styles.option, selected && styles.optionSelected]} onPress={() => onChange(item.value)}>
              <Text style={[styles.optionText, selected && styles.optionSelectedText]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const JobCard = memo(function JobCard({ job, onPress }: { job: Job; onPress: () => void }) {
  const location = job.city ? `${job.city}, ${job.province}` : job.province;
  const salary = formatSalary(job);
  const closing = closingCountdown(job);
  const isNew = isJobNew(job);
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.84} onPress={onPress}>
      <View style={styles.logo}>
        {job.company_logo_url ? <ExpoImage source={{ uri: job.company_logo_url }} style={styles.logoImage} contentFit="contain" cachePolicy="memory-disk" transition={100} /> : <Text style={styles.logoText}>{job.company_name.charAt(0).toUpperCase()}</Text>}
      </View>
      <View style={styles.jobInfo}>
        <View style={styles.companyStatusRow}>
          <Text style={styles.company} numberOfLines={1}>{job.company_name}</Text>
          {job.is_urgent ? <View style={styles.statusPill}><Text style={styles.statusText}>Hot</Text></View> : isNew ? <View style={styles.newStatusPill}><Text style={styles.newStatusText}>New</Text></View> : null}
          <View style={styles.bookmarkButton}><Ionicons name="bookmark-outline" size={22} color={theme.colors.ink} /></View>
        </View>
        <Text style={styles.jobTitle} numberOfLines={2}>{job.title}</Text>
        <View style={styles.meta}><Ionicons name="location-outline" size={14} color={theme.colors.inkSoft} /><Text style={styles.metaText} numberOfLines={2}>{location}</Text></View>
        <Text style={styles.description} numberOfLines={2}>{job.description}</Text>
        <View style={styles.cardFooter}>
          <View style={styles.tagsRow}>{tagsFor(job).map((tag, index) => <View key={`${job.id}-${tag}-${index}`} style={styles.tagPill}><Text style={styles.tagText} numberOfLines={1}>{tag}</Text></View>)}</View>
          <View style={styles.postedSalaryStack}>
            <View style={styles.postedPill}><Text style={styles.postedText}>{postedLabel(job)}</Text></View>
            {closing ? <Text style={styles.closingText}>{closing}</Text> : null}
            {salary ? <Text style={styles.salaryText} numberOfLines={1}>{salary}</Text> : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function JobsScreen() {
  const bottomContentPadding = useScreenBottomPadding(true);
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ q?: string; category?: string; experience?: string; province?: string }>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState<JobFilters>(() => ({ ...EMPTY_FILTERS, q: typeof params.q === "string" ? params.q : "", category: typeof params.category === "string" ? params.category : undefined, experience: typeof params.experience === "string" ? params.experience : undefined, province: typeof params.province === "string" ? params.province : undefined }));
  const [draftFilters, setDraftFilters] = useState<JobFilters>(filters);
  const [keyword, setKeyword] = useState(typeof params.q === "string" ? params.q : "");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const lastFetchedAt = useRef(0);
  const inFlight = useRef(false);
  const hasLoaded = useRef(false);

  const loadJobs = useCallback(async (force = false, manualRefresh = false) => {
    if (inFlight.current) return;
    if (!force && Date.now() - lastFetchedAt.current < JOBS_STALE_MS) return;
    inFlight.current = true;
    if (!hasLoaded.current) setLoading(true);
    if (manualRefresh) setRefreshing(true);
    setError(null);
    try {
      const next = await getSearchJobs();
      setJobs(next);
      lastFetchedAt.current = Date.now();
    } catch (err) {
      console.error("Search jobs failed:", err);
      setError(err instanceof Error ? err.message : "Could not load jobs");
    } finally {
      inFlight.current = false;
      hasLoaded.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadJobs(true); }, [loadJobs]);
  useFocusEffect(useCallback(() => { void loadJobs(false); }, [loadJobs]));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active" && isFocused) void loadJobs(false); });
    return () => subscription.remove();
  }, [isFocused, loadJobs]);
  useEffect(() => {
    const next: JobFilters = { ...EMPTY_FILTERS, q: typeof params.q === "string" ? params.q : "", category: typeof params.category === "string" ? params.category : undefined, experience: typeof params.experience === "string" ? params.experience : undefined, province: typeof params.province === "string" ? params.province : undefined };
    setKeyword(next.q); setFilters(next); setDraftFilters(next); setVisibleCount(PAGE_SIZE);
  }, [params.q, params.category, params.experience, params.province]);

  const results = useMemo(() => filterJobs(jobs, filters), [jobs, filters]);
  const visibleJobs = useMemo(() => results.slice(0, visibleCount), [results, visibleCount]);
  const activeFilters = useMemo(() => {
    const list: { key: keyof JobFilters; label: string }[] = [];
    if (filters.category) list.push({ key: "category", label: formatCategoryLabel(filters.category) });
    if (filters.province) list.push({ key: "province", label: filters.province });
    if (filters.city) list.push({ key: "city", label: filters.city });
    if (filters.experience) list.push({ key: "experience", label: formatCategoryLabel(filters.experience) });
    if (filters.education) list.push({ key: "education", label: formatCategoryLabel(filters.education) });
    if (filters.minSalary) list.push({ key: "minSalary", label: `R${filters.minSalary.toLocaleString("en-ZA")}+ p/m` });
    if (filters.closingWithin) list.push({ key: "closingWithin", label: `Closing in ${filters.closingWithin} days` });
    return list;
  }, [filters]);

  function runSearch() { setVisibleCount(PAGE_SIZE); setFilters((current) => ({ ...current, q: keyword.trim() })); }
  function changeSort(sort: JobSort) { setVisibleCount(PAGE_SIZE); setFilters((current) => ({ ...current, sort })); }
  function openFilters() { setDraftFilters(filters); setFilterOpen(true); }
  function applyFilters() { setVisibleCount(PAGE_SIZE); setFilters(draftFilters); setFilterOpen(false); }
  function clearFilters() { setDraftFilters({ q: filters.q, sort: filters.sort }); }
  function removeFilter(key: keyof JobFilters) { setVisibleCount(PAGE_SIZE); setFilters((current) => ({ ...current, [key]: undefined })); }

  const keyExtractor = useCallback((job: Job) => job.id, []);
  const renderJob = useCallback(({ item, index }: { item: Job; index: number }) => {
    const jobNumber = index + 1;
    const showNativeAd = jobNumber === MONETIZATION.nativeFeedFirstAfter || (jobNumber > MONETIZATION.nativeFeedFirstAfter && (jobNumber - MONETIZATION.nativeFeedFirstAfter) % MONETIZATION.nativeFeedIntervalAfterFirst === 0);
    return (
      <>
        <JobCard job={item} onPress={() => router.push({ pathname: "/jobs/[id]", params: { id: item.id } })} />
        {showNativeAd ? <NativeAdBlock variant="feed" /> : null}
      </>
    );
  }, []);

  const handleEndReached = useCallback(() => { if (visibleCount < results.length) setVisibleCount((count) => Math.min(count + PAGE_SIZE, results.length)); }, [results.length, visibleCount]);

  if (loading) return <SafeAreaView style={styles.page} edges={["top", "bottom"]}><View style={{ paddingHorizontal: 16, paddingTop: 18 }}><JobListSkeleton count={6} /></View></SafeAreaView>;
  if (error && jobs.length === 0) return <SafeAreaView style={styles.center}><Ionicons name="cloud-offline-outline" size={44} color={theme.colors.brand} /><Text style={styles.errorTitle}>Could not load jobs</Text><Text style={styles.errorText}>{error}</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <FlatList
        data={visibleJobs}
        keyExtractor={keyExtractor}
        renderItem={renderJob}
        contentContainerStyle={[styles.list, { paddingBottom: bottomContentPadding }]}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={() => void loadJobs(true, true)}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Search jobs</Text>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}><Ionicons name="search-outline" size={20} color={theme.colors.inkSoft} /><TextInput value={keyword} onChangeText={setKeyword} onSubmitEditing={runSearch} placeholder="Job title, company, keyword" placeholderTextColor={theme.colors.textMuted} returnKeyType="search" style={styles.searchInput} /></View>
              <TouchableOpacity style={styles.filterButton} onPress={openFilters}><Ionicons name="options-outline" size={21} color={theme.colors.ink} /></TouchableOpacity>
            </View>
            {activeFilters.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFilters}>{activeFilters.map((item) => <TouchableOpacity key={item.key} style={styles.activeFilter} onPress={() => removeFilter(item.key)}><Text style={styles.activeFilterText}>{item.label}</Text><Ionicons name="close" size={14} color={theme.colors.brand} /></TouchableOpacity>)}</ScrollView> : null}
            <View style={styles.resultHeader}><Text style={styles.resultCount}>{results.length} opportunities</Text><View style={styles.sortRow}><TouchableOpacity onPress={() => changeSort("latest")}><Text style={[styles.sortText, filters.sort === "latest" && styles.sortTextActive]}>Latest</Text></TouchableOpacity><Text style={styles.sortDivider}>|</Text><TouchableOpacity onPress={() => changeSort("closing")}><Text style={[styles.sortText, filters.sort === "closing" && styles.sortTextActive]}>Closing</Text></TouchableOpacity></View></View>
          </>
        }
        ListEmptyComponent={<EmptyState title="No opportunities found" message="Try a broader keyword or remove a filter." actionLabel="Clear filters" onAction={() => { setKeyword(""); setFilters(EMPTY_FILTERS); setDraftFilters(EMPTY_FILTERS); }} />}
        ListFooterComponent={visibleCount < results.length ? <View style={styles.loadingMore}><ActivityIndicator color={theme.colors.brand} /></View> : null}
      />

      <Modal visible={filterOpen} animationType="slide" transparent onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}><Text style={styles.modalTitle}>Filters</Text><TouchableOpacity onPress={() => setFilterOpen(false)}><Ionicons name="close" size={24} color={theme.colors.ink} /></TouchableOpacity></View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <SelectBlock label="Category" value={draftFilters.category} values={CATEGORIES} onChange={(value) => setDraftFilters((current) => ({ ...current, category: value }))} />
              <SelectBlock label="Province" value={draftFilters.province} values={PROVINCES.map((value) => ({ value, label: value }))} onChange={(value) => setDraftFilters((current) => ({ ...current, province: value }))} />
              <SelectBlock label="Experience" value={draftFilters.experience} values={EXPERIENCE_LEVELS} onChange={(value) => setDraftFilters((current) => ({ ...current, experience: value }))} />
              <SelectBlock label="Education" value={draftFilters.education} values={EDUCATION_LEVELS} onChange={(value) => setDraftFilters((current) => ({ ...current, education: value }))} />
            </ScrollView>
            <View style={styles.modalActions}><Pressable style={styles.clearButton} onPress={clearFilters}><Text style={styles.clearButtonText}>Clear</Text></Pressable><Pressable style={styles.applyButton} onPress={applyFilters}><Text style={styles.applyButtonText}>Show jobs</Text></Pressable></View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: theme.colors.background }, list: { paddingHorizontal: 16, paddingTop: 18 }, title: { color: theme.colors.ink, fontSize: 25, lineHeight: 31, fontWeight: "800", letterSpacing: -0.4, marginBottom: 14 }, searchRow: { flexDirection: "row", gap: 10, marginBottom: 12 }, searchBox: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, flexDirection: "row", alignItems: "center", paddingHorizontal: 13, gap: 8 }, searchInput: { flex: 1, color: theme.colors.ink, fontSize: 14 }, filterButton: { width: 48, height: 48, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center" }, activeFilters: { gap: 8, paddingBottom: 12 }, activeFilter: { minHeight: 32, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.selectedBorder, backgroundColor: theme.colors.brandSoft, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 5 }, activeFilterText: { color: theme.colors.brand, fontSize: 11, fontWeight: "700" }, resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }, resultCount: { color: theme.colors.inkSoft, fontSize: 12, fontWeight: "600" }, sortRow: { flexDirection: "row", alignItems: "center", gap: 6 }, sortText: { color: theme.colors.inkSoft, fontSize: 12, fontWeight: "600" }, sortTextActive: { color: theme.colors.brand }, sortDivider: { color: theme.colors.line }, card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, padding: 12, flexDirection: "row", gap: 12, marginBottom: 10, ...theme.shadow.card }, logo: { width: 58, height: 58, borderRadius: theme.radius.sm, backgroundColor: theme.colors.brandSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" }, logoImage: { width: 48, height: 48 }, logoText: { color: theme.colors.brand, fontSize: 24, fontWeight: "800" }, jobInfo: { flex: 1, minWidth: 0 }, companyStatusRow: { minHeight: 24, flexDirection: "row", alignItems: "center", gap: 7, paddingRight: 32 }, company: { flex: 1, color: theme.colors.ink, fontSize: 15, fontWeight: "700" }, statusPill: { minHeight: 22, paddingHorizontal: 7, borderRadius: 7, backgroundColor: theme.colors.brandSoft, alignItems: "center", justifyContent: "center" }, statusText: { color: theme.colors.brand, fontSize: 10, fontWeight: "700" }, newStatusPill: { minHeight: 22, paddingHorizontal: 7, borderRadius: 7, backgroundColor: theme.colors.successSoft, alignItems: "center", justifyContent: "center" }, newStatusText: { color: theme.colors.success, fontSize: 10, fontWeight: "700" }, bookmarkButton: { position: "absolute", right: 0, top: 0 }, jobTitle: { color: theme.colors.ink, fontSize: 14, lineHeight: 19, fontWeight: "600", marginTop: 4 }, meta: { marginTop: 6, flexDirection: "row", alignItems: "flex-start", gap: 4 }, metaText: { flex: 1, color: theme.colors.inkSoft, fontSize: 11, lineHeight: 15 }, description: { color: theme.colors.inkSoft, fontSize: 12, lineHeight: 17, marginTop: 10 }, cardFooter: { marginTop: 11, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }, tagsRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 }, tagPill: { minHeight: 24, paddingHorizontal: 8, borderRadius: 7, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surfaceMuted, alignItems: "center", justifyContent: "center" }, tagText: { color: theme.colors.ink, fontSize: 10, lineHeight: 14, fontWeight: "500" }, postedSalaryStack: { flexShrink: 0, alignItems: "flex-end", gap: 2, maxWidth: 136 }, postedPill: { minHeight: 23, paddingHorizontal: 7, borderRadius: 7, backgroundColor: theme.colors.surfaceMuted, alignItems: "center", justifyContent: "center" }, postedText: { color: theme.colors.inkSoft, fontSize: 10, fontWeight: "600" }, closingText: { color: theme.colors.danger, fontSize: 10, fontWeight: "700" }, salaryText: { color: theme.colors.brand, fontSize: 10, fontWeight: "700" }, loadingMore: { paddingVertical: 20 }, errorTitle: { marginTop: 12, color: theme.colors.ink, fontSize: 18, fontWeight: "800" }, errorText: { marginTop: 7, color: theme.colors.inkSoft, textAlign: "center" }, modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.36)", justifyContent: "flex-end" }, modalCard: { maxHeight: "88%", backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }, modalHeader: { minHeight: 64, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: theme.colors.line }, modalTitle: { color: theme.colors.ink, fontSize: 20, fontWeight: "800" }, modalContent: { padding: 18, gap: 18 }, filterSection: { gap: 10 }, filterLabel: { color: theme.colors.ink, fontSize: 13, fontWeight: "700" }, optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, option: { minHeight: 36, paddingHorizontal: 11, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface }, optionSelected: { borderColor: theme.colors.selectedBorder, backgroundColor: theme.colors.brandSoft }, optionText: { color: theme.colors.inkSoft, fontSize: 11, lineHeight: 34 }, optionSelectedText: { color: theme.colors.brand, fontWeight: "700" }, modalActions: { padding: 18, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.line, flexDirection: "row", gap: 10 }, clearButton: { flex: 1, height: 48, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.line, alignItems: "center", justifyContent: "center" }, clearButtonText: { color: theme.colors.ink, fontWeight: "700" }, applyButton: { flex: 2, height: 48, borderRadius: theme.radius.md, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" }, applyButtonText: { color: theme.colors.primaryForeground, fontWeight: "800" },
});
