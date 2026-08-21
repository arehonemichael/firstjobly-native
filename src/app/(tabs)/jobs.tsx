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
import { useIsFocused } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getSearchJobs } from "../../lib/job-api";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { EmptyState } from "../../components/ui/app-ui";
import { JobListSkeleton } from "../../components/ui/skeleton";
import { NativeAdBlock } from "../../ads/NativeAdBlock";
import { useEarlyJobInterstitial } from "../../ads/useJobInterstitial";
import { theme } from "../../constants/theme";
import { formatCategoryLabel } from "../../lib/job-formatters";
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
  if (job.salary_min != null && job.salary_max != null) {
    return `${format(job.salary_min)} - ${format(job.salary_max)}`;
  }
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
  } catch {
    // Johannesburg is UTC+2 year-round.
  }
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

function SelectBlock({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value?: string;
  values: { value: string; label: string }[];
  onChange: (value?: string) => void;
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterLabel}>{label}</Text>
      <View style={styles.optionWrap}>
        <TouchableOpacity
          style={[styles.option, !value && styles.optionSelected]}
          onPress={() => onChange(undefined)}
        >
          <Text style={[styles.optionText, !value && styles.optionSelectedText]}>Any</Text>
        </TouchableOpacity>

        {values.map((item) => {
          const selected = value === item.value;
          return (
            <TouchableOpacity
              key={item.value}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => onChange(item.value)}
            >
              <Text style={[styles.optionText, selected && styles.optionSelectedText]}>
                {item.label}
              </Text>
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

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.84} onPress={onPress}>
      <View style={styles.logo}>
        {job.company_logo_url ? (
          <ExpoImage source={{ uri: job.company_logo_url }} style={styles.logoImage} contentFit="contain" cachePolicy="memory-disk" transition={100} />
        ) : (
          <Text style={styles.logoText}>{job.company_name.charAt(0).toUpperCase()}</Text>
        )}
      </View>

      <View style={styles.jobInfo}>
        <View style={styles.companyStatusRow}>
          <Text style={styles.company} numberOfLines={1}>{job.company_name}</Text>
          <View style={styles.statusPill}><Text style={styles.statusText}>{job.is_urgent ? "Hot" : "New"}</Text></View>
          <View style={styles.bookmarkButton}><Ionicons name="bookmark-outline" size={22} color={theme.colors.ink} /></View>
        </View>

        <Text style={styles.jobTitle} numberOfLines={2}>{job.title}</Text>
        <View style={styles.meta}>
          <Ionicons name="location-outline" size={14} color={theme.colors.inkSoft} />
          <Text style={styles.metaText} numberOfLines={2}>{location}</Text>
        </View>
        <Text style={styles.description} numberOfLines={2}>{job.description}</Text>

        <View style={styles.cardFooter}>
          <View style={styles.tagsRow}>
            {tagsFor(job).map((tag, index) => (
              <View key={`${job.id}-${tag}-${index}`} style={styles.tagPill}>
                <Text style={styles.tagText} numberOfLines={1}>{tag}</Text>
              </View>
            ))}
          </View>
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
  const { openJobWithEarlyInterstitial } = useEarlyJobInterstitial();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ q?: string; category?: string; experience?: string; province?: string }>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState<JobFilters>(() => ({
    ...EMPTY_FILTERS,
    q: typeof params.q === "string" ? params.q : "",
    category: typeof params.category === "string" ? params.category : undefined,
    experience: typeof params.experience === "string" ? params.experience : undefined,
    province: typeof params.province === "string" ? params.province : undefined,
  }));
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

  useEffect(() => {
    void loadJobs(true);
  }, [loadJobs]);

  useFocusEffect(
    useCallback(() => {
      void loadJobs(false);
    }, [loadJobs]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && isFocused) void loadJobs(false);
    });
    return () => subscription.remove();
  }, [isFocused, loadJobs]);

  useEffect(() => {
    const next: JobFilters = {
      ...EMPTY_FILTERS,
      q: typeof params.q === "string" ? params.q : "",
      category: typeof params.category === "string" ? params.category : undefined,
      experience: typeof params.experience === "string" ? params.experience : undefined,
      province: typeof params.province === "string" ? params.province : undefined,
    };
    setKeyword(next.q);
    setFilters(next);
    setDraftFilters(next);
    setVisibleCount(PAGE_SIZE);
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
  const renderJob = useCallback(
    ({ item, index }: { item: Job; index: number }) => {
      const jobNumber = index + 1;
      const showNativeAd = jobNumber === 6 || (jobNumber > 6 && (jobNumber - 6) % 8 === 0);
      return (
        <>
          <JobCard
            job={item}
            onPress={() => void openJobWithEarlyInterstitial(() => router.push({ pathname: "/jobs/[id]", params: { id: item.id } }))}
          />
          {showNativeAd ? <NativeAdBlock variant="feed" /> : null}
        </>
      );
    },
    [openJobWithEarlyInterstitial],
  );

  const handleEndReached = useCallback(() => {
    if (visibleCount < results.length) setVisibleCount((count) => Math.min(count + PAGE_SIZE, results.length));
  }, [results.length, visibleCount]);

  if (loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
        <View style={{ paddingHorizontal: 16, paddingTop: 18 }}><JobListSkeleton count={6} /></View>
      </SafeAreaView>
    );
  }

  if (error && jobs.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={44} color={theme.colors.brand} />
        <Text style={styles.errorTitle}>Could not load jobs</Text>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

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
            <Text style={styles.subtitle}>{results.length} opportunities match your search</Text>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={19} color={theme.colors.inkSoft} />
                <TextInput value={keyword} onChangeText={setKeyword} onSubmitEditing={runSearch} returnKeyType="search" placeholder="Job title, company or town" placeholderTextColor={theme.colors.textMuted} style={styles.searchInput} />
              </View>
              <TouchableOpacity style={styles.searchButton} onPress={runSearch}><Ionicons name="search" size={20} color={theme.colors.primaryForeground} /></TouchableOpacity>
              <TouchableOpacity style={styles.filterButton} onPress={openFilters}>
                <Ionicons name="options-outline" size={21} color={theme.colors.ink} />
                {activeFilters.length > 0 && <View style={styles.filterCount}><Text style={styles.filterCountText}>{activeFilters.length}</Text></View>}
              </TouchableOpacity>
            </View>
            {activeFilters.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFilters}>
                {activeFilters.map((item) => (
                  <TouchableOpacity key={item.key} style={styles.activeChip} onPress={() => removeFilter(item.key)}>
                    <Text style={styles.activeChipText}>{item.label}</Text><Ionicons name="close" size={14} color={theme.colors.inkSoft} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.sortRow}>
              {([["newest", "Newest"], ["relevance", "Relevance"], ["closing", "Closing"]] as const).map(([value, label]) => (
                <TouchableOpacity key={value} style={[styles.sortButton, filters.sort === value && styles.sortButtonActive]} onPress={() => changeSort(value)}>
                  <Text style={[styles.sortText, filters.sort === value && styles.sortTextActive]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.divider} />
          </>
        }
        ListEmptyComponent={<EmptyState title="No opportunities match your filters" message="Try changing your search or removing one or more filters." />}
        ListFooterComponent={visibleJobs.length < results.length ? (
          <View style={styles.loadMore}><ActivityIndicator color={theme.colors.brand} /><Text style={styles.loadMoreText}>Loading more opportunities...</Text></View>
        ) : results.length > 0 ? <Text style={styles.endText}>You've reached all matching opportunities.</Text> : null}
      />

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setFilterOpen(false)} />
          <SafeAreaView style={styles.sheet} edges={["bottom"]}>
            <View style={styles.sheetHeader}>
              <View><Text style={styles.sheetTitle}>Filters</Text><Text style={styles.sheetSubtitle}>Narrow down your opportunities</Text></View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setFilterOpen(false)}><Ionicons name="close" size={23} color={theme.colors.ink} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              <SelectBlock label="Category" value={draftFilters.category} values={CATEGORIES.map((c) => ({ value: c.key, label: formatCategoryLabel(c.key) }))} onChange={(category) => setDraftFilters((current) => ({ ...current, category }))} />
              <SelectBlock label="Province" value={draftFilters.province} values={PROVINCES.map((province) => ({ value: province, label: province }))} onChange={(province) => setDraftFilters((current) => ({ ...current, province }))} />
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>City / town</Text>
                <TextInput value={draftFilters.city ?? ""} onChangeText={(city) => setDraftFilters((current) => ({ ...current, city: city || undefined }))} placeholder="e.g. Polokwane" placeholderTextColor={theme.colors.textMuted} style={styles.filterInput} />
              </View>
              <SelectBlock label="Experience level" value={draftFilters.experience} values={EXPERIENCE_LEVELS.map((level) => ({ value: level, label: formatCategoryLabel(level) }))} onChange={(experience) => setDraftFilters((current) => ({ ...current, experience }))} />
              <SelectBlock label="Minimum education" value={draftFilters.education} values={EDUCATION_LEVELS.map((level) => ({ value: level, label: formatCategoryLabel(level) }))} onChange={(education) => setDraftFilters((current) => ({ ...current, education }))} />
              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>Minimum salary: R{(draftFilters.minSalary ?? 0).toLocaleString("en-ZA")} p/m</Text>
                <View style={styles.salaryOptions}>
                  {[0, 5000, 10000, 15000, 20000, 30000, 40000].map((amount) => {
                    const selected = (draftFilters.minSalary ?? 0) === amount;
                    return (
                      <TouchableOpacity key={amount} style={[styles.salaryOption, selected && styles.salaryOptionSelected]} onPress={() => setDraftFilters((current) => ({ ...current, minSalary: amount === 0 ? undefined : amount }))}>
                        <Text style={[styles.salaryOptionText, selected && styles.salaryOptionTextSelected]}>{amount === 0 ? "Any salary" : `R${amount.toLocaleString("en-ZA")}+`}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <SelectBlock label="Closing date" value={draftFilters.closingWithin ? String(draftFilters.closingWithin) : undefined} values={[{ value: "7", label: "Within 7 days" }, { value: "14", label: "Within 14 days" }, { value: "30", label: "Within 30 days" }]} onChange={(value) => setDraftFilters((current) => ({ ...current, closingWithin: value ? Number(value) : undefined }))} />
              <TouchableOpacity style={styles.clearButton} onPress={clearFilters}><Text style={styles.clearText}>Clear filters</Text></TouchableOpacity>
            </ScrollView>
            <View style={styles.sheetFooter}><TouchableOpacity style={styles.applyFiltersButton} onPress={applyFilters}><Text style={styles.applyFiltersText}>Show matching jobs</Text></TouchableOpacity></View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: theme.colors.background },
  list: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 110 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "800", color: theme.colors.ink, letterSpacing: -0.4 },
  subtitle: { marginTop: 4, color: theme.colors.inkSoft, fontSize: 13, lineHeight: 18 },
  searchRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  searchBox: { flex: 1, height: 48, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, paddingHorizontal: 13, flexDirection: "row", alignItems: "center" },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: theme.colors.ink },
  searchButton: { width: 48, height: 48, borderRadius: theme.radius.md, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
  filterButton: { width: 48, height: 48, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center" },
  filterCount: { position: "absolute", top: -5, right: -5, minWidth: 19, height: 19, paddingHorizontal: 4, borderRadius: theme.radius.pill, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
  filterCountText: { color: theme.colors.primaryForeground, fontSize: 10, fontWeight: "800" },
  activeFilters: { gap: 7, paddingTop: 12 },
  activeChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: theme.colors.brandSoft, borderWidth: 1, borderColor: theme.colors.selectedBorder, paddingHorizontal: 10, paddingVertical: 7, borderRadius: theme.radius.pill },
  activeChipText: { color: theme.colors.brand, fontSize: 11, fontWeight: "600" },
  sortRow: { flexDirection: "row", gap: 6, marginTop: 14 },
  sortButton: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.line },
  sortButtonActive: { backgroundColor: theme.colors.brandSoft, borderColor: theme.colors.selectedBorder },
  sortText: { fontSize: 12, fontWeight: "700", color: theme.colors.inkSoft },
  sortTextActive: { color: theme.colors.brand },
  divider: { height: 1, backgroundColor: theme.colors.line, marginTop: 16, marginBottom: 12 },
  card: { minHeight: 170, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.line, padding: 12, flexDirection: "row", gap: 12, marginBottom: 10, ...theme.shadow.card },
  logo: { width: 56, height: 56, borderRadius: theme.radius.sm, backgroundColor: theme.colors.brandSoft, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoImage: { width: 46, height: 46 },
  logoText: { color: theme.colors.brand, fontWeight: "800", fontSize: 24 },
  jobInfo: { flex: 1, minWidth: 0 },
  companyStatusRow: { minHeight: 24, flexDirection: "row", alignItems: "center", paddingRight: 34, gap: 7 },
  company: { flex: 1, minWidth: 0, color: theme.colors.ink, fontSize: 15, lineHeight: 20, fontWeight: "700" },
  statusPill: { flexShrink: 0, paddingHorizontal: 7, height: 23, borderRadius: 7, borderWidth: 1, borderColor: theme.colors.selectedBorder, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center" },
  statusText: { color: theme.colors.brand, fontSize: 11, fontWeight: "600" },
  bookmarkButton: { position: "absolute", right: 0, top: -1, width: 30, height: 30, alignItems: "flex-end", justifyContent: "flex-start" },
  jobTitle: { color: theme.colors.ink, fontSize: 14, lineHeight: 19, fontWeight: "600", marginTop: 4 },
  meta: { marginTop: 5, flexDirection: "row", alignItems: "flex-start", gap: 4, paddingRight: 6 },
  metaText: { flex: 1, minWidth: 0, color: theme.colors.inkSoft, fontSize: 11, lineHeight: 15 },
  description: { color: theme.colors.inkSoft, fontSize: 12, lineHeight: 17, marginTop: 10, maxWidth: 330 },
  cardFooter: { marginTop: 11, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  tagsRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagPill: { minHeight: 24, paddingHorizontal: 8, borderRadius: 7, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  tagText: { color: theme.colors.ink, fontSize: 10, lineHeight: 14, fontWeight: "500" },
  postedSalaryStack: { flexShrink: 0, alignItems: "flex-end", gap: 2, maxWidth: 136 },
  postedPill: { minHeight: 26, paddingHorizontal: 9, borderRadius: 8, backgroundColor: theme.colors.brandSoft, alignItems: "center", justifyContent: "center" },
  postedText: { color: theme.colors.brand, fontSize: 10, lineHeight: 14, fontWeight: "500" },
  closingText: { flexShrink: 1, color: theme.colors.danger, fontSize: 10, lineHeight: 14, fontWeight: "700", marginTop: 3 },
  salaryText: { flexShrink: 1, color: theme.colors.brand, fontSize: 10, lineHeight: 14, fontWeight: "600", marginTop: 3 },
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(23,33,43,0.45)" },
  sheet: { maxHeight: "88%", backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg },
  sheetHeader: { padding: 18, borderBottomWidth: 1, borderBottomColor: theme.colors.line, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: theme.colors.ink },
  sheetSubtitle: { color: theme.colors.inkSoft, fontSize: 12, marginTop: 2 },
  closeButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  sheetContent: { padding: 18, paddingBottom: 30 },
  filterSection: { marginBottom: 24 },
  filterLabel: { marginBottom: 10, color: theme.colors.inkSoft, fontSize: 13, fontWeight: "700" },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  option: { borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.pill, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: theme.colors.surface },
  optionSelected: { borderColor: theme.colors.selectedBorder, backgroundColor: theme.colors.brandSoft },
  optionText: { color: theme.colors.inkSoft, fontSize: 11, fontWeight: "600" },
  optionSelectedText: { color: theme.colors.brand },
  filterInput: { height: 48, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, paddingHorizontal: 13, color: theme.colors.ink, backgroundColor: theme.colors.surface },
  salaryOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  salaryOption: { borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, paddingHorizontal: 11, paddingVertical: 9, borderRadius: theme.radius.pill },
  salaryOptionSelected: { borderColor: theme.colors.selectedBorder, backgroundColor: theme.colors.brandSoft },
  salaryOptionText: { color: theme.colors.inkSoft, fontSize: 11, fontWeight: "600" },
  salaryOptionTextSelected: { color: theme.colors.brand, fontWeight: "700" },
  clearButton: { height: 48, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center" },
  clearText: { color: theme.colors.inkSoft, fontWeight: "700" },
  sheetFooter: { padding: 16, borderTopWidth: 1, borderTopColor: theme.colors.line },
  applyFiltersButton: { height: 54, borderRadius: theme.radius.md, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
  applyFiltersText: { color: theme.colors.primaryForeground, fontWeight: "800", fontSize: 15 },
  loadMore: { alignItems: "center", paddingVertical: 25 },
  loadMoreText: { marginTop: 7, color: theme.colors.inkSoft, fontSize: 11 },
  endText: { textAlign: "center", color: theme.colors.textMuted, fontSize: 11, paddingVertical: 28 },
  errorTitle: { marginTop: 12, color: theme.colors.ink, fontSize: 19, fontWeight: "800" },
  errorText: { marginTop: 5, textAlign: "center", color: theme.colors.inkSoft },
});