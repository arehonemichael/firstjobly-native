import { AdBanner } from "../../ads/AdBanner";
import { JobMetadata } from "../../components/ui/job-metadata";
import {
  AppText as Text,
  AppTouchableOpacity as TouchableOpacity,
} from "../../components/ui/primitives";
import { Fonts, Colors } from "../../constants/theme";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  View,
} from "react-native";
import { Icon as Ionicons } from "../../components/ui/icon";
import { router } from "expo-router";


import { useAuth } from "../../hooks/use-auth";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { EmptyState, SkeletonJobCard } from "../../components/ui/app-ui";
import { useSavedJobs } from "../../hooks/use-saved-jobs";
import { supabase } from "../../lib/supabase";
import type { Job } from "../../lib/jobs";

export default function NormalSavedJobs() {
  const bottomContentPadding = useScreenBottomPadding(true);
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
        (a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999),
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
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={styles.page}>
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={44} color={Colors.primary} />

          <Text style={styles.emptyTitle}>Save jobs for later</Text>

          <Text style={styles.emptyText}>
            Sign in to save opportunities and access them from your FirstJobly
            account.
          </Text>

          <TouchableOpacity
            style={styles.primary}
            onPress={() =>
              router.push({ pathname: "/auth", params: { returnTo: "/saved" } })
            }
          >
            <Text style={styles.primaryText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <FlatList
        data={jobs}
        keyExtractor={(job) => job.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomContentPadding },
        ]}
        refreshing={savedLoading || loadingJobs}
        onRefresh={() => void refreshSaved()}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Saved jobs</Text>
            <Text style={styles.subtitle}>
              {jobs.length} saved{" "}
              {jobs.length === 1 ? "opportunity" : "opportunities"}
            </Text>
            <AdBanner placement="saved" />
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
              <Text style={styles.jobTitle}>{item.title}</Text>

              <Text style={styles.company}>{item.company_name}</Text>

              <View style={styles.meta}>
                <Ionicons
                  name="location-outline"
                  size={18}
                  color={Colors.muted}
                />

                <Text style={styles.metaText}>
                  {item.city ? `${item.city}, ${item.province}` : item.province}
                </Text>
              </View>
              <JobMetadata job={item} />
            </View>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={Colors.mutedSubtle}
            />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  center: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },

  list: {
    paddingHorizontal: 16,
    paddingBottom: 112,
  },

  header: {
    paddingTop: 20,
    paddingBottom: 20,
  },

  title: {
    fontFamily: Fonts.editorial,
    fontWeight: "400",
    color: Colors.foreground,
    fontSize: 24,
  },

  subtitle: {
    marginTop: 4,
    color: Colors.muted,
    fontSize: 13,
  },

  empty: {
    flex: 1,
    padding: 28,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyTitle: {
    fontFamily: Fonts.editorial,
    fontWeight: "400",
    marginTop: 20,
    color: Colors.foreground,
    fontSize: 20,
  },

  emptyText: {
    maxWidth: 310,
    marginTop: 8,
    color: Colors.muted,
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
    color: Colors.foreground,
    fontFamily: Fonts.medium,
    fontWeight: "500",
  },

  primary: {
    width: "100%",
    height: 52,
    marginTop: 24,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryText: {
    color: Colors.surface,
    fontFamily: Fonts.medium,
    fontWeight: "500",
  },

  secondary: {
    marginTop: 20,
    height: 48,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryText: {
    color: Colors.foreground,
    fontFamily: Fonts.medium,
    fontWeight: "500",
  },

  card: {
    minHeight: 88,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },

  logoText: {
    color: Colors.primaryPressed,
    fontSize: 18,
    fontFamily: Fonts.medium,
    fontWeight: "500",
  },

  jobInfo: {
    flex: 1,
    marginHorizontal: 12,
  },

  jobTitle: {
    color: Colors.foreground,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.medium,
    fontWeight: "500",
  },

  company: {
    marginTop: 4,
    color: Colors.muted,
    fontSize: 12,
  },

  meta: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },

  metaText: {
    marginLeft: 4,
    color: Colors.muted,
    fontSize: 12,
  },
});
