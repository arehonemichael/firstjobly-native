import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { InlineErrorState, SkeletonJobCard } from "../../components/ui/app-ui";
import { SponsoredSlot } from "../../components/ads/sponsored-slot";

const categories = [
  { name: "Learnerships", icon: "school-outline", params: { category: "learnership" } },
  { name: "Internships", icon: "business-outline", params: { category: "internship" } },
  { name: "Graduate", icon: "ribbon-outline", params: { category: "graduate_programme" } },
  { name: "Government", icon: "flag-outline", params: { category: "government" } },
  { name: "Entry Level", icon: "briefcase-outline", params: { experience: "Entry level" } },
  { name: "Bursaries", icon: "book-outline", params: { category: "bursary" } },
];

export default function HomeScreen() {
  const auth = useAuth();
  const authAny = auth as any;

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
    : "Find your opportunity";
  const bottomContentPadding = useScreenBottomPadding(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJobs(0)
      .then((data) => setJobs(data.slice(0, 8)))
      .catch((error) => console.error("Home jobs failed:", error))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>
              First<Text style={styles.logoPink}>Jobly</Text>
            </Text>
            <Text style={styles.tagline}>Your career starts here.</Text>
          </View>

          <TouchableOpacity style={styles.notification}>
            <Ionicons name="notifications-outline" size={23} color="#061A30" />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            {greetingLabel}
          </Text>

          <TouchableOpacity
            style={styles.search}
            activeOpacity={0.9}
            onPress={() => router.push("/jobs")}
          >
            <Ionicons name="search" size={20} color="#556274" />
            <TextInput
              editable={false}
              pointerEvents="none"
              placeholder="Search jobs or companies"
              placeholderTextColor="#94A3B8"
              style={styles.searchInput}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Explore opportunities</Text>
        </View>

        <View style={styles.categoryGrid}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.name}
              style={styles.category}
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
                  size={22}
                  color="#E1225F"
                />
              </View>

              <Text style={styles.categoryText}>{category.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Latest opportunities</Text>

          <TouchableOpacity onPress={() => router.push("/jobs")}>
            <Text style={styles.viewAll}>View all</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View>
            <SkeletonJobCard />
            <SkeletonJobCard />
            <SkeletonJobCard />
          </View>
        ) : (
          jobs.map((job) => (
            <TouchableOpacity
              key={job.id}
              style={styles.jobCard}
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

              <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#F6F7F9"},
  container:{flex:1},
  content:{paddingBottom:30},

  header:{
    paddingHorizontal:20,
    paddingTop:8,
    paddingBottom:18,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
  },

  logo:{color:"#E1225F",fontSize:26,fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800"},
  logoPink:{color:"#061A30"},
  tagline:{marginTop:2,color:"#556274",fontSize:12},

  notification:{
    width:44,
    height:44,
    borderRadius:22,
    backgroundColor:"#FFFFFF",
    alignItems:"center",
    justifyContent:"center",
    borderWidth:1,
    borderColor:"#E8EBF0",
  },

  hero:{
    marginHorizontal:16,
    backgroundColor:"#061A30",
    borderRadius: 10,
    padding:22,
  },

  heroTitle:{
    color:"#FFFFFF",
    fontSize:31,
    lineHeight:36,
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
  },

  heroText:{
    color:"#DFE4EC",
    marginTop:10,
    lineHeight:20,
    fontSize:14,
  },

  search:{
    marginTop:20,
    height:54,
    borderRadius: 8,
    backgroundColor:"#FFFFFF",
    paddingHorizontal:16,
    flexDirection:"row",
    alignItems:"center",
  },

  searchInput:{
    flex:1,
    marginLeft:10,
    fontSize:15,
    color:"#061A30",
  },

  sectionHeader:{
    marginTop:27,
    marginBottom:14,
    paddingHorizontal:20,
    flexDirection:"row",
    alignItems:"center",
    justifyContent:"space-between",
  },

  sectionTitle:{
    fontSize:19,
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
    color:"#061A30",
  },

  viewAll:{color:"#E1225F",fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700"},

  categoryGrid:{
    paddingHorizontal:16,
    flexDirection:"row",
    flexWrap:"wrap",
    gap:10,
  },

  category:{
    width:"31%",
    minHeight:105,
    padding:12,
    backgroundColor:"#FFFFFF",
    borderRadius: 8,
    borderWidth:1,
    borderColor:"#E8EBF0",
  },

  categoryIcon:{
    width:39,
    height:39,
    borderRadius: 8,
    backgroundColor:"#FDEEF3",
    alignItems:"center",
    justifyContent:"center",
    marginBottom:10,
  },

  categoryText:{
    color:"#061A30",
    fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700",
    fontSize:12,
  },

  jobCard:{
    marginHorizontal:16,
    marginBottom:10,
    backgroundColor:"#FFFFFF",
    borderRadius: 8,
    padding:15,
    flexDirection:"row",
    alignItems:"flex-start",
    borderWidth:1,
    borderColor:"#E8EBF0",
  },

  companyLogo:{
    width:50,
    height:50,
    borderRadius: 8,
    backgroundColor:"#F1F5F9",
    alignItems:"center",
    justifyContent:"center",
  },

  companyLetter:{
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
    fontSize:20,
    color:"#061A30",
  },

  jobContent:{
    flex:1,
    marginHorizontal:13,
  },

  jobTitle:{
    color:"#061A30",
    fontSize:15,
    lineHeight:20,
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
  },

  company:{
    color:"#556274",
    marginTop:4,
    fontSize:13,
  },

  jobMeta:{
    marginTop:8,
    flexDirection:"row",
    alignItems:"center",
  },

  metaText:{
    flex:1,
    color:"#556274",
    fontSize:11,
    marginLeft:3,
  },

  badges:{
    flexDirection:"row",
    gap:7,
    marginTop:9,
  },

  badge:{
    backgroundColor:"#F1F5F9",
    paddingHorizontal:8,
    paddingVertical:4,
    borderRadius:7,
  },

  badgeText:{
    color:"#556274",
    fontSize:10,
    fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700",
  },

  urgentBadge:{
    backgroundColor:"#FDEEF3",
    paddingHorizontal:8,
    paddingVertical:4,
    borderRadius:7,
  },

  urgentText:{
    color:"#E1225F",
    fontSize:10,
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
  },
});












