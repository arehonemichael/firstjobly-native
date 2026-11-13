import { categoryPresentation } from "../../lib/home-presentation";
import { HotJobsSection } from "../../components/home/hot-jobs";
import { BrandWordmark } from "../../components/brand-wordmark";
import { useRecommendations } from "../../hooks/use-recommendations";
import { RecommendationControls } from "../../components/recommendations/controls";
import { JobFeedback } from "../../components/recommendations/job-feedback";
import type {
  FeedFilters,
  RankedJob,
} from "../../lib/recommendations/contracts";
import { AdBanner } from "../../ads/AdBanner";
import { NativeAdBlock } from "../../ads/NativeAdBlock";
import { shouldInsertNative } from "../../ads/config";
import { RecommendationSkeleton } from "../../components/home/recommendation-skeleton";
import { HomeSessionHero } from "../../components/home/session-hero";
import { Fragment, useState } from "react";
import { Image } from "expo-image";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BriefcaseBusiness,
  ClipboardList,
  GraduationCap,
  MapPin,
  Search,
  User,
  MessageCircle,
} from "lucide-react-native";
import {
  AppText as Text,
  AppPressable as Pressable,
} from "../../components/ui/primitives";
import {
  EmptyState,
  InlineErrorState,
  SkeletonJobCard,
} from "../../components/ui/app-ui";
import { IdentityImage } from "../../components/ui/identity-image";
import { JobMetadata } from "../../components/ui/job-metadata";
import { Colors, Fonts, Layout, Radius, Space } from "../../constants/theme";
import { useAuth } from "../../hooks/use-auth";
import { useHomeSummary } from "../../hooks/use-home-summary";
import { useSavedJobs } from "../../hooks/use-saved-jobs";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { useEarlyJobInterstitial } from "../../ads/useJobInterstitial";
import { categoryLabel } from "../../lib/job-filters";
import type { Job } from "../../lib/jobs";

const categories = [
  { label: "Learnerships", category: "learnership", icon: GraduationCap },
  { label: "Internships", category: "internship", icon: BriefcaseBusiness },
  {
    label: "Graduate roles",
    category: "graduate_programme",
    icon: GraduationCap,
  },
  { label: "Government", category: "government", icon: BriefcaseBusiness },
];

export default function HomeScreen() {
  const { width, fontScale } = useWindowDimensions();
  const categoryLayout = categoryPresentation(
    Math.min(width, Layout.reading) - Space.xl * 2,
    fontScale,
  );
  const { user, userId, loading: authLoading } = useAuth();
  const { summary, loading: summaryLoading, retry } = useHomeSummary(userId);
  const {
    savedIds,
    loading: savedLoading,
    error: savedError,
    canSave,
    toggleSave,
    refreshSaved,
  } = useSavedJobs();
  const { openJobWithEarlyInterstitial } = useEarlyJobInterstitial();
  const bottom = useScreenBottomPadding(true);
  const [filters, setFilters] = useState<FeedFilters>({});
  const feed = useRecommendations(userId, authLoading, filters);
  const jobs = feed.page?.items ?? [];
  const loading = feed.loading;
  const error = feed.error;
  const reload = feed.refresh;
  const [skipSetup, setSkipSetup] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const firstName = String(
    summary?.profile?.first_name ||
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      "",
  )
    .trim()
    .split(/\s+/)[0];
  const photo =
    typeof user?.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : null;
  const now = new Date();
  const draft = summary?.applications?.find(
    (item) => item.is_draft && item.jobs,
  );
  const completion = summary?.completion;
  const province = summary?.profile?.preferred_province;

  function openJob(job: Job) {
    void openJobWithEarlyInterstitial(() =>
      router.push({ pathname: "/jobs/[id]", params: { id: job.id } }),
    );
  }
  async function save(job: Job) {
    if (!canSave) {
      router.push({ pathname: "/auth", params: { returnTo: "/" } });
      return;
    }
    setSaving(job.id);
    setSaveError(null);
    try {
      const result = await toggleSave(job.id);
      if (!result.ok)
        setSaveError("Your saved jobs couldn’t be updated. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  function jobCard(row: RankedJob, featured: boolean) {
    const job = row.job;
    const saved = savedIds.includes(job.id);
    return (
      <View
        key={job.id}
        testID="home-job-card"
        style={[styles.jobCard, featured && styles.featuredCard]}
      >
        <View style={[styles.cardTop, featured && styles.featuredTop]}>
          <View style={styles.companyRow}>
            <IdentityImage
              uri={job.company_logo_url}
              name={job.company_name}
              size={36}
            />
            <View style={styles.grow} />
            {job.is_urgent && (
              <Text style={styles.urgent}>Urgent opportunity</Text>
            )}
          </View>
          <Text style={styles.caption}>
            {job.company_name || "Company not listed"}
            {job.job_type ? ` · ${job.job_type.replace(/_/g, " ")}` : ""}
          </Text>
          <Text
            accessibilityRole="header"
            style={[styles.jobTitle, featured && styles.featuredTitle]}
          >
            {job.title || "Role title not provided"}
          </Text>
        </View>
        <View style={styles.cardBottom}>
          <View style={styles.companyRow}>
            <View style={styles.grow}>
              {!!(job.city || job.province) && (
                <View style={styles.location}>
                  <MapPin
                    strokeWidth={1.5}
                    aria-hidden
                    size={18}
                    color={Colors.muted}
                  />
                  <Text style={styles.meta}>
                    {[job.city, job.province].filter(Boolean).join(", ")}
                  </Text>
                </View>
              )}
              <JobMetadata job={job} showJobType={false} />
            </View>
            <Pressable
              accessibilityLabel={
                savedError
                  ? "Saved status unavailable"
                  : `${saved ? "Unsave" : "Save"} ${job.title}`
              }
              accessibilityState={{
                selected: saved,
                busy: saving === job.id || savedLoading,
              }}
              aria-pressed={savedError ? undefined : saved}
              disabled={savedLoading || saving !== null || !!savedError}
              onPress={() => void save(job)}
              style={({ pressed, hovered }) => [
                styles.save,
                saved && styles.saved,
                (pressed || hovered) && styles.feedback,
              ]}
            >
              {saving === job.id || savedLoading ? (
                <ActivityIndicator size="small" color={Colors.muted} />
              ) : saved ? (
                <BookmarkCheck
                  strokeWidth={1.5}
                  aria-hidden
                  size={18}
                  color={Colors.muted}
                />
              ) : (
                <Bookmark
                  strokeWidth={1.5}
                  aria-hidden
                  size={18}
                  color={Colors.muted}
                />
              )}
            </Pressable>
          </View>
          <View style={styles.jobFooter}>
            <Text style={styles.categoryChip}>
              {categoryLabel(job.category)}
            </Text>
            <Pressable
              accessibilityLabel={`View ${job.title}`}
              onPress={() => openJob(job)}
              style={({ pressed, hovered }) => [
                styles.detailLink,
                (pressed || hovered) && styles.feedback,
              ]}
            >
              <Text style={styles.roleLink}>View role</Text>
              <ArrowRight
                strokeWidth={1.5}
                aria-hidden
                size={18}
                color={Colors.muted}
              />
            </Pressable>
          </View>
          <JobFeedback row={row} userId={userId} onFeedback={feed.feedback} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScrollView
        nativeID="home-scroll"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottom + Space.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image
              accessible={false}
              source={require("../../../assets/images/icon.png")}
              style={styles.brandIcon}
              contentFit="contain"
            />
            <BrandWordmark
              availableWidth={Math.min(width, Layout.reading) - Space.xl * 2}
            />
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="Search jobs or companies"
              onPress={() => router.push("/jobs")}
              style={styles.headerButton}
            >
              <Search
                strokeWidth={1.5}
                aria-hidden
                size={18}
                color={Colors.foreground}
              />
            </Pressable>
            <Pressable
              accessibilityLabel="Open Community"
              onPress={() => router.push("/community")}
              style={styles.headerButton}
            >
              <MessageCircle
                strokeWidth={1.5}
                aria-hidden
                size={18}
                color={Colors.foreground}
              />
            </Pressable>
          </View>
        </View>
        <View style={styles.intro}>
          <View style={styles.greetingRow}>
            <View style={styles.grow}>
              <Text style={styles.eyebrow}>
                {firstName ? `${firstName} · ` : ""}
                {now.toLocaleDateString("en-ZA", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </Text>
              <Text accessibilityRole="header" style={styles.greeting}>
                Your next step{"\n"}into work
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Open profile"
              onPress={() => router.push("/profile")}
              style={styles.account}
            >
              <IdentityImage uri={photo} name={firstName} size={48} portrait />
            </Pressable>
          </View>
          <Text style={styles.supporting}>
            {province
              ? `Opportunities in ${province}`
              : "Jobs, internships and learnerships"}
          </Text>
        </View>
        <HomeSessionHero />
        {authLoading || (userId && summaryLoading && !summary) ? (
          <View accessibilityLabel="Loading your overview">
            <SkeletonJobCard />
          </View>
        ) : !userId ? (
          <Pressable
            onPress={() => router.push("/auth")}
            style={({ pressed }) => [
              styles.progressCard,
              pressed && styles.feedback,
            ]}
          >
            <View style={styles.row}>
              <View style={styles.progressIcon}>
                <User
                  strokeWidth={1.5}
                  aria-hidden
                  size={18}
                  color={Colors.muted}
                />
              </View>
              <View style={styles.grow}>
                <Text style={styles.progressTitle}>
                  Save jobs and track applications
                </Text>
                <Text style={styles.panelCopy}>
                  Keep your search in one place
                </Text>
              </View>
              <View style={styles.progressArrow}>
                <ArrowRight
                  strokeWidth={1.5}
                  aria-hidden
                  size={18}
                  color={Colors.muted}
                />
              </View>
            </View>
          </Pressable>
        ) : (
          <>
            {summary?.failed && (
              <InlineErrorState
                message="Some of your overview couldn’t load."
                onRetry={retry}
              />
            )}
            {draft?.jobs ? (
              <Pressable
                accessibilityLabel={`Continue application for ${draft.jobs.title}`}
                onPress={() =>
                  router.push({
                    pathname: "/jobs/[id]",
                    params: { id: draft.jobs!.id },
                  })
                }
                style={({ pressed }) => [
                  styles.progressCard,
                  pressed && styles.feedback,
                ]}
              >
                <View style={styles.row}>
                  <View style={styles.progressIcon}>
                    <ClipboardList
                      strokeWidth={1.5}
                      aria-hidden
                      size={18}
                      color={Colors.muted}
                    />
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.progressTitle}>{draft.jobs.title}</Text>
                    <Text style={styles.panelCopy}>
                      {draft.jobs.company_name} · Draft application
                    </Text>
                  </View>
                  <View style={styles.progressArrow}>
                    <ArrowRight
                      strokeWidth={1.5}
                      aria-hidden
                      size={18}
                      color={Colors.muted}
                    />
                  </View>
                </View>
                <Text style={[styles.link, { marginTop: 10 }]}>
                  Continue application
                </Text>
              </Pressable>
            ) : completion !== null &&
              completion !== undefined &&
              completion < 100 ? (
              <Pressable
                accessibilityLabel={`Profile ${completion}% complete. Complete your profile`}
                onPress={() => router.push("/profile")}
                style={({ pressed }) => [
                  styles.progressCard,
                  pressed && styles.feedback,
                ]}
              >
                <View style={styles.row}>
                  <View style={styles.progressIcon}>
                    <User
                      strokeWidth={1.5}
                      aria-hidden
                      size={18}
                      color={Colors.muted}
                    />
                  </View>
                  <View style={styles.grow}>
                    <Text style={styles.progressTitle}>
                      Complete your application profile
                    </Text>
                    <Text style={styles.panelCopy}>
                      Keep your details ready for Easy Apply
                    </Text>
                  </View>
                  <View style={styles.progressArrow}>
                    <ArrowRight
                      strokeWidth={1.5}
                      aria-hidden
                      size={18}
                      color={Colors.muted}
                    />
                  </View>
                </View>
                <View style={styles.progressFooter}>
                  <View
                    accessibilityRole="progressbar"
                    accessibilityLabel="Profile completion"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={completion}
                    accessibilityValue={{ min: 0, max: 100, now: completion }}
                    style={styles.segments}
                  >
                    {[0, 1, 2, 3].map((part) => (
                      <View key={part} style={styles.segment}>
                        <View
                          style={[
                            styles.fill,
                            {
                              width: `${Math.max(0, Math.min(1, completion / 25 - part)) * 100}%`,
                            },
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                  <Text style={styles.progressNumber}>{completion}%</Text>
                </View>
              </Pressable>
            ) : null}
          </>
        )}
        <View style={styles.sectionHeader}>
          <View style={styles.grow}>
            <Text style={styles.eyebrow}>
              Jobs, internships and learnerships
            </Text>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {feed.page?.label ?? "Latest opportunities"}
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Browse all jobs"
            onPress={() => router.push("/jobs")}
            style={styles.browse}
          >
            <Text style={styles.roleLink}>See all</Text>
            <ArrowRight
              strokeWidth={1.5}
              aria-hidden
              size={18}
              color={Colors.muted}
            />
          </Pressable>
        </View>
        <RecommendationControls
          userId={userId}
          filters={filters}
          onChange={setFilters}
        />
        {!!userId && !skipSetup && !summaryLoading && !completion && (
          <View>
            <Text style={styles.supporting}>
              Choose a few job interests, or browse now and set them later.
            </Text>
            <Pressable onPress={() => router.push("/preferences")}>
              <Text style={styles.link}>Choose job interests</Text>
            </Pressable>
            <Pressable onPress={() => setSkipSetup(true)}>
              <Text style={styles.link}>Skip preference setup</Text>
            </Pressable>
          </View>
        )}
        {feed.page?.sparse && (
          <Text style={styles.supporting}>
            Few suitable opportunities are available. Broaden your preferences
            or filters to see more.
          </Text>
        )}
        {!!feed.dismissed && (
          <View style={styles.companyRow}>
            <Text style={styles.meta}>Opportunity hidden</Text>
            <Pressable
              onPress={() =>
                void feed
                  .undo()
                  .catch(() =>
                    setSaveError("Could not undo dismissal. Please retry."),
                  )
              }
            >
              <Text style={styles.link}>Undo dismissal</Text>
            </Pressable>
          </View>
        )}
        {!!savedError && userId && (
          <InlineErrorState
            message="Saved jobs are unavailable."
            onRetry={() => void refreshSaved()}
          />
        )}
        {!!saveError && (
          <InlineErrorState
            message={saveError}
            onRetry={() => setSaveError(null)}
          />
        )}
        {loading && !!jobs.length && (
          <Text style={styles.meta} accessibilityLiveRegion="polite">
            Updating opportunities…
          </Text>
        )}
        {loading && !jobs.length ? (
          <View style={styles.jobList}>
            {Array.from({ length: 6 }, (_, index) => (
              <RecommendationSkeleton key={index} featured={index === 0} />
            ))}
          </View>
        ) : !jobs.length && error ? (
          <View>
            <InlineErrorState message={error} onRetry={() => void reload()} />
            <Pressable onPress={() => router.push("/jobs")}>
              <Text style={styles.link}>Browse job search</Text>
            </Pressable>
          </View>
        ) : !jobs.length ? (
          <EmptyState
            title="No opportunities yet"
            message="Check back soon, or explore job search."
            actionLabel="Search jobs"
            onAction={() => router.push("/jobs")}
          />
        ) : (
          <View style={styles.jobList}>
            {!!error && (
              <Text accessibilityRole="alert" style={styles.supporting}>
                {error}
              </Text>
            )}
            {jobs.slice(0, 6).map((row, index) => (
              <Fragment key={row.job.id}>
                {jobCard(row, index === 0)}
                {shouldInsertNative(index) && <NativeAdBlock variant="feed" />}
              </Fragment>
            ))}
            <Pressable onPress={() => router.push("/discover")}>
              <Text style={styles.link}>See more opportunities</Text>
            </Pressable>
          </View>
        )}
        <AdBanner placement="home" />
        {!!userId && (
          <View style={styles.quickLinks}>
            <Pressable
              onPress={() => router.push("/saved")}
              style={styles.quickLink}
            >
              <Bookmark
                strokeWidth={1.5}
                aria-hidden
                size={18}
                color={Colors.muted}
              />
              <Text style={styles.link}>
                {summary?.savedCount
                  ? `${summary.savedCount} saved jobs`
                  : "Saved jobs"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/applications")}
              style={styles.quickLink}
            >
              <ClipboardList
                strokeWidth={1.5}
                aria-hidden
                size={18}
                color={Colors.muted}
              />
              <Text style={styles.link}>Applications</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.exploreHeader}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Find your starting point
          </Text>
          <Text style={styles.supporting}>
            Learnerships, graduate roles and public-sector opportunities
          </Text>
        </View>
        <View testID="home-categories" style={styles.categories}>
          {categories.map(({ label, category, icon: Glyph }) => (
            <Pressable
              key={category}
              testID="home-category"
              accessibilityLabel={`Browse ${label}`}
              onPress={() =>
                router.push({ pathname: "/jobs", params: { category } })
              }
              style={({ pressed, hovered }) => [
                styles.category,
                { width: categoryLayout.width },
                (pressed || hovered) && styles.feedback,
              ]}
            >
              <Glyph
                strokeWidth={1.5}
                aria-hidden
                size={24}
                color={Colors.navy}
              />
              <View
                style={{
                  width: "100%",
                  minHeight: categoryLayout.labelHeight,
                  justifyContent: "center",
                }}
              >
                <Text
                  testID="category-label"
                  numberOfLines={2}
                  style={styles.categoryLabel}
                >
                  {label}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
        <HotJobsSection onOpen={openJob} />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  content: {
    paddingHorizontal: 24,
    width: "100%",
    maxWidth: Layout.reading,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    columnGap: 12,
    rowGap: 12,
    paddingTop: Space.lg,
    paddingBottom: Space.xl,
  },
  brand: {
    flexDirection: "row",
    gap: Space.sm,
    alignItems: "center",
    flexShrink: 0,
    flexWrap: "wrap",
    maxWidth: "100%",
  },
  brandIcon: { width: 30, height: 30, borderRadius: 9 },
  headerActions: { flexDirection: "row", gap: 2, flexShrink: 0 },
  headerButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
  },
  account: {
    minWidth: 52,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    backgroundColor: Colors.primarySoft,
    borderWidth: 2,
    borderColor: Colors.surface,
    marginTop: Space.xs,
  },
  intro: { paddingBottom: Space.xl, paddingTop: Space.xs },
  greetingRow: {
    flexDirection: "row",
    gap: Space.sm,
    alignItems: "flex-start",
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
    textTransform: "none",
    fontFamily: Fonts.medium,
    color: Colors.muted,
    flexShrink: 1,
  },
  greeting: {
    fontFamily: Fonts.editorial,
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 0,
    marginTop: Space.sm,
    color: Colors.foreground,
  },
  supporting: {
    fontSize: 12,
    lineHeight: 20,
    color: Colors.muted,
    marginTop: Space.md,
  },
  progressCard: {
    padding: Space.lg,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressIcon: {
    width: 30,
    height: 30,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  progressTitle: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 20,
    color: Colors.foreground,
  },
  panelCopy: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    color: Colors.muted,
  },
  progressArrow: {
    width: 30,
    height: 30,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  progressFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginTop: Space.md,
  },
  segments: { flex: 1, flexDirection: "row", gap: 4 },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primaryBorder,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: Colors.primaryPressed,
    borderRadius: Radius.pill,
  },
  progressNumber: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.muted,
  },
  row: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  grow: { flex: 1, minWidth: 0 },
  link: {
    color: Colors.primaryPressed,
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 20,
  },
  quickLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    columnGap: Space.xl,
    marginTop: Space.sm,
  },
  quickLink: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
    marginTop: Space.xl,
    marginBottom: Space.md,
  },
  sectionTitle: {
    fontFamily: Fonts.editorial,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 0,
    marginTop: 4,
  },
  browse: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.xs,
  },
  roleLink: {
    color: Colors.primaryPressed,
    fontFamily: Fonts.medium,
    fontSize: 13,
    lineHeight: 20,
  },
  jobList: { gap: Space.lg },
  jobCard: {
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  featuredCard: { borderColor: Colors.border },
  cardTop: { padding: Space.lg, backgroundColor: Colors.secondary },
  featuredTop: { backgroundColor: Colors.primarySoft },
  cardBottom: {
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
    paddingBottom: Space.sm,
    backgroundColor: Colors.surface,
  },
  companyRow: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.muted,
    marginTop: Space.sm,
  },
  save: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  saved: { backgroundColor: Colors.primarySoft },
  jobTitle: {
    fontFamily: Fonts.semibold,
    fontSize: 18,
    lineHeight: 24,
    marginTop: 4,
    color: Colors.foreground,
  },
  featuredTitle: { fontSize: 20, lineHeight: 28, letterSpacing: 0 },
  location: { flexDirection: "row", gap: Space.xs, alignItems: "flex-start" },
  meta: { fontSize: 12, lineHeight: 20, color: Colors.muted, flex: 1 },
  jobFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Space.sm,
    marginTop: Space.xs,
  },
  categoryChip: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.muted,
    paddingVertical: 4,
  },
  urgent: {
    fontSize: 12,
    color: Colors.primaryPressed,
    paddingVertical: 4,
    paddingHorizontal: Space.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
  },
  detailLink: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: Space.sm,
  },
  feedback: { opacity: 0.72 },
  exploreHeader: { marginTop: Space.xl, marginBottom: Space.md },
  categories: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Space.md,
    marginBottom: Space.xl,
  },
  category: {
    minHeight: 110,
    alignItems: "center",
    justifyContent: "center",
    gap: Space.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Space.md,
    paddingVertical: Space.lg,
  },
  categoryLabel: {
    width: "100%",
    color: Colors.navy,
    fontFamily: Fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    textAlignVertical: "center",
  },
});
