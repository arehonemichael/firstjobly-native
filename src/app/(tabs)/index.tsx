import {
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { theme } from "../../constants/theme";

const heroImage = {
  uri: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=85",
};

const topOpportunities = [
  {
    company: "Airbnb",
    badge: "✦",
    category: "Design",
    title: "Product Designer",
    salary: "$120,000 – $145,000",
    location: "San Francisco, CA",
    mark: "A",
  },
  {
    company: "Google",
    badge: "G",
    category: "Engineering",
    title: "Frontend Engineer",
    salary: "$130,000 – $160,000",
    location: "Remote · United States",
    mark: "G",
  },
  {
    company: "Notion",
    badge: "N",
    category: "Product",
    title: "Product Manager",
    salary: "$110,000 – $135,000",
    location: "New York, NY",
    mark: "N",
  },
  {
    company: "Stripe",
    badge: "S",
    category: "Growth",
    title: "Market Strategist",
    salary: "$115,000 – $140,000",
    location: "Chicago, IL",
    mark: "S",
  },
] as const;

const matches = [
  {
    company: "Slack",
    status: "New",
    salary: "$115,000 – $140,000",
    title: "Senior UX Researcher",
    location: "Remote · United States",
    description: "Lead user research initiatives that shape products millions of people use every day.",
    tags: ["UX Research", "User Interviews", "Figma"],
    posted: "Posted 2h ago",
    mark: "S",
  },
  {
    company: "Microsoft",
    status: "Hot",
    salary: "$125,000 – $150,000",
    title: "Software Engineer II",
    location: "Seattle, WA",
    description: "Build scalable cloud solutions and delightful experiences for Microsoft 365 users.",
    tags: ["TypeScript", "Azure", ".NET"],
    posted: "Posted 5h ago",
    mark: "M",
  },
] as const;

export default function HomeScreen() {
  const bottomContentPadding = useScreenBottomPadding(true);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding + 18 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            activeOpacity={0.78}
            style={styles.jobsYouPill}
            onPress={() => router.push("/jobs")}
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
          <ImageBackground source={heroImage} resizeMode="cover" style={styles.heroImage} imageStyle={styles.heroImageRadius}>
            <View style={styles.heroOverlay} />

            <View style={styles.heroContent}>
              <View style={styles.recommendedPill}>
                <Ionicons name="sparkles" size={16} color={theme.colors.primaryForeground} />
                <Text style={styles.recommendedText}>Recommended for you</Text>
              </View>

              <Text style={styles.heroHeadline}>Find the perfect job{"\n"}for your next chapter</Text>
              <Text style={styles.heroSubtext}>Handpicked opportunities based on your skills and goals.</Text>

              <TouchableOpacity
                activeOpacity={0.86}
                style={styles.heroCta}
                onPress={() => router.push("/jobs")}
              >
                <Text style={styles.heroCtaText}>See recommendations</Text>
                <Ionicons name="arrow-forward" size={20} color={theme.colors.ink} />
              </TouchableOpacity>
            </View>

            <View style={styles.carouselDots}>
              <View style={[styles.carouselDot, styles.carouselDotActive]} />
              <View style={styles.carouselDot} />
              <View style={styles.carouselDot} />
            </View>
          </ImageBackground>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top opportunities near you</Text>
          <TouchableOpacity onPress={() => router.push("/jobs")}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topCardsRow}
        >
          {topOpportunities.map((item) => (
            <TouchableOpacity
              key={item.company}
              activeOpacity={0.82}
              style={styles.topCard}
              onPress={() => router.push("/jobs")}
            >
              <View style={styles.topCardHead}>
                <View style={styles.companyMark}>
                  <Text style={styles.companyMarkText}>{item.mark}</Text>
                </View>

                <View style={styles.topCompanyCopy}>
                  <View style={styles.companyNameRow}>
                    <Text numberOfLines={1} style={styles.companyName}>{item.company}</Text>
                    <View style={styles.microBadge}>
                      <Text style={styles.microBadgeText}>{item.badge}</Text>
                    </View>
                  </View>
                  <Text style={styles.categoryLabel}>{item.category}</Text>
                </View>
              </View>

              <Text style={styles.compactJobTitle}>{item.title}</Text>
              <Text style={styles.salary}>{item.salary}</Text>

              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={theme.colors.inkSoft} />
                <Text numberOfLines={1} style={styles.locationText}>{item.location}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={[styles.sectionHeader, styles.matchesHeader]}>
          <Text style={styles.sectionTitle}>More great matches for you</Text>
          <TouchableOpacity onPress={() => router.push("/jobs")}>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.matchesList}>
          {matches.map((item) => (
            <TouchableOpacity
              key={item.company}
              activeOpacity={0.84}
              style={styles.matchCard}
              onPress={() => router.push("/jobs")}
            >
              <View style={styles.matchLogo}>
                <Text style={styles.matchLogoText}>{item.mark}</Text>
              </View>

              <View style={styles.matchBody}>
                <View style={styles.matchTopRow}>
                  <View style={styles.matchIdentity}>
                    <View style={styles.companyStatusRow}>
                      <Text style={styles.matchCompany}>{item.company}</Text>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusText}>{item.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.matchTitle}>{item.title}</Text>
                  </View>

                  <View style={styles.matchRight}>
                    <Text style={styles.matchSalary}>{item.salary}</Text>
                    <View style={styles.matchLocationRow}>
                      <Ionicons name="location-outline" size={14} color={theme.colors.inkSoft} />
                      <Text numberOfLines={1} style={styles.matchLocation}>{item.location}</Text>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.bookmarkButton} activeOpacity={0.7}>
                    <Ionicons name="bookmark-outline" size={22} color={theme.colors.ink} />
                  </TouchableOpacity>
                </View>

                <Text numberOfLines={2} style={styles.description}>{item.description}</Text>

                <View style={styles.matchFooter}>
                  <View style={styles.tagsRow}>
                    {item.tags.map((tag) => (
                      <View key={tag} style={styles.tagPill}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.postedPill}>
                    <Text style={styles.postedText}>{item.posted}</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
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
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.ink,
    opacity: 0.58,
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
    color: theme.colors.heroSupportingText,
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
    minHeight: 198,
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
    flexShrink: 1,
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
  salary: {
    color: theme.colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    marginTop: 8,
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
    minHeight: 162,
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
  matchTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingRight: 28,
    gap: 8,
  },
  matchIdentity: {
    flex: 1,
    minWidth: 0,
  },
  companyStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  matchCompany: {
    color: theme.colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  statusPill: {
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
  matchRight: {
    width: 126,
    alignItems: "flex-start",
  },
  matchSalary: {
    color: theme.colors.ink,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  matchLocationRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    maxWidth: 126,
  },
  matchLocation: {
    flex: 1,
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
    alignItems: "center",
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
