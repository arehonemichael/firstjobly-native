import {
  AppText as Text,
  AppTouchableOpacity as TouchableOpacity,
} from "../../components/ui/primitives";
import { Colors, Fonts, Radius } from "../../constants/theme";
import { useEffect, useState } from "react";
import {
  Image,
  useWindowDimensions,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon as Ionicons } from "../../components/ui/icon";
import { router } from "expo-router";

import { getJobs } from "../../lib/job-api";
import type { Job } from "../../lib/jobs";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { useAuth } from "../../hooks/use-auth";
import { JobMetadata } from "../../components/ui/job-metadata";
import { categoryLabel } from "../../lib/job-filters";
import {
  EmptyState,
  InlineErrorState,
  SkeletonJobCard,
} from "../../components/ui/app-ui";
import { useEarlyJobInterstitial } from "../../ads/useJobInterstitial";

const categories = [
  {
    name: "Learnerships",
    subtitle: "Start learning while gaining work experience",
    icon: "school-outline",
    params: { category: "learnership" },
  },
  {
    name: "Internships",
    subtitle: "Build practical experience in your field",
    icon: "business-outline",
    params: { category: "internship" },
  },
  {
    name: "Graduate roles",
    subtitle: "Opportunities designed for new graduates",
    icon: "ribbon-outline",
    params: { category: "graduate_programme" },
  },
  {
    name: "Government",
    subtitle: "Explore public-sector opportunities",
    icon: "flag-outline",
    params: { category: "government" },
  },
];

export default function HomeScreen() {
  const wide = useWindowDimensions().width >= 760;
  const auth = useAuth();
  const authAny = auth as any;
  const { openJobWithEarlyInterstitial } = useEarlyJobInterstitial();

  const firstName = String(
    authAny?.user?.user_metadata?.full_name ??
      authAny?.user?.user_metadata?.name ??
      "",
  )
    .trim()
    .split(/\s+/)[0];

  const hour = new Date().getHours();
  const dayGreeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const greetingLabel = firstName
    ? `${dayGreeting}, ${firstName}`
    : "Find your next opportunity";

  const bottomContentPadding = useScreenBottomPadding(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [reload, setReload] = useState(0);
  function loadJobs() {
    setLoading(true);
    setError(null);
    setReload((value) => value + 1);
  }

  useEffect(() => {
    let active = true;
    getJobs(0)
      .then((data) => {
        if (active) setJobs(data.slice(0, 6));
      })
      .catch(() => {
        if (active)
          setError("We couldn’t load opportunities. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomContentPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandBlock}>
            <Text style={styles.logo}>
              First<Text style={styles.logoDark}>Jobly</Text>
            </Text>
            <Text style={styles.tagline}>Opportunity, made personal.</Text>
          </View>

          <TouchableOpacity
            style={styles.notification}
            accessibilityLabel="Open profile"
            onPress={() => router.push("/profile")}
          >
            <Ionicons
              name="person-circle-outline"
              size={24}
              color={Colors.foreground}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>YOUR NEXT MOVE</Text>
          <Text style={styles.heroTitle}>{greetingLabel}</Text>
          <Text style={styles.heroText}>
            Find jobs, learnerships and internships. Take your next step.
          </Text>

          <TouchableOpacity
            style={styles.search}
            activeOpacity={0.82}
            onPress={() => router.push("/jobs")}
          >
            <Ionicons name="search" size={20} color={Colors.muted} />
            <Text style={styles.searchText}>Search jobs or companies</Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={Colors.foreground}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Find your fit</Text>
            <Text style={styles.sectionSubtitle}>Choose a starting point</Text>
          </View>
        </View>

        <View
          style={[
            styles.categoryList,
            wide && { flexDirection: "row", flexWrap: "wrap" },
          ]}
        >
          {categories.map((category) => (
            <TouchableOpacity
              key={category.name}
              style={[styles.category, wide && { width: "48%", flexGrow: 1 }]}
              activeOpacity={0.78}
              onPress={() =>
                router.push({
                  pathname: "/jobs",
                  params: category.params,
                })
              }
            >
              <View style={styles.categoryIcon}>
                <Ionicons
                  name={category.icon as any}
                  size={21}
                  color={Colors.primary}
                />
              </View>

              <View style={styles.categoryCopy}>
                <Text style={styles.categoryText}>{category.name}</Text>
                <Text style={styles.categorySubtitle}>{category.subtitle}</Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color={Colors.mutedSubtle}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeaderJobs}>
          <View style={styles.sectionHeadingCopy}>
            <Text style={styles.sectionTitle}>Latest opportunities</Text>
            <Text style={styles.sectionSubtitle}>
              Recently posted jobs to explore
            </Text>
          </View>

          <TouchableOpacity
            style={styles.seeAllButton}
            onPress={() => router.push("/jobs")}
          >
            <Text style={styles.viewAll}>See all</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.jobsList}>
            <SkeletonJobCard />
            <SkeletonJobCard />
            <SkeletonJobCard />
          </View>
        ) : error ? (
          <InlineErrorState message={error} onRetry={loadJobs} />
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No opportunities yet"
            message="Check back soon or explore job search."
            actionLabel="Search jobs"
            onAction={() => router.push("/jobs")}
          />
        ) : (
          <View style={styles.jobsList}>
            {jobs.map((job) => (
              <TouchableOpacity
                key={job.id}
                style={styles.jobCard}
                activeOpacity={0.78}
                onPress={() =>
                  void openJobWithEarlyInterstitial(() =>
                    router.push({
                      pathname: "/jobs/[id]",
                      params: { id: job.id },
                    }),
                  )
                }
              >
                {job.company_logo_url ? (
                  <Image
                    source={{ uri: job.company_logo_url }}
                    style={styles.companyLogo}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.companyLogo}>
                    <Text style={styles.companyLetter}>
                      {job.company_name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}

                <View style={styles.jobContent}>
                  <Text style={styles.jobTitle}>{job.title}</Text>

                  <Text style={styles.company}>{job.company_name}</Text>

                  <View style={styles.jobMeta}>
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color={Colors.muted}
                    />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {job.city ? `${job.city}, ${job.province}` : job.province}
                    </Text>
                  </View>

                  <JobMetadata job={job} />
                  <View style={styles.badges}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {categoryLabel(job.category)}
                      </Text>
                    </View>

                    {job.is_urgent && (
                      <View style={styles.urgentBadge}>
                        <Text style={styles.urgentText}>Urgent</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={Colors.mutedSubtle}
                  style={styles.jobChevron}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 4,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandBlock: {
    flex: 1,
    paddingRight: 12,
  },
  logo: {
    color: Colors.primary,
    fontSize: 26,
    lineHeight: 32,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },
  logoDark: {
    color: Colors.foreground,
  },
  tagline: {
    marginTop: 3,
    color: Colors.muted,
    fontSize: 12,
    fontFamily: Fonts.medium,
  },
  notification: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hero: {
    marginHorizontal: 16,
    backgroundColor: Colors.secondary,
    borderRadius: Radius.md,
    padding: 24,
  },
  heroEyebrow: {
    color: Colors.primary,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.9,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },
  heroTitle: {
    color: Colors.foreground,
    fontSize: 26,
    lineHeight: 34,
    marginTop: 9,
    letterSpacing: -0.5,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },
  heroText: {
    color: Colors.muted,
    marginTop: 10,
    lineHeight: 21,
    fontSize: 14,
    maxWidth: 560,
    fontFamily: Fonts.regular,
  },
  search: {
    marginTop: 24,
    minHeight: 54,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.input,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchText: {
    flex: 1,
    fontSize: 14,
    color: Colors.muted,
    fontFamily: Fonts.medium,
  },
  trustRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  trustText: {
    color: Colors.primaryBorder,
    fontSize: 11,
    fontFamily: Fonts.semibold,
  },
  sectionHeader: {
    marginTop: 30,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  sectionHeaderJobs: {
    marginTop: 30,
    marginBottom: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  sectionHeadingCopy: {
    flex: 1,
    paddingRight: 12,
  },
  sectionTitle: {
    fontSize: 21,
    lineHeight: 27,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    color: Colors.foreground,
  },
  sectionSubtitle: {
    marginTop: 3,
    color: Colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: Fonts.regular,
  },
  seeAllButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  viewAll: {
    color: Colors.primary,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    fontSize: 13,
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  category: {
    minHeight: 70,
    padding: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  categoryCopy: {
    flex: 1,
    minWidth: 0,
  },
  categoryText: {
    color: Colors.foreground,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 19,
  },
  categorySubtitle: {
    marginTop: 2,
    color: Colors.muted,
    fontFamily: Fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  jobsList: {
    gap: 12,
  },
  jobCard: {
    marginHorizontal: 16,
    minHeight: 124,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.foreground,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0,
    shadowRadius: 12,
    elevation: 0,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  companyLetter: {
    fontFamily: Fonts.bold,
    fontWeight: "700",
    fontSize: 19,
    color: Colors.foreground,
  },
  jobContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    minWidth: 0,
  },
  jobTitle: {
    color: Colors.foreground,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },
  company: {
    color: Colors.muted,
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Fonts.regular,
  },
  jobMeta: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    flex: 1,
    color: Colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginLeft: 4,
    fontFamily: Fonts.regular,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 8,
  },
  badge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  badgeText: {
    color: Colors.muted,
    fontSize: 11,
    fontFamily: Fonts.semibold,
    fontWeight: "600",
  },
  urgentBadge: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  urgentText: {
    color: Colors.primary,
    fontSize: 11,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },
  jobChevron: {
    marginTop: 14,
  },
});
