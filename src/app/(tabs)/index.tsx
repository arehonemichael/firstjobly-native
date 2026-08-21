import { useEffect, useMemo, useState } from "react";
import {
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

const HERO_IMAGES = [
  {
    uri: "https://images.unsplash.com/photo-1758876201853-31f6bc71f390?auto=format&fit=crop&w=1400&q=82",
  },
  {
    uri: "https://images.unsplash.com/photo-1758518730380-04c8e0d57b68?auto=format&fit=crop&w=1400&q=82",
  },
  {
    uri: "https://images.unsplash.com/photo-1573167292756-6ca7737b8143?auto=format&fit=crop&w=1400&q=82",
  },
] as const;

const HERO_HEADLINES = [
  "Build experience that opens doors",
  "Skills can shape your next move",
  "Start where opportunity grows",
  "Your next chapter starts with one opportunity",
] as const;

function formatSalary(job: Job): string | null {
  const format = (value: number) => `R${Math.round(value).toLocaleString("en-ZA")}`;

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
  const days = Math.floor(hours / 24);
  return `Posted ${days}d ago`;
}

function tagsFor(job: Job) {
  return [job.category, job.job_type, job.experience_level]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((value, index, list) => list.indexOf(value) === index)
    .slice(0, 3)
    .map(formatCategoryLabel);
}

function jobPath(job: Job) {
  return {
    pathname: "/jobs/[id]" as const,
    params: { id: job.id },
  };
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
    const utcHour = new Date().getUTCHours();
    const hour = (utcHour + 2) % 24;
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }
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
  const [heroImageIndex, setHeroImageIndex] = useState(() =>
    Math.floor(Math.random() * HERO_IMAGES.length),
  );
  const [heroHeadline] = useState(
    () => HERO_HEADLINES[Math.floor(Math.random() * HERO_HEADLINES.length)],
  );
  const [heroFact] = useState(
    () =>
      JOB_MARKET_FACTS[Math.floor(Math.random() * JOB_MARKET_FACTS.length)]?.text ??
      "Practical experience can strengthen your next application.",
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
    const interval = setInterval(() => {
      setHeroImageIndex((current) => (current + 1) % HERO_IMAGES.length);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let alive = true;

    void (async () => {
      try {
        const [top, personalized] = await Promise.all([
          getTopOpportunities(userId, filter, 10),
          getPersonalizedMatches(userId, filter, 20),
        ]);
        if (!alive) return;

        setTopOpportunities(top.length ? top : personalized.slice(0, 10));
        setMatches(personalized.length ? personalized : top.slice(0, 20));
      } catch (error) {
        console.error("Home recommendations failed:", error);
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
        contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding + 18 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.greetingRow}>
          <Text style={styles.greetingText}>{greeting}</Text>
        </View>

        <View style={styles.topBar}>
          <TouchableOpacity
            activeOpacity={0.78}
            style={styles.jobsYouPill}
            onPress={() => router.push(jobsRoute)}
          >
            <Ionicons name="location" size={22} color={theme.colors.brand} />
            <Text style={styles.jobsYouText}>Jobs you</Text>
            <Ionicons name="chevron-down" size={18} color={theme.colors.brand} />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.78} style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={23} color={theme.colors.ink} />
            <View style={styles.notificationDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroWrap}>
          <ImageBackground
            source={HERO_IMAGES[heroImageIndex]}
            resizeMode="cover"
            style={styles.heroImage}
            imageStyle={styles.heroImageRadius}
          >
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(23,33,43,0.50)", "rgba(23,33,43,0.72)", "rgba(23,33,43,0.94)"]}
              locations={[0, 0.5, 1]}
              style={styles.heroScrim}
            />

            <View style={styles.heroContent}>
              <View style={styles.recommendedPill}>
                <Ionicons name="sparkles" size={16} color={theme.colors.primaryForeground} />
                <Text style={styles.recommendedText}>
                  {firstName ? `Recommended for ${firstName}` : "Recommended for you"}
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
                <Ionicons name="arrow-forward" size={20} color={theme.colors.ink} />
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
          </ImageBackground>
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
          {topOpportunities.map((item) => {
            const salary = formatSalary(item);
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.82}
                style={styles.topCard}
                onPress={() => router.push(jobPath(item))}
              >
                <View style={styles.topCardHead}>
                  <View style={styles.companyMark}>
                    {item.company_logo_url ? (
                      <Image
                        source={{ uri: item.company_logo_url }}
                        style={styles.companyLogoImage}
                        resizeMode="contain"
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
          })}
        </ScrollView>

        <View style={[styles.sectionHeader, styles.matchesHeader]}>
          <Text style={styles.sectionTitle}>More great matches for you</Text>
          <TouchableOpacity onPress={() => router.push(jobsRoute)}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.matchesList}>
          {matches.map((item) => {
            const salary = formatSalary(item);
            return (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.84}
                style={styles.matchCard}
                onPress={() => router.push(jobPath(item))}
              >
                <View style={styles.matchLogo}>
                  {item.company_logo_url ? (
                    <Image
                      source={{ uri: item.company_logo_url }}
                      style={styles.matchLogoImage}
                      resizeMode="contain"
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
                      <Text style={styles.statusText}>
                        {item.is_urgent ? "Hot" : "New"}
                      </Text>
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
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingTop: 8,
  },
  greetingRow: {
    paddingHorizontal: 16,
    marginBottom: 2,
  },
  greetingText: {
    color: theme.colors.inkSoft,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  topBar: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  jobsYouPill: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.brandSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  jobsYouText: {
    color: theme.colors.brand,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
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
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    ...theme.shadow.card,
  },
  heroImage: {
    minHeight: 306,
    justifyContent: "space-between",
  },
  heroImageRadius: {
    borderRadius: theme.radius.lg,
  },
  heroScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  heroContent: {
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
  heroCtaText: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "700",
  },
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
  carouselDotActive: {
    backgroundColor: theme.colors.brand,
    opacity: 1,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginTop: 22,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  matchesHeader: {
    marginTop: 26,
  },
  sectionTitle: {
    flexShrink: 1,
    color: theme.colors.ink,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    letterSpacing: -0.25,
  },
  seeAll: {
    color: theme.colors.brand,
    fontSize: 14,
    fontWeight: "600",
  },
  topCardsRow: {
    paddingLeft: 16,
    paddingRight: 8,
    gap: 10,
  },
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
  topCardHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  companyMark: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  companyLogoImage: {
    width: 36,
    height: 36,
  },
  companyMarkText: {
    color: theme.colors.brand,
    fontSize: 20,
    fontWeight: "800",
  },
  topCompanyCopy: {
    flex: 1,
    paddingTop: 1,
  },
  companyNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
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
  microBadgeText: {
    color: theme.colors.brand,
    fontSize: 11,
    fontWeight: "700",
  },
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
  matchesList: {
    paddingHorizontal: 16,
    gap: 10,
  },
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
  matchLogoImage: {
    width: 46,
    height: 46,
  },
  matchLogoText: {
    color: theme.colors.brand,
    fontSize: 24,
    fontWeight: "800",
  },
  matchBody: {
    flex: 1,
    minWidth: 0,
  },
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
  statusText: {
    color: theme.colors.brand,
    fontSize: 11,
    fontWeight: "600",
  },
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
  tagsRow: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
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
});
