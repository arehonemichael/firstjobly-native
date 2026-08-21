import { memo, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { useAuth } from "../../hooks/use-auth";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { theme } from "../../constants/theme";
import { JOB_MARKET_FACTS } from "../../constants/job-market-facts";
import type { Job } from "../../lib/jobs";
import { formatCategoryLabel } from "../../lib/job-formatters";
import {
  getPersonalizedMatches,
  getTopOpportunities,
  type RecommendationFilter,
} from "../../lib/job-recommendations";

// Free-to-use Pexels imagery selected for an African youth/professional context.
// The image and fact are chosen independently once per Home mount. Keeping the
// hero stable while it is visible avoids remote-image swaps and dot desync/flicker.
const HERO_IMAGES = [
  {
    uri: "https://images.pexels.com/photos/9301196/pexels-photo-9301196.jpeg?auto=compress&cs=tinysrgb&w=1400",
  },
  {
    uri: "https://images.pexels.com/photos/7971360/pexels-photo-7971360.jpeg?auto=compress&cs=tinysrgb&w=1400",
  },
  {
    uri: "https://images.pexels.com/photos/12497061/pexels-photo-12497061.jpeg?auto=compress&cs=tinysrgb&w=1400",
  },
] as const;

const HERO_HEADLINES = [
  "Build experience that opens doors",
  "Skills can shape your next move",
  "Start where opportunity grows",
  "Your next chapter starts with one opportunity",
] as const;

function formatSalary(job: Job): string | null {
  const format = (value: number) =>
    `R${Math.round(value).toLocaleString("en-ZA")}`;
  if (job.salary_min != null && job.salary_max != null) {
    return `${format(job.salary_min)} - ${format(job.salary_max)}`;
  }
  if (job.salary_min != null) return `From ${format(job.salary_min)}`;
  if (job.salary_max != null) return `Up to ${format(job.salary_max)}`;
  return null;
}

function formatLocation(job: Job) {
  const parts = [job.city, job.province].filter(Boolean);
  if (parts.length) return parts.join(", ");
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  return haystack.includes("remote") ? "Remote" : "South Africa";
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
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    String(job.closing_date).slice(0, 10),
  );
  if (!match) return null;
  const closingUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  const days = Math.round(
    (closingUtc - johannesburgTodayUtc()) / 86_400_000,
  );
  if (days < 0 || days > 10) return null;
  if (days === 0) return "Closing today";
  if (days === 1) return "Closing tomorrow";
  return `Closing in ${days} days`;
}

function tagsFor(job: Job) {
  return [job.category, job.job_type, job.experience_level]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 3)
    .map(formatCategoryLabel);
}

function jobPath(job: Job) {
  return { pathname: "/jobs/[id]" as const, params: { id: job.id } };
}

function johannesburgGreeting() {
  try {
    const hourPart = new Intl.DateTimeFormat("en-ZA", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Africa/Johannesburg",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "hour")?.value;
    const hour = Number(hourPart ?? 12);
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  } catch {
    const hour = (new Date().getUTCHours() + 2) % 24;
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }
}

const TopOpportunityCard = memo(function TopOpportunityCard({
  item,
}: {
  item: Job;
}) {
  const salary = formatSalary(item);
  const closing = closingCountdown(item);
  return (
    <TouchableOpacity
      activeOpacity={0.82}
      style={styles.topCard}
      onPress={() => router.push(jobPath(item))}
    >
      <View style={styles.topCardHead}>
        <View style={styles.companyMark}>
          {item.company_logo_url ? (
            <ExpoImage
              source={{ uri: item.company_logo_url }}
              style={styles.companyLogoImage}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={0}
            />
          ) : (
            <Text style={styles.companyMarkText}>
              {item.company_name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.topCompanyCopy}>
          <View style={styles.companyNameRow}>
            <Text numberOfLines={1} style={styles.companyName}>
              {item.company_name}
            </Text>
            <View style={styles.microBadge}>
              <Text style={styles.microBadgeText}>
                {item.is_featured ? "★" : "✦"}
              </Text>
            </View>
          </View>
          <Text style={styles.categoryLabel}>
            {formatCategoryLabel(item.category)}
          </Text>
        </View>
      </View>
      <Text numberOfLines={2} style={styles.compactJobTitle}>
        {item.title}
      </Text>
      <Text style={styles.compactPostedText}>{postedLabel(item)}</Text>
      {closing ? (
        <Text numberOfLines={1} style={styles.closingCountdownText}>
          {closing}
        </Text>
      ) : null}
      {salary ? (
        <Text numberOfLines={1} style={styles.compactSalaryText}>
          {salary}
        </Text>
      ) : null}
      <View style={styles.locationRow}>
        <Ionicons
          name="location-outline"
          size={14}
          color={theme.colors.inkSoft}
        />
        <Text numberOfLines={1} style={styles.locationText}>
          {formatLocation(item)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const PersonalizedMatchCard = memo(function PersonalizedMatchCard({
  item,
}: {
  item: Job;
}) {
  const salary = formatSalary(item);
  const closing = closingCountdown(item);
  return (
    <TouchableOpacity
      activeOpacity={0.84}
      style={styles.matchCard}
      onPress={() => router.push(jobPath(item))}
    >
      <View style={styles.matchLogo}>
        {item.company_logo_url ? (
          <ExpoImage
            source={{ uri: item.company_logo_url }}
            style={styles.matchLogoImage}
            contentFit="contain"
            cachePolicy="memory-disk"
            transition={0}
          />
        ) : (
          <Text style={styles.matchLogoText}>
            {item.company_name.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.matchBody}>
        <View style={styles.companyStatusRow}>
          <Text numberOfLines={1} style={styles.matchCompany}>
            {item.company_name}
          </Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{item.is_urgent ? "Hot" : "New"}</Text>
          </View>
          <TouchableOpacity style={styles.bookmarkButton} activeOpacity={0.7}>
            <Ionicons
              name="bookmark-outline"
              size={22}
              color={theme.colors.ink}
            />
          </TouchableOpacity>
        </View>
        <Text numberOfLines={2} style={styles.matchTitle}>
          {item.title}
        </Text>
        <View style={styles.matchLocationRow}>
          <Ionicons
            name="location-outline"
            size={14}
            color={theme.colors.inkSoft}
          />
          <Text numberOfLines={2} style={styles.matchLocation}>
            {formatLocation(item)}
          </Text>
        </View>
        <Text numberOfLines={2} style={styles.description}>
          {item.description}
        </Text>
        <View style={styles.matchFooter}>
          <View style={styles.tagsRow}>
            {tagsFor(item).map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text numberOfLines={1} style={styles.tagText}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.postedSalaryStack}>
            <View style={styles.postedPill}>
              <Text style={styles.postedText}>{postedLabel(item)}</Text>
            </View>
            {closing ? (
              <Text numberOfLines={1} style={styles.closingCountdownText}>
                {closing}
              </Text>
            ) : null}
            {salary ? (
              <Text numberOfLines={1} style={styles.compactSalaryText}>
                {salary}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

function TopOpportunitySkeleton() {
  return (
    <View style={[styles.topCard, styles.skeletonCard]}>
      <View style={styles.topCardHead}>
        <View style={[styles.companyMark, styles.skeletonBlock]} />
        <View style={styles.skeletonTopCopy}>
          <View style={[styles.skeletonLine, styles.skeletonLineMedium]} />
          <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
        </View>
      </View>
      <View style={[styles.skeletonLine, styles.skeletonTitleLine]} />
      <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
      <View style={[styles.skeletonLine, styles.skeletonLineMedium]} />
    </View>
  );
}

function MatchSkeleton() {
  return (
    <View style={[styles.matchCard, styles.skeletonCard]}>
      <View style={[styles.matchLogo, styles.skeletonBlock]} />
      <View style={styles.matchBody}>
        <View style={[styles.skeletonLine, styles.skeletonLineMedium]} />
        <View style={[styles.skeletonLine, styles.skeletonTitleLine]} />
        <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
        <View style={[styles.skeletonLine, styles.skeletonWideLine]} />
        <View style={styles.skeletonFooterRow}>
          <View style={[styles.skeletonPill, styles.skeletonBlock]} />
          <View style={[styles.skeletonPill, styles.skeletonBlock]} />
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const bottomContentPadding = useScreenBottomPadding(true);
  const { userId, user, loading: authLoading } = useAuth();
  const params = useLocalSearchParams<{
    location?: string;
    role?: string;
    category?: string;
  }>();
  const [topOpportunities, setTopOpportunities] = useState<Job[]>([]);
  const [matches, setMatches] = useState<Job[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [heroImageIndex] = useState(() =>
    Math.floor(Math.random() * HERO_IMAGES.length),
  );
  const [heroHeadline] = useState(
    () => HERO_HEADLINES[Math.floor(Math.random() * HERO_HEADLINES.length)],
  );
  const [heroFact] = useState(
    () =>
      JOB_MARKET_FACTS[Math.floor(Math.random() * JOB_MARKET_FACTS.length)]
        ?.text ?? "Practical experience can strengthen your next application.",
  );

  const filter = useMemo<RecommendationFilter>(
    () => ({
      location: typeof params.location === "string" ? params.location : null,
      role: typeof params.role === "string" ? params.role : null,
      category: typeof params.category === "string" ? params.category : null,
    }),
    [params.location, params.role, params.category],
  );

  const jobsRoute = useMemo(
    () => ({
      pathname: "/jobs" as const,
      params: Object.fromEntries(
        Object.entries(filter).filter(([, value]) => Boolean(value)),
      ),
    }),
    [filter],
  );

  const firstName = useMemo(() => {
    const metadata = user?.user_metadata ?? {};
    const value = String(
      metadata.first_name ?? metadata.full_name ?? metadata.name ?? "",
    ).trim();
    return value ? value.split(/\s+/)[0] : "";
  }, [user?.user_metadata]);
  const greeting = useMemo(() => johannesburgGreeting(), []);

  useEffect(() => {
    if (authLoading) return;
    let alive = true;
    if (topOpportunities.length === 0 && matches.length === 0) {
      setRecommendationsLoading(true);
    }

    void (async () => {
      try {
        // These stay parallel. The recommendation service now deduplicates their
        // shared Supabase dependencies, so parallelism no longer means duplicate
        // network work.
        const [top, personalized] = await Promise.all([
          getTopOpportunities(userId, filter, 10),
          getPersonalizedMatches(userId, filter, 20),
        ]);
        if (!alive) return;
        setTopOpportunities(top.length ? top : personalized.slice(0, 10));
        setMatches(personalized.length ? personalized : top.slice(0, 20));
      } catch (error) {
        console.error("Home recommendations failed:", error);
      } finally {
        if (alive) setRecommendationsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, userId, filter]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomContentPadding + 18 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.greetingBlock}>
            <Text style={styles.greetingText}>{greeting}</Text>
            <Text style={styles.homeLabel}>Find your next opportunity</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.78}
            style={styles.notificationButton}
          >
            <Ionicons
              name="notifications-outline"
              size={23}
              color={theme.colors.ink}
            />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroWrap}>
          <ExpoImage
            source={HERO_IMAGES[heroImageIndex]}
            style={styles.heroBackgroundImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
            priority="normal"
          />
          <LinearGradient
            pointerEvents="none"
            colors={[
              "rgba(23,33,43,0.50)",
              "rgba(23,33,43,0.72)",
              "rgba(23,33,43,0.94)",
            ]}
            locations={[0, 0.5, 1]}
            style={styles.heroScrim}
          />
          <View style={styles.heroContent}>
            <View style={styles.recommendedPill}>
              <Ionicons
                name="sparkles"
                size={16}
                color={theme.colors.primaryForeground}
              />
              <Text style={styles.recommendedText}>
                {firstName
                  ? `Recommended for ${firstName}`
                  : "Recommended for you"}
              </Text>
            </View>
            <Text style={styles.heroHeadline}>{heroHeadline}</Text>
            <Text style={styles.heroSubtext}>{heroFact}</Text>
            <TouchableOpacity
              activeOpacity={0.86}
              style={styles.heroCta}
              onPress={() => router.push(jobsRoute)}
            >
              <Text style={styles.heroCtaText}>See recommendations</Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={theme.colors.ink}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.carouselDots}>
            {HERO_IMAGES.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.carouselDot,
                  index === heroImageIndex && styles.carouselDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top opportunities near you</Text>
          <TouchableOpacity onPress={() => router.push(jobsRoute)}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topCardsRow}
        >
          {recommendationsLoading && topOpportunities.length === 0
            ? [0, 1, 2].map((key) => <TopOpportunitySkeleton key={key} />)
            : topOpportunities.map((item) => (
                <TopOpportunityCard key={item.id} item={item} />
              ))}
        </ScrollView>

        <View style={[styles.sectionHeader, styles.matchesHeader]}>
          <Text style={styles.sectionTitle}>More great matches for you</Text>
          <TouchableOpacity onPress={() => router.push(jobsRoute)}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.matchesList}>
          {recommendationsLoading && matches.length === 0
            ? [0, 1, 2].map((key) => <MatchSkeleton key={key} />)
            : matches.map((item) => (
                <PersonalizedMatchCard key={item.id} item={item} />
              ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  container: { flex: 1 },
  content: { paddingTop: 8 },
  topBar: {
    minHeight: 62,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  greetingBlock: { flex: 1, minWidth: 0, paddingRight: 16 },
  greetingText: {
    color: theme.colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  homeLabel: {
    color: theme.colors.ink,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    marginTop: 1,
  },
  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow.card,
  },
  notificationDot: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.brand,
    right: 3,
    top: 3,
    borderWidth: 2,
    borderColor: theme.colors.surface,
  },
  heroWrap: {
    marginHorizontal: 16,
    minHeight: 306,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.ink,
    ...theme.shadow.card,
  },
  heroBackgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  heroScrim: { ...StyleSheet.absoluteFillObject },
  heroContent: {
    minHeight: 306,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 28,
    maxWidth: 350,
  },
  recommendedPill: {
    alignSelf: "flex-start",
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.brand,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 14,
  },
  recommendedText: {
    color: theme.colors.primaryForeground,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  heroHeadline: {
    color: theme.colors.primaryForeground,
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  heroSubtext: {
    color: theme.colors.primaryForeground,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "500",
    marginTop: 12,
    maxWidth: 300,
  },
  heroCta: {
    alignSelf: "flex-start",
    height: 48,
    paddingHorizontal: 18,
    marginTop: 20,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroCtaText: { color: theme.colors.ink, fontSize: 14, fontWeight: "700" },
  carouselDots: {
    position: "absolute",
    right: 18,
    bottom: 16,
    flexDirection: "row",
    gap: 8,
  },
  carouselDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.surface,
    opacity: 0.92,
  },
  carouselDotActive: { backgroundColor: theme.colors.brand, opacity: 1 },
  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  matchesHeader: { marginTop: 26 },
  sectionTitle: {
    flexShrink: 1,
    color: theme.colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    letterSpacing: -0.25,
  },
  seeAll: { color: theme.colors.brand, fontSize: 14, fontWeight: "600" },
  topCardsRow: { paddingLeft: 16, paddingRight: 8, gap: 10 },
  topCard: {
    width: 190,
    minHeight: 208,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: 12,
    ...theme.shadow.card,
  },
  topCardHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  companyMark: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  companyLogoImage: { width: 36, height: 36 },
  companyMarkText: {
    color: theme.colors.brand,
    fontSize: 20,
    fontWeight: "800",
  },
  topCompanyCopy: { flex: 1, paddingTop: 1 },
  companyNameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  companyName: {
    flex: 1,
    color: theme.colors.ink,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "700",
  },
  microBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 7,
    backgroundColor: theme.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  microBadgeText: { color: theme.colors.brand, fontSize: 11, fontWeight: "700" },
  categoryLabel: {
    color: theme.colors.brand,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    marginTop: 2,
  },
  compactJobTitle: {
    color: theme.colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "500",
    marginTop: 14,
  },
  compactPostedText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 8,
  },
  closingCountdownText: {
    flexShrink: 1,
    color: theme.colors.danger,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    marginTop: 3,
  },
  compactSalaryText: {
    flexShrink: 1,
    color: theme.colors.brand,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600",
    marginTop: 3,
  },
  locationRow: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    flex: 1,
    color: theme.colors.inkSoft,
    fontSize: 12,
    lineHeight: 16,
  },
  matchesList: { paddingHorizontal: 16, gap: 10 },
  matchCard: {
    minHeight: 170,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    ...theme.shadow.card,
  },
  matchLogo: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  matchLogoImage: { width: 46, height: 46 },
  matchLogoText: {
    color: theme.colors.brand,
    fontSize: 24,
    fontWeight: "800",
  },
  matchBody: { flex: 1, minWidth: 0 },
  companyStatusRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 34,
    gap: 7,
  },
  matchCompany: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  statusPill: {
    flexShrink: 0,
    paddingHorizontal: 7,
    height: 23,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.colors.selectedBorder,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: { color: theme.colors.brand, fontSize: 11, fontWeight: "600" },
  matchTitle: {
    color: theme.colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    marginTop: 4,
  },
  matchLocationRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    paddingRight: 6,
  },
  matchLocation: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.inkSoft,
    fontSize: 11,
    lineHeight: 15,
  },
  bookmarkButton: {
    position: "absolute",
    right: 0,
    top: -1,
    width: 30,
    height: 30,
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  description: {
    color: theme.colors.inkSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    maxWidth: 330,
  },
  matchFooter: {
    marginTop: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  tagsRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagPill: {
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  tagText: {
    color: theme.colors.ink,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
  },
  postedSalaryStack: {
    flexShrink: 0,
    alignItems: "flex-end",
    gap: 2,
    maxWidth: 136,
  },
  postedPill: {
    minHeight: 26,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: theme.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  postedText: {
    color: theme.colors.brand,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
  },
  skeletonCard: { overflow: "hidden" },
  skeletonBlock: { backgroundColor: theme.colors.surfaceMuted },
  skeletonTopCopy: { flex: 1, paddingTop: 3, gap: 8 },
  skeletonLine: {
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
  },
  skeletonLineShort: { width: "42%" },
  skeletonLineMedium: { width: "68%" },
  skeletonWideLine: { width: "92%", marginTop: 12 },
  skeletonTitleLine: { width: "82%", height: 14, marginTop: 16 },
  skeletonFooterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  skeletonPill: {
    width: 62,
    height: 24,
    borderRadius: 7,
  },
});
