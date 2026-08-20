import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { NativeAdBlock } from "../../ads/NativeAdBlock";
import { getSearchJobs } from "../../lib/job-api";
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
const FIRST_NATIVE_AD_AFTER = 6;
const NATIVE_AD_INTERVAL = 8;

function shouldShowNativeAdAfter(index: number) {
  const jobNumber = index + 1;
  return (
    jobNumber >= FIRST_NATIVE_AD_AFTER &&
    (jobNumber - FIRST_NATIVE_AD_AFTER) % NATIVE_AD_INTERVAL === 0
  );
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
          style={[
            styles.option,
            !value && styles.optionSelected,
          ]}
          onPress={() => onChange(undefined)}
        >
          <Text
            style={[
              styles.optionText,
              !value && styles.optionSelectedText,
            ]}
          >
            Any
          </Text>
        </TouchableOpacity>

        {values.map((item) => {
          const selected = value === item.value;

          return (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.option,
                selected && styles.optionSelected,
              ]}
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

function JobCard({ job }: { job: Job }) {
  const location = job.city
    ? `${job.city}, ${job.province}`
    : job.province;

  const closing = daysUntil(job.closing_date);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.75}
      onPress={() =>
        router.push({
          pathname: "/jobs/[id]",
          params: { id: job.id },
        })
      }
    >
      {job.company_logo_url ? (
        <Image
          source={{ uri: job.company_logo_url }}
          style={styles.logo}
          resizeMode="contain"
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
          <Text style={styles.jobTitle} numberOfLines={2}>
            {job.title}
          </Text>

          {job.is_urgent && (
            <View style={styles.urgent}>
              <Text style={styles.urgentText}>Urgent</Text>
            </View>
          )}
        </View>

        <Text style={styles.company}>
          {job.company_name}
        </Text>

        <View style={styles.meta}>
          <Ionicons
            name="location-outline"
            size={14}
            color="#667085"
          />

          <Text style={styles.metaText} numberOfLines={1}>
            {location}
          </Text>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {categoryLabel(job.category)}
            </Text>
          </View>

          {closing !== null && closing >= 0 && (
            <Text
              style={[
                styles.closing,
                closing <= 7 && styles.closingSoon,
              ]}
            >
              {closing === 0
                ? "Closes today"
                : `${closing} days left`}
            </Text>
          )}
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={19}
        color="#98A2B3"
      />
    </TouchableOpacity>
  );
}

export default function JobsScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filters, setFilters] =
    useState<JobFilters>(EMPTY_FILTERS);

  const [draftFilters, setDraftFilters] =
    useState<JobFilters>(EMPTY_FILTERS);

  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    getSearchJobs()
      .then(setJobs)
      .catch((err) => {
        console.error("Search jobs failed:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Could not load jobs"
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(
    () => filterJobs(jobs, filters),
    [jobs, filters]
  );

  const visibleJobs = results.slice(0, visibleCount);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator
          size="large"
          color="#E31C5F"
        />
        <Text style={styles.loadingText}>
          Loading opportunities...
        </Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons
          name="cloud-offline-outline"
          size={44}
          color="#E31C5F"
        />

        <Text style={styles.errorTitle}>
          Could not load jobs
        </Text>

        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.page}
      edges={["top"]}
    >
      <FlatList
        data={visibleJobs}
        keyExtractor={(job) => job.id}
        renderItem={({ item, index }) => (
          <>
            <JobCard job={item} />
            {shouldShowNativeAdAfter(index) ? (
              <NativeAdBlock variant="feed" />
            ) : null}
          </>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (visibleCount < results.length) {
            setVisibleCount((count) =>
              Math.min(count + PAGE_SIZE, results.length)
            );
          }
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>
              Search jobs
            </Text>

            <Text style={styles.subtitle}>
              {results.length} opportunities match your search
            </Text>

            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Ionicons
                  name="search-outline"
                  size={19}
                  color="#667085"
                />

                <TextInput
                  value={keyword}
                  onChangeText={setKeyword}
                  onSubmitEditing={runSearch}
                  returnKeyType="search"
                  placeholder="Job title, company or town"
                  placeholderTextColor="#98A2B3"
                  style={styles.searchInput}
                />
              </View>

              <TouchableOpacity
                style={styles.searchButton}
                onPress={runSearch}
              >
                <Ionicons
                  name="search"
                  size={20}
                  color="#FFFFFF"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterButton}
                onPress={openFilters}
              >
                <Ionicons
                  name="options-outline"
                  size={21}
                  color="#0B1F30"
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
                    style={styles.activeChip}
                    onPress={() => removeFilter(item.key)}
                  >
                    <Text style={styles.activeChipText}>
                      {item.label}
                    </Text>

                    <Ionicons
                      name="close"
                      size={14}
                      color="#344054"
                    />
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
                    filters.sort === value &&
                      styles.sortButtonActive,
                  ]}
                  onPress={() => changeSort(value)}
                >
                  <Text
                    style={[
                      styles.sortText,
                      filters.sort === value &&
                        styles.sortTextActive,
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
          <View style={styles.empty}>
            <Ionicons
              name="search-outline"
              size={34}
              color="#98A2B3"
            />

            <Text style={styles.emptyTitle}>
              No jobs match those filters
            </Text>

            <Text style={styles.emptyText}>
              Try a wider province or remove one of your filters.
            </Text>
          </View>
        }
        ListFooterComponent={
          visibleJobs.length < results.length ? (
            <View style={styles.loadMore}>
              <ActivityIndicator color="#E31C5F" />
              <Text style={styles.loadMoreText}>
                Loading more opportunities...
              </Text>
            </View>
          ) : results.length > 0 ? (
            <Text style={styles.endText}>
              You've reached all matching opportunities.
            </Text>
          ) : null
        }
      />

      <Modal
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

          <SafeAreaView
            style={styles.sheet}
            edges={["bottom"]}
          >
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>
                  Filters
                </Text>
                <Text style={styles.sheetSubtitle}>
                  Narrow down your opportunities
                </Text>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setFilterOpen(false)}
              >
                <Ionicons
                  name="close"
                  size={23}
                  color="#0B1F30"
                />
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
                <Text style={styles.filterLabel}>
                  City / town
                </Text>

                <TextInput
                  value={draftFilters.city ?? ""}
                  onChangeText={(city) =>
                    setDraftFilters((current) => ({
                      ...current,
                      city: city || undefined,
                    }))
                  }
                  placeholder="e.g. Polokwane"
                  placeholderTextColor="#98A2B3"
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
                  {(draftFilters.minSalary ?? 0).toLocaleString(
                    "en-ZA"
                  )}{" "}
                  p/m
                </Text>

                <View style={styles.salaryOptions}>
                  {[0, 5000, 10000, 15000, 20000, 30000, 40000].map((amount) => {
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
                  })}
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
                    closingWithin: value
                      ? Number(value)
                      : undefined,
                  }))
                }
              />

              <TouchableOpacity
                style={styles.clearButton}
                onPress={clearFilters}
              >
                <Text style={styles.clearText}>
                  Clear filters
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.sheetFooter}>
              <TouchableOpacity
                style={styles.applyFiltersButton}
                onPress={applyFilters}
              >
                <Text style={styles.applyFiltersText}>
                  Show matching jobs
                </Text>
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
    backgroundColor: "#FAFAFA",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FAFAFA",
  },

  list: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 40,
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0B1F30",
  },

  subtitle: {
    marginTop: 3,
    color: "#667085",
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
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
  },

  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: "#101828",
  },

  searchButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#E31C5F",
    alignItems: "center",
    justifyContent: "center",
  },

  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
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
    borderRadius: 10,
    backgroundColor: "#E31C5F",
    alignItems: "center",
    justifyContent: "center",
  },

  filterCountText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },

  activeFilters: {
    gap: 7,
    paddingTop: 12,
  },

  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F2F4F7",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },

  activeChipText: {
    color: "#344054",
    fontSize: 11,
    fontWeight: "600",
  },

  sortRow: {
    flexDirection: "row",
    gap: 5,
    marginTop: 14,
  },

  sortButton: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: "#F2F4F7",
  },

  sortButtonActive: {
    backgroundColor: "#0B1F30",
  },

  sortText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#667085",
  },

  sortTextActive: {
    color: "#FFFFFF",
  },

  divider: {
    height: 1,
    backgroundColor: "#EAECF0",
    marginTop: 16,
    marginBottom: 10,
  },

  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECF0",
  },

  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#F2F4F7",
    alignItems: "center",
    justifyContent: "center",
  },

  logoText: {
    color: "#E31C5F",
    fontWeight: "800",
    fontSize: 19,
  },

  jobInfo: {
    flex: 1,
    marginHorizontal: 12,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },

  jobTitle: {
    flex: 1,
    color: "#101828",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },

  company: {
    marginTop: 3,
    color: "#475467",
    fontSize: 12,
  },

  meta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 7,
  },

  metaText: {
    color: "#667085",
    fontSize: 11,
    marginLeft: 4,
    flex: 1,
  },

  cardFooter: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  categoryBadge: {
    backgroundColor: "#F2F4F7",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },

  categoryText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#344054",
  },

  urgent: {
    backgroundColor: "#FFF0F5",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },

  urgentText: {
    color: "#E31C5F",
    fontSize: 9,
    fontWeight: "800",
  },

  closing: {
    color: "#667085",
    fontSize: 10,
  },

  closingSoon: {
    color: "#E31C5F",
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
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  sheetHeader: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECF0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sheetTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0B1F30",
  },

  sheetSubtitle: {
    color: "#667085",
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
    color: "#344054",
    fontSize: 13,
    fontWeight: "700",
  },

  optionWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },

  option: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },

  optionSelected: {
    borderColor: "#E31C5F",
    backgroundColor: "#FFF0F5",
  },

  optionText: {
    color: "#475467",
    fontSize: 11,
    fontWeight: "600",
  },

  optionSelectedText: {
    color: "#E31C5F",
  },

  filterInput: {
    height: 48,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 8,
    paddingHorizontal: 13,
    color: "#101828",
  },

  salaryOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  salaryOption: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 7,
  },

  salaryOptionSelected: {
    borderColor: "#E31C5F",
    backgroundColor: "#FFF0F5",
  },

  salaryOptionText: {
    color: "#475467",
    fontSize: 11,
    fontWeight: "600",
  },

  salaryOptionTextSelected: {
    color: "#E31C5F",
    fontWeight: "700",
  },

  salaryEnds: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  salaryLabel: {
    color: "#98A2B3",
    fontSize: 10,
  },

  clearButton: {
    height: 48,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },

  clearText: {
    color: "#344054",
    fontWeight: "700",
  },

  sheetFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#EAECF0",
  },

  applyFiltersButton: {
    height: 54,
    borderRadius: 10,
    backgroundColor: "#E31C5F",
    alignItems: "center",
    justifyContent: "center",
  },

  applyFiltersText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },

  empty: {
    alignItems: "center",
    paddingVertical: 70,
    paddingHorizontal: 25,
  },

  emptyTitle: {
    marginTop: 12,
    color: "#0B1F30",
    fontWeight: "800",
  },

  emptyText: {
    marginTop: 5,
    color: "#667085",
    fontSize: 12,
    textAlign: "center",
  },

  loadMore: {
    alignItems: "center",
    paddingVertical: 25,
  },

  loadMoreText: {
    marginTop: 7,
    color: "#667085",
    fontSize: 11,
  },

  endText: {
    textAlign: "center",
    color: "#98A2B3",
    fontSize: 11,
    paddingVertical: 28,
  },

  loadingText: {
    marginTop: 12,
    color: "#667085",
  },

  errorTitle: {
    marginTop: 12,
    color: "#0B1F30",
    fontSize: 19,
    fontWeight: "800",
  },

  errorText: {
    marginTop: 5,
    textAlign: "center",
    color: "#667085",
  },
});
