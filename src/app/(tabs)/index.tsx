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

const categories = [
  { name: "Learnerships", icon: "school-outline" },
  { name: "Internships", icon: "business-outline" },
  { name: "Graduate", icon: "ribbon-outline" },
  { name: "Government", icon: "flag-outline" },
  { name: "Entry Level", icon: "briefcase-outline" },
  { name: "Bursaries", icon: "book-outline" },
];

export default function HomeScreen() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJobs(0)
      .then((data) => setJobs(data.slice(0, 8)))
      .catch((error) => console.error("Home jobs failed:", error))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
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
            <Ionicons name="notifications-outline" size={23} color="#0B1F30" />
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            Find your next{"\n"}opportunity.
          </Text>

          <Text style={styles.heroText}>
            Jobs, learnerships, internships and graduate programmes across
            South Africa.
          </Text>

          <TouchableOpacity
            style={styles.search}
            activeOpacity={0.9}
            onPress={() => router.push("/jobs")}
          >
            <Ionicons name="search" size={20} color="#667085" />
            <TextInput
              editable={false}
              pointerEvents="none"
              placeholder="Search jobs or companies"
              placeholderTextColor="#98A2B3"
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
              onPress={() => router.push("/jobs")}
            >
              <View style={styles.categoryIcon}>
                <Ionicons
                  name={category.icon as any}
                  size={22}
                  color="#E31C5F"
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
          <ActivityIndicator
            color="#E31C5F"
            style={{ marginVertical: 35 }}
          />
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
                    color="#667085"
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

              <Ionicons name="chevron-forward" size={20} color="#98A2B3" />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:"#FAFAFA"},
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

  logo:{color:"#0B1F30",fontSize:26,fontWeight:"800"},
  logoPink:{color:"#E31C5F"},
  tagline:{marginTop:2,color:"#667085",fontSize:12},

  notification:{
    width:44,
    height:44,
    borderRadius:22,
    backgroundColor:"#FFFFFF",
    alignItems:"center",
    justifyContent:"center",
    borderWidth:1,
    borderColor:"#EAECF0",
  },

  hero:{
    marginHorizontal:16,
    backgroundColor:"#0B1F30",
    borderRadius:24,
    padding:22,
  },

  heroTitle:{
    color:"#FFFFFF",
    fontSize:31,
    lineHeight:36,
    fontWeight:"800",
  },

  heroText:{
    color:"#D0D5DD",
    marginTop:10,
    lineHeight:20,
    fontSize:14,
  },

  search:{
    marginTop:20,
    height:54,
    borderRadius:15,
    backgroundColor:"#FFFFFF",
    paddingHorizontal:16,
    flexDirection:"row",
    alignItems:"center",
  },

  searchInput:{
    flex:1,
    marginLeft:10,
    fontSize:15,
    color:"#111827",
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
    fontWeight:"800",
    color:"#0B1F30",
  },

  viewAll:{color:"#E31C5F",fontWeight:"700"},

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
    borderRadius:16,
    borderWidth:1,
    borderColor:"#EAECF0",
  },

  categoryIcon:{
    width:39,
    height:39,
    borderRadius:12,
    backgroundColor:"#FFF0F5",
    alignItems:"center",
    justifyContent:"center",
    marginBottom:10,
  },

  categoryText:{
    color:"#0B1F30",
    fontWeight:"700",
    fontSize:12,
  },

  jobCard:{
    marginHorizontal:16,
    marginBottom:10,
    backgroundColor:"#FFFFFF",
    borderRadius:18,
    padding:15,
    flexDirection:"row",
    alignItems:"flex-start",
    borderWidth:1,
    borderColor:"#EAECF0",
  },

  companyLogo:{
    width:50,
    height:50,
    borderRadius:13,
    backgroundColor:"#F2F4F7",
    alignItems:"center",
    justifyContent:"center",
  },

  companyLetter:{
    fontWeight:"800",
    fontSize:20,
    color:"#0B1F30",
  },

  jobContent:{
    flex:1,
    marginHorizontal:13,
  },

  jobTitle:{
    color:"#0B1F30",
    fontSize:15,
    lineHeight:20,
    fontWeight:"800",
  },

  company:{
    color:"#667085",
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
    color:"#667085",
    fontSize:11,
    marginLeft:3,
  },

  badges:{
    flexDirection:"row",
    gap:7,
    marginTop:9,
  },

  badge:{
    backgroundColor:"#F2F4F7",
    paddingHorizontal:8,
    paddingVertical:4,
    borderRadius:7,
  },

  badgeText:{
    color:"#344054",
    fontSize:10,
    fontWeight:"700",
  },

  urgentBadge:{
    backgroundColor:"#FFF0F5",
    paddingHorizontal:8,
    paddingVertical:4,
    borderRadius:7,
  },

  urgentText:{
    color:"#E31C5F",
    fontSize:10,
    fontWeight:"800",
  },
});
