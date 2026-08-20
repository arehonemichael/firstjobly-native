import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../hooks/use-auth";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { EmptyState, SkeletonJobCard } from "../../components/ui/app-ui";
import { useSavedJobs } from "../../hooks/use-saved-jobs";
import { supabase } from "../../lib/supabase";
import type { Job } from "../../lib/jobs";

export default function SavedScreen() {
  const bottomContentPadding = useScreenBottomPadding(true);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { savedIds, isSaved, toggleSave, loading: savingLoading, refreshSaved } = useSavedJobs();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(async () => {
    if (!isAuthenticated || !supabase || savedIds.length === 0) { setJobs([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase.from('jobs').select('*').in('id', savedIds).eq('approval_status', 'approved').eq('is_active', true);
      if (error) throw error;
      const byId = new Map((data ?? []).map((job) => [job.id, job as Job]));
      setJobs(savedIds.map((id) => byId.get(id)).filter((job): job is Job => Boolean(job)));
    } catch (error) {
      console.error('Could not load saved jobs:', error);
    } finally { setLoading(false); }
  }, [isAuthenticated, savedIds]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  if (authLoading || savedLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#E1225F" />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={44} color="#E1225F" />

          <Text style={styles.emptyTitle}>Save jobs for later</Text>

          <Text style={styles.emptyText}>
            Sign in to save opportunities and access them from your FirstJobly account.
          </Text>

          <TouchableOpacity
            style={styles.primary}
            onPress={() => router.push("/auth")}
          >
            <Text style={styles.primaryText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <FlatList
        data={jobs}
        keyExtractor={(job) => job.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomContentPadding }]}
        refreshing={savedLoading || loadingJobs}
        onRefresh={() => void refreshSaved()}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Saved jobs</Text>
            <Text style={styles.subtitle}>
              {jobs.length} saved {jobs.length === 1 ? "opportunity" : "opportunities"}
            </Text>
          </View>
        }
        ListEmptyComponent={
          loadingJobs ? (
            <View>
              <SkeletonJobCard />
              <SkeletonJobCard />
              <SkeletonJobCard />
            </View>
          ) : (
            <EmptyState
              title="No saved jobs yet"
              message="Open an opportunity and tap the bookmark icon to save it for later."
              actionLabel="Search jobs"
              onAction={() => router.push("/jobs")}
            />
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              router.push({
                pathname: "/jobs/[id]",
                params: { id: item.id },
              })
            }
          >
            {item.company_logo_url ? (
              <Image
                source={{ uri: item.company_logo_url }}
                style={styles.logo}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.logo}>
                <Text style={styles.logoText}>
                  {item.company_name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.jobInfo}>
              <Text style={styles.jobTitle} numberOfLines={2}>
                {item.title}
              </Text>

              <Text style={styles.company}>{item.company_name}</Text>

              <View style={styles.meta}>
                <Ionicons
                  name="location-outline"
                  size={14}
                  color="#556274"
                />

                <Text style={styles.metaText}>
                  {item.city
                    ? `${item.city}, ${item.province}`
                    : item.province}
                </Text>
              </View>
            </View>

            <Ionicons
              name="chevron-forward"
              size={19}
              color="#94A3B8"
            />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F6F7F9",
  },

  center: {
    flex: 1,
    backgroundColor: "#F6F7F9",
    alignItems: "center",
    justifyContent: "center",
  },

  list: {
    paddingHorizontal: 16,
    paddingBottom: 110,
  },

  header: {
    paddingTop: 18,
    paddingBottom: 18,
  },

  title: {
    color: "#061A30",
    fontSize: 24,
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
  },

  subtitle: {
    marginTop: 4,
    color: "#556274",
    fontSize: 13,
  },

  empty: {
    flex: 1,
    padding: 28,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyTitle: {
    marginTop: 18,
    color: "#061A30",
    fontSize: 21,
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
  },

  emptyText: {
    maxWidth: 310,
    marginTop: 8,
    color: "#556274",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },

  emptyList: {
    alignItems: "center",
    paddingTop: 80,
  },

  emptyListTitle: {
    marginTop: 12,
    color: "#061A30",
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
  },

  primary: {
    width: "100%",
    height: 52,
    marginTop: 24,
    borderRadius: 10,
    backgroundColor: "#E1225F",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryText: {
    color: "#FFFFFF",
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
  },

  secondary: {
    marginTop: 20,
    height: 48,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryText: {
    color: "#061A30",
    fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700",
  },

  card: {
    minHeight: 88,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EBF0",
  },

  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  logoText: {
    color: "#E1225F",
    fontSize: 18,
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
  },

  jobInfo: {
    flex: 1,
    marginHorizontal: 12,
  },

  jobTitle: {
    color: "#061A30",
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700",
  },

  company: {
    marginTop: 3,
    color: "#556274",
    fontSize: 12,
  },

  meta: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
  },

  metaText: {
    marginLeft: 4,
    color: "#556274",
    fontSize: 11,
  },
});








