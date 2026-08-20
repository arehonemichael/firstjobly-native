import { useEffect, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { getJobs } from "../../lib/job-api";
import type { Job } from "../../lib/jobs";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { useAuth } from "../../hooks/use-auth";
import { SkeletonJobCard } from "../../components/ui/app-ui";
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
  const auth = useAuth();
  const authAny = auth as any;
  const { openJobWithEarlyInterstitial } = useEarlyJobInterstitial();

  const firstName = String(
    authAny?.user?.user_metadata?.full_name ??
      authAny?.user?.user_metadata?.name ??
      ""
  )
    .trim()
    .split(/\s+/)[0];

  const hour = new Date().getHours();
  const dayGreeting =
    hour < 12
      ? "Good morning"
      : hour < 18
        ? "Good afternoon"
        : "Good evening";

  const greetingLabel = firstName
    ? `${dayGreeting}, ${firstName}`
    : "Find your next opportunity";

  const bottomContentPadding = useScreenBottomPadding(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJobs(0)
      .then((data) => setJobs(data.slice(0, 6)))
      .catch((error) => console.error("Home jobs failed:", error))
      .finally(() => setLoading(false));
  }, []);

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

          <TouchableOpacity style={styles.notification} activeOpacity={0.78}>
            <Ionicons
              name="notifications-outline"
              size={22}
              color="#061A30"
            />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>YOUR NEXT MOVE</Text>
          <Text style={styles.heroTitle}>{greetingLabel}</Text>
          <Text style={styles.heroText}>
            Discover opportunities that match where you are and where you want
            to go.
          </Text>

          <TouchableOpacity
            style={styles.search}
            activeOpacity={0.82}
            onPress={() => router.push("/jobs")}
          >
            <Ionicons name="search" size={20} color="#556274" />
            <Text style={styles.searchText}>Search jobs or companies</Text>
            <Ionicons name="arrow-forward" size={18} color="#061A30" />
          </TouchableOpacity>

          <View style={styles.trustRow}>
            <Ionicons name="sparkles-outline" size={15} color="#F8C5D6" />
            <Text style={styles.trustText}>
              Fresh opportunities added regularly
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Find your fit</Text>
            <Text style={styles.sectionSubtitle}>
              Browse the opportunity types people use most
            </Text>
          </View>
        </View>

        <View style={styles.categoryList}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.name}
              style={styles.category}
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
                  color="#E1225F"
                />
              </View>

              <View style={styles.categoryCopy}>
                <Text style={styles.categoryText}>{category.name}</Text>
                <Text style={styles.categorySubtitle} numberOfLines={1}>
                  {category.subtitle}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color="#94A3B8"
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeaderJobs}>
          <View style={styles.sectionHeadingCopy}>
            <Text style={styles.sectionTitle}>Recommended for you</Text>
            <Text style={styles.sectionSubtitle}>
              New opportunities worth a look
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
                    })
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
                  <Text style={styles.jobTitle} numberOfLines={2}>
                    {job.title}
                  </Text>

                  <Text style={styles.company}>{job.company_name}</Text>

                  <View style={styles.jobMeta}>
                    <Ionicons
                      name="location-outline"
                      size={14}
                      color="#556274"
                    />
                    <Text style={styles.metaText} numberOfLines={1}>
                      {job.city
                        ? `${job.city}, ${job.province}`
                        : job.province}
                    </Text>
                  </View>

                  <View style={styles.badges}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{job.category}</Text>
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
                  color="#94A3B8"
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
    backgroundColor: "#F6F7F9",
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
    color: "#E1225F",
    fontSize: 27,
    lineHeight: 32,
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontWeight: "800",
  },
  logoDark: {
    color: "#061A30",
  },
  tagline: {
    marginTop: 3,
    color: "#556274",
    fontSize: 12,
    fontFamily: "PlusJakartaSans_500Medium",
  },
  notification: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8EBF0",
  },
  hero: {
    marginHorizontal: 16,
    backgroundColor: "#061A30",
    borderRadius: 24,
    padding: 24,
  },
  heroEyebrow: {
    color: "#E1225F",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.9,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 31,
    lineHeight: 38,
    marginTop: 9,
    letterSpacing: -0.5,
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontWeight: "800",
  },
  heroText: {
    color: "#DFE4EC",
    marginTop: 10,
    lineHeight: 21,
    fontSize: 14,
    maxWidth: 300,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  search: {
    marginTop: 24,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchText: {
    flex: 1,
    fontSize: 14,
    color: "#556274",
    fontFamily: "PlusJakartaSans_500Medium",
  },
  trustRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  trustText: {
    color: "#F8C5D6",
    fontSize: 11,
    fontFamily: "PlusJakartaSans_600SemiBold",
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
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontWeight: "800",
    color: "#061A30",
  },
  sectionSubtitle: {
    marginTop: 3,
    color: "#556274",
    fontSize: 12,
    lineHeight: 17,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  seeAllButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  viewAll: {
    color: "#E1225F",
    fontFamily: "PlusJakartaSans_700Bold",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8EBF0",
    flexDirection: "row",
    alignItems: "center",
  },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FDEEF3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  categoryCopy: {
    flex: 1,
    minWidth: 0,
  },
  categoryText: {
    color: "#061A30",
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
    fontSize: 14,
    lineHeight: 19,
  },
  categorySubtitle: {
    marginTop: 2,
    color: "#556274",
    fontFamily: "PlusJakartaSans_400Regular",
    fontSize: 11,
    lineHeight: 16,
  },
  jobsList: {
    gap: 12,
  },
  jobCard: {
    marginHorizontal: 16,
    minHeight: 124,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#E8EBF0",
    shadowColor: "#061A30",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  companyLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  companyLetter: {
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontWeight: "800",
    fontSize: 19,
    color: "#061A30",
  },
  jobContent: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    minWidth: 0,
  },
  jobTitle: {
    color: "#061A30",
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
  },
  company: {
    color: "#556274",
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  jobMeta: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    flex: 1,
    color: "#556274",
    fontSize: 11,
    lineHeight: 16,
    marginLeft: 4,
    fontFamily: "PlusJakartaSans_400Regular",
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 8,
  },
  badge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  badgeText: {
    color: "#556274",
    fontSize: 10,
    fontFamily: "PlusJakartaSans_600SemiBold",
    fontWeight: "600",
  },
  urgentBadge: {
    backgroundColor: "#FDEEF3",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  urgentText: {
    color: "#E1225F",
    fontSize: 10,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
  },
  jobChevron: {
    marginTop: 14,
  },
});
