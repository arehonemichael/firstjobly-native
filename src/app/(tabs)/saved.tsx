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
import { useSavedJobs } from "../../hooks/use-saved-jobs";
import { supabase } from "../../lib/supabase";
import type { Job } from "../../lib/jobs";

export default function SavedScreen() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { savedIds, loading: savedLoading, refreshSaved } = useSavedJobs();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  const loadJobs = useCallback(async () => {
    if (savedIds.length === 0) {
      setJobs([]);
      return;
    }

    try {
      setLoadingJobs(true);

      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .in("id", savedIds)
        .eq("approval_status", "approved");

      if (error) throw error;

      const rows = (data ?? []) as Job[];

      const order = new Map(savedIds.map((id, index) => [id, index]));

      rows.sort(
        (a, b) =>
          (order.get(a.id) ?? 9999) -
          (order.get(b.id) ?? 9999)
      );

      setJobs(rows);
    } catch (error) {
      console.error("Could not load saved jobs:", error);
    } finally {
      setLoadingJobs(false);
    }
  }, [savedIds]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  if (authLoading || savedLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#E31C5F" />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={44} color="#E31C5F" />

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
    <SafeAreaView style={styles.page} edges={["top"]}>
      <FlatList
        data={jobs}
        keyExtractor={(job) => job.id}
        contentContainerStyle={styles.list}
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
            <ActivityIndicator color="#E31C5F" style={{ marginTop: 60 }} />
          ) : (
            <View style={styles.emptyList}>
              <Ionicons name="bookmark-outline" size={38} color="#98A2B3" />

              <Text style={styles.emptyListTitle}>No saved jobs yet</Text>

              <Text style={styles.emptyText}>
                Open a job and tap the bookmark icon to save it.
              </Text>

              <TouchableOpacity
                style={styles.secondary}
                onPress={() => router.push("/jobs")}
              >
                <Text style={styles.secondaryText}>Search jobs</Text>
              </TouchableOpacity>
            </View>
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
                  color="#667085"
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
              color="#98A2B3"
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
    backgroundColor: "#FAFAFA",
  },

  center: {
    flex: 1,
    backgroundColor: "#FAFAFA",
    alignItems: "center",
    justifyContent: "center",
  },

  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  header: {
    paddingTop: 18,
    paddingBottom: 18,
  },

  title: {
    color: "#0B1F30",
    fontSize: 24,
    fontWeight: "800",
  },

  subtitle: {
    marginTop: 4,
    color: "#667085",
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
    color: "#0B1F30",
    fontSize: 21,
    fontWeight: "800",
  },

  emptyText: {
    maxWidth: 310,
    marginTop: 8,
    color: "#667085",
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
    color: "#0B1F30",
    fontWeight: "800",
  },

  primary: {
    width: "100%",
    height: 52,
    marginTop: 24,
    borderRadius: 10,
    backgroundColor: "#E31C5F",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  secondary: {
    marginTop: 20,
    height: 48,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryText: {
    color: "#0B1F30",
    fontWeight: "700",
  },

  card: {
    minHeight: 88,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "flex-start",
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
    fontSize: 18,
    fontWeight: "800",
  },

  jobInfo: {
    flex: 1,
    marginHorizontal: 12,
  },

  jobTitle: {
    color: "#101828",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },

  company: {
    marginTop: 3,
    color: "#475467",
    fontSize: 12,
  },

  meta: {
    marginTop: 7,
    flexDirection: "row",
    alignItems: "center",
  },

  metaText: {
    marginLeft: 4,
    color: "#667085",
    fontSize: 11,
  },
});
