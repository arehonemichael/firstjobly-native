import {
  AppPressable as Pressable,
  AppText as Text,
  AppTextInput as TextInput,
  AppTouchableOpacity as TouchableOpacity,
} from "../../components/ui/primitives";
import { JobMetadata } from "../../components/ui/job-metadata";
import { Colors, Fonts, Radius } from "../../constants/theme";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { Icon as Ionicons } from "../../components/ui/icon";
import { Image as ExpoImage } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { getSearchJobs } from "../../lib/job-api";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { EmptyState, InlineErrorState } from "../../components/ui/app-ui";
import { JobListSkeleton } from "../../components/ui/skeleton";
import { NativeAdBlock } from "../../ads/NativeAdBlock";
import { useEarlyJobInterstitial } from "../../ads/useJobInterstitial";
import type { Job } from "../../lib/jobs";
import {
  CATEGORIES,
  EDUCATION_LEVELS,
  EMPTY_FILTERS,
  EXPERIENCE_LEVELS,
  PROVINCES,
  categoryLabel,
  daysUntil,
  filterJobs,
  type JobFilters,
  type JobSort,
} from "../../lib/job-filters";

const PAGE_SIZE = 25;

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
          <Text
            style={[styles.optionText, !value && styles.optionSelectedText]}
          >
            Any
          </Text>
        </TouchableOpacity>

        {values.map((item) => {
          const selected = value === item.value;

          return (
            <TouchableOpacity
              key={item.value}
              accessibilityState={{ selected }}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => onChange(item.value)}
            >
              <Text
                style={[
                  styles.optionText,
                  selected && styles.optionSelectedText,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const JobCard = memo(function JobCard({
  job,
  onPress,
}: {
  job: Job;
  onPress: () => void;
}) {
  const location = job.city ? `${job.city}, ${job.province}` : job.province;

  const closing = daysUntil(job.closing_date);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={onPress}
    >
      {job.company_logo_url ? (
        <ExpoImage
          source={{ uri: job.company_logo_url }}
          style={styles.logo}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={100}
        />
      ) : (
        <View style={styles.logo}>
          <Text style={styles.logoText}>
            {job.company_name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.jobInfo}>
        <View style={styles.titleRow}>
          <Text style={styles.jobTitle}>{job.title}</Text>

          {job.is_urgent && (
            <View style={styles.urgent}>
              <Text style={styles.urgentText}>Urgent</Text>
            </View>
          )}
        </View>

        <Text style={styles.company}>{job.company_name}</Text>

        <View style={styles.meta}>
          <Ionicons name="location-outline" size={14} color={Colors.muted} />

          <Text style={styles.metaText} numberOfLines={1}>
            {location}
          </Text>
        </View>

        <JobMetadata job={job} />
        <View style={styles.cardFooter}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {categoryLabel(job.category)}
            </Text>
          </View>

          {closing !== null && closing >= 0 && (
            <Text style={[styles.closing, closing <= 7 && styles.closingSoon]}>
              {closing === 0 ? "Closes today" : `${closing} days left`}
            </Text>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={19} color={Colors.mutedSubtle} />
    </TouchableOpacity>
  );
});

export default function JobsScreen() {
  const bottomContentPadding = useScreenBottomPadding(true);
  const { openJobWithEarlyInterstitial } = useEarlyJobInterstitial();
  const params = useLocalSearchParams<{
    q?: string;
    category?: string;
    experience?: string;
    province?: string;
  }>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] = useState<JobFilters>(() => ({
    ...EMPTY_FILTERS,
    q: typeof params.q === "string" ? params.q : "",
    category: typeof params.category === "string" ? params.category : undefined,
    experience:
      typeof params.experience === "string" ? params.experience : undefined,
    province: typeof params.province === "string" ? params.province : undefined,
  }));

  const [draftFilters, setDraftFilters] = useState<JobFilters>(filters);

  const [keyword, setKeyword] = useState(
    typeof params.q === "string" ? params.q : "",
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    getSearchJobs()
      .then(setJobs)
      .catch((err) => {
        console.error("Search jobs failed:", err);
        setError(err instanceof Error ? err.message : "Could not load jobs");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const next: JobFilters = {
      ...EMPTY_FILTERS,
      q: typeof params.q === "string" ? params.q : "",
      category:
        typeof params.category === "string" ? params.category : undefined,
      experience:
        typeof params.experience === "string" ? params.experience : undefined,
      province:
        typeof params.province === "string" ? params.province : undefined,
    };

    setKeyword(next.q);
    setFilters(next);
    setDraftFilters(next);
    setVisibleCount(PAGE_SIZE);
  }, [params.q, params.category, params.experience, params.province]);

  const results = useMemo(() => filterJobs(jobs, filters), [jobs, filters]);

  const visibleJobs = useMemo(
    () => results.slice(0, visibleCount),
    [results, visibleCount],
  );

  const activeFilters = useMemo(() => {
    const list: { key: keyof JobFilters; label: string }[] = [];

    if (filters.category) {
      list.push({
        key: "category",
        label: categoryLabel(filters.category),
      });
    }

    if (filters.province) {
      list.push({
        key: "province",
        label: filters.province,
      });
    }

    if (filters.city) {
      list.push({
        key: "city",
        label: filters.city,
      });
    }

    if (filters.experience) {
      list.push({
        key: "experience",
        label: filters.experience,
      });
    }

    if (filters.education) {
      list.push({
        key: "education",
        label: filters.education,
      });
    }

    if (filters.minSalary) {
      list.push({
        key: "minSalary",
        label: `R${filters.minSalary.toLocaleString("en-ZA")}+ p/m`,
      });
    }

    if (filters.closingWithin) {
      list.push({
        key: "closingWithin",
        label: `Closing in ${filters.closingWithin} days`,
      });
    }

    return list;
  }, [filters]);

  function runSearch() {
    setVisibleCount(PAGE_SIZE);
    setFilters((current) => ({
      ...current,
      q: keyword.trim(),
    }));
  }

  function changeSort(sort: JobSort) {
    setVisibleCount(PAGE_SIZE);
    setFilters((current) => ({
      ...current,
      sort,
    }));
  }

  function openFilters() {
    setDraftFilters(filters);
    setFilterOpen(true);
  }

  function applyFilters() {
    setVisibleCount(PAGE_SIZE);
    setFilters(draftFilters);
    setFilterOpen(false);
  }

  function clearFilters() {
    setDraftFilters({
      q: filters.q,
      sort: filters.sort,
    });
  }

  function removeFilter(key: keyof JobFilters) {
    setVisibleCount(PAGE_SIZE);

    setFilters((current) => ({
      ...current,
      [key]: undefined,
    }));
  }

  const keyExtractor = useCallback((job: Job) => job.id, []);

  const renderJob = useCallback(
    ({ item, index }: { item: Job; index: number }) => {
      const jobNumber = index + 1;
      const showNativeAd =
        jobNumber === 6 || (jobNumber > 6 && (jobNumber - 6) % 8 === 0);

      return (
        <>
          <JobCard
            job={item}
            onPress={() =>
              void openJobWithEarlyInterstitial(() =>
                router.push({
                  pathname: "/jobs/[id]",
                  params: { id: item.id },
                }),
              )
            }
          />
          {showNativeAd ? <NativeAdBlock variant="feed" /> : null}
        </>
      );
    },
    [openJobWithEarlyInterstitial],
  );

  const handleEndReached = useCallback(() => {
    if (visibleCount < results.length) {
      setVisibleCount((count) => Math.min(count + PAGE_SIZE, results.length));
    }
  }, [results.length, visibleCount]);
  if (loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
        <View style={{ paddingHorizontal: 16, paddingTop: 18 }}>
          <JobListSkeleton count={6} />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons
          name="cloud-offline-outline"
          size={44}
          color={Colors.primary}
        />

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
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomContentPadding },
        ]}
        showsVerticalScrollIndicator={false}
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

            <Text style={styles.subtitle}>
              {results.length} opportunities match your search
            </Text>

            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={19}
                  color={Colors.muted}
                />

                <TextInput
                  value={keyword}
                  onChangeText={setKeyword}
                  onSubmitEditing={runSearch}
                  returnKeyType="search"
                  placeholder="Job title, company or town"
                  placeholderTextColor={Colors.mutedSubtle}
                  accessibilityLabel="Search jobs or companies"
                  style={styles.searchInput}
                />
              </View>

              <TouchableOpacity
                accessibilityLabel="Search jobs"
                style={styles.searchButton}
                onPress={runSearch}
              >
                <Ionicons name="search" size={20} color={Colors.surface} />
              </TouchableOpacity>

              <TouchableOpacity
                accessibilityLabel="Open filters"
                style={styles.filterButton}
                onPress={openFilters}
              >
                <Ionicons
                  name="options-outline"
                  size={21}
                  color={Colors.foreground}
                />

                {activeFilters.length > 0 && (
                  <View style={styles.filterCount}>
                    <Text style={styles.filterCountText}>
                      {activeFilters.length}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {activeFilters.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.activeFilters}
              >
                {activeFilters.map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    accessibilityLabel={`Remove filter: ${item.label}`}
                    style={styles.activeChip}
                    onPress={() => removeFilter(item.key)}
                  >
                    <Text style={styles.activeChipText}>{item.label}</Text>

                    <Ionicons name="close" size={14} color={Colors.muted} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={styles.sortRow}>
              {(
                [
                  ["newest", "Newest"],
                  ["relevance", "Relevance"],
                  ["closing", "Closing"],
                ] as const
              ).map(([value, label]) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.sortButton,
                    filters.sort === value && styles.sortButtonActive,
                  ]}
                  onPress={() => changeSort(value)}
                >
                  <Text
                    style={[
                      styles.sortText,
                      filters.sort === value && styles.sortTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />
          </>
        }
        ListEmptyComponent={
          <EmptyState
            title="No opportunities match your filters"
            message="Try changing your search or removing one or more filters."
          />
        }
        ListFooterComponent={
          visibleJobs.length < results.length ? (
            <View style={styles.loadMore}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.loadMoreText}>
                Loading more opportunities...
              </Text>
            </View>
          ) : results.length > 0 ? (
            <Text style={styles.endText}>
              You’ve reached all matching opportunities.
            </Text>
          ) : null
        }
      />

      <Modal
        accessibilityViewIsModal
        visible={filterOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setFilterOpen(false)}
          />

          <SafeAreaView style={styles.sheet} edges={["bottom"]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Filters</Text>
                <Text style={styles.sheetSubtitle}>
                  Narrow down your opportunities
                </Text>
              </View>

              <TouchableOpacity
                accessibilityLabel="Close filters"
                style={styles.closeButton}
                onPress={() => setFilterOpen(false)}
              >
                <Ionicons name="close" size={23} color={Colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              <SelectBlock
                label="Category"
                value={draftFilters.category}
                values={CATEGORIES.map((c) => ({
                  value: c.key,
                  label: c.label,
                }))}
                onChange={(category) =>
                  setDraftFilters((current) => ({
                    ...current,
                    category,
                  }))
                }
              />

              <SelectBlock
                label="Province"
                value={draftFilters.province}
                values={PROVINCES.map((province) => ({
                  value: province,
                  label: province,
                }))}
                onChange={(province) =>
                  setDraftFilters((current) => ({
                    ...current,
                    province,
                  }))
                }
              />

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>City / town</Text>

                <TextInput
                  value={draftFilters.city ?? ""}
                  onChangeText={(city) =>
                    setDraftFilters((current) => ({
                      ...current,
                      city: city || undefined,
                    }))
                  }
                  placeholder="e.g. Polokwane"
                  placeholderTextColor={Colors.mutedSubtle}
                  style={styles.filterInput}
                />
              </View>

              <SelectBlock
                label="Experience level"
                value={draftFilters.experience}
                values={EXPERIENCE_LEVELS.map((level) => ({
                  value: level,
                  label: level,
                }))}
                onChange={(experience) =>
                  setDraftFilters((current) => ({
                    ...current,
                    experience,
                  }))
                }
              />

              <SelectBlock
                label="Minimum education"
                value={draftFilters.education}
                values={EDUCATION_LEVELS.map((level) => ({
                  value: level,
                  label: level,
                }))}
                onChange={(education) =>
                  setDraftFilters((current) => ({
                    ...current,
                    education,
                  }))
                }
              />

              <View style={styles.filterSection}>
                <Text style={styles.filterLabel}>
                  Minimum salary: R
                  {(draftFilters.minSalary ?? 0).toLocaleString("en-ZA")} p/m
                </Text>

                <View style={styles.salaryOptions}>
                  {[0, 5000, 10000, 15000, 20000, 30000, 40000].map(
                    (amount) => {
                      const selected = (draftFilters.minSalary ?? 0) === amount;

                      return (
                        <TouchableOpacity
                          key={amount}
                          style={[
                            styles.salaryOption,
                            selected && styles.salaryOptionSelected,
                          ]}
                          onPress={() =>
                            setDraftFilters((current) => ({
                              ...current,
                              minSalary: amount === 0 ? undefined : amount,
                            }))
                          }
                        >
                          <Text
                            style={[
                              styles.salaryOptionText,
                              selected && styles.salaryOptionTextSelected,
                            ]}
                          >
                            {amount === 0
                              ? "Any salary"
                              : `R${amount.toLocaleString("en-ZA")}+`}
                          </Text>
                        </TouchableOpacity>
                      );
                    },
                  )}
                </View>
              </View>

              <SelectBlock
                label="Closing date"
                value={
                  draftFilters.closingWithin
                    ? String(draftFilters.closingWithin)
                    : undefined
                }
                values={[
                  {
                    value: "7",
                    label: "Within 7 days",
                  },
                  {
                    value: "14",
                    label: "Within 14 days",
                  },
                  {
                    value: "30",
                    label: "Within 30 days",
                  },
                ]}
                onChange={(value) =>
                  setDraftFilters((current) => ({
                    ...current,
                    closingWithin: value ? Number(value) : undefined,
                  }))
                }
              />

              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearFilters}
              >
                <Text style={styles.clearText}>Clear filters</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.applyFiltersButton}
                onPress={applyFilters}
              >
                <Text style={styles.applyFiltersText}>Show matching jobs</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: Colors.background,
  },

  list: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 110,
  },

  title: {
    fontSize: 26,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    color: Colors.foreground,
  },

  subtitle: {
    marginTop: 3,
    color: Colors.muted,
    fontSize: 13,
  },

  searchRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },

  searchBox: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.input,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: Colors.foreground,
  },

  searchButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  filterButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.input,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },

  filterCount: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  filterCountText: {
    color: Colors.surface,
    fontSize: 11,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },

  activeFilters: {
    gap: 7,
    paddingTop: 12,
  },

  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },

  activeChipText: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: Fonts.semibold,
    fontWeight: "600",
  },

  sortRow: { flexWrap: "wrap", flexDirection: "row", gap: 5, marginTop: 14 },

  sortButton: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: Colors.secondary,
  },

  sortButtonActive: {
    backgroundColor: Colors.foreground,
  },

  sortText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    color: Colors.muted,
  },

  sortTextActive: {
    color: Colors.surface,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 16,
    marginBottom: 10,
  },

  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  logo: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },

  logoText: {
    color: Colors.primary,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    fontSize: 19,
  },

  jobInfo: {
    flex: 1,
    marginHorizontal: 12,
    minWidth: 0,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },

  jobTitle: {
    flex: 1,
    color: Colors.foreground,
    fontSize: 16,
    fontFamily: Fonts.semibold,
    fontWeight: "600",
    lineHeight: 23,
  },

  company: {
    marginTop: 3,
    color: Colors.muted,
    fontSize: 12,
  },

  meta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },

  metaText: {
    color: Colors.muted,
    fontSize: 11,
    marginLeft: 4,
    flex: 1,
  },

  cardFooter: {
    flexWrap: "wrap",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  categoryBadge: {
    backgroundColor: Colors.secondary,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  categoryText: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    color: Colors.muted,
  },

  urgent: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  urgentText: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },

  closing: {
    color: Colors.muted,
    fontSize: 11,
  },

  closingSoon: {
    color: Colors.primary,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },

  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(11,31,48,0.45)",
  },

  sheet: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
    maxHeight: "88%",
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  sheetHeader: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sheetTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    color: Colors.foreground,
  },

  sheetSubtitle: {
    color: Colors.muted,
    fontSize: 12,
    marginTop: 2,
  },

  closeButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  sheetContent: {
    padding: 18,
    paddingBottom: 30,
  },

  filterSection: {
    marginBottom: 24,
  },

  filterLabel: {
    marginBottom: 10,
    color: Colors.muted,
    fontSize: 13,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },

  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  option: {
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },

  optionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },

  optionText: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: Fonts.semibold,
    fontWeight: "600",
  },

  optionSelectedText: {
    color: Colors.primary,
  },

  filterInput: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: Radius.sm,
    paddingHorizontal: 13,
    color: Colors.foreground,
  },

  salaryOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  salaryOption: {
    borderWidth: 1,
    borderColor: Colors.input,
    backgroundColor: Colors.surface,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 7,
  },

  salaryOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },

  salaryOptionText: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: Fonts.semibold,
    fontWeight: "600",
  },

  salaryOptionTextSelected: {
    color: Colors.primary,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },

  salaryEnds: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  salaryLabel: {
    color: Colors.mutedSubtle,
    fontSize: 11,
  },

  clearButton: {
    height: 48,
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  clearText: {
    color: Colors.muted,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },

  sheetFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },

  applyFiltersButton: {
    height: 54,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  applyFiltersText: {
    color: Colors.surface,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    fontSize: 15,
  },

  empty: {
    alignItems: "center",
    paddingVertical: 70,
    paddingHorizontal: 25,
  },

  emptyTitle: {
    marginTop: 12,
    color: Colors.foreground,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },

  emptyText: {
    marginTop: 5,
    color: Colors.muted,
    fontSize: 12,
    textAlign: "center",
  },

  loadMore: {
    alignItems: "center",
    paddingVertical: 25,
  },

  loadMoreText: {
    marginTop: 7,
    color: Colors.muted,
    fontSize: 11,
  },

  endText: {
    textAlign: "center",
    color: Colors.mutedSubtle,
    fontSize: 11,
    paddingVertical: 28,
  },

  loadingText: {
    marginTop: 12,
    color: Colors.muted,
  },

  errorTitle: {
    marginTop: 12,
    color: Colors.foreground,
    fontSize: 19,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },

  errorText: {
    marginTop: 5,
    textAlign: "center",
    color: Colors.muted,
  },
});
