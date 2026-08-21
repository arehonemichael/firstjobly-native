import { useCallback, useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../hooks/use-auth";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { EmptyState, SkeletonJobCard } from "../../components/ui/app-ui";
import { JobFeedCard } from "../../components/jobs/JobFeedCard";
import { useSavedJobs } from "../../hooks/use-saved-jobs";
import { openClosingDateFilter } from "../../lib/job-availability";
import { supabase } from "../../lib/supabase";
import type { Job } from "../../lib/jobs";
import { theme } from "../../constants/theme";

export default function SavedScreen() {
  const bottomContentPadding = useScreenBottomPadding(true);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { savedIds, loading: savedLoading, refreshSaved, toggleSave } = useSavedJobs();
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
        .eq("approval_status", "approved")
        .eq("is_active", true)
        .or(openClosingDateFilter());
      if (error) throw error;
      const rows = (data ?? []) as Job[];
      const order = new Map(savedIds.map((id, index) => [id, index]));
      rows.sort((a, b) => (order.get(a.id) ?? 9999) - (order.get(b.id) ?? 9999));
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

  const renderJob = useCallback(
    ({ item }: { item: Job }) => (
      <JobFeedCard
        job={item}
        statusLabel="Saved"
        bookmarkName="bookmark"
        onBookmark={() => void toggleSave(item.id)}
        onPress={() => router.push({ pathname: "/jobs/[id]", params: { id: item.id } })}
      />
    ),
    [toggleSave],
  );

  if (authLoading || savedLoading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
        <View style={styles.loadingShell}>
          <View style={styles.header}>
            <Text style={styles.title}>Saved jobs</Text>
            <Text style={styles.subtitle}>Loading your saved opportunities</Text>
          </View>
          <View style={styles.skeletons}>
            <SkeletonJobCard />
            <SkeletonJobCard />
            <SkeletonJobCard />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
        <View style={styles.signedOutCard}>
          <View style={styles.iconWrap}>
            <Ionicons name="bookmark-outline" size={30} color={theme.colors.brand} />
          </View>
          <Text style={styles.emptyTitle}>Save jobs for later</Text>
          <Text style={styles.emptyText}>Sign in to save opportunities and access them from your FirstJobly account.</Text>
          <TouchableOpacity activeOpacity={0.82} style={styles.primary} onPress={() => router.push("/auth")}>
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
        renderItem={renderJob}
        contentContainerStyle={[styles.list, { paddingBottom: bottomContentPadding }]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshing={savedLoading || loadingJobs}
        onRefresh={() => void refreshSaved()}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Saved jobs</Text>
            <Text style={styles.subtitle}>{jobs.length} saved {jobs.length === 1 ? "opportunity" : "opportunities"}</Text>
          </View>
        }
        ListEmptyComponent={
          loadingJobs ? (
            <View style={styles.skeletons}>
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
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  loadingShell: { flex: 1, paddingHorizontal: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 110 },
  header: { paddingTop: 18, paddingBottom: 18 },
  title: { color: theme.colors.ink, fontSize: 24, lineHeight: 30, fontWeight: "800", letterSpacing: -0.4 },
  subtitle: { marginTop: 4, color: theme.colors.inkSoft, fontSize: 13, lineHeight: 18 },
  separator: { height: 10 },
  skeletons: { gap: 10 },
  signedOutCard: {
    margin: 16,
    padding: 24,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    ...theme.shadow.card,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { marginTop: 18, color: theme.colors.ink, fontSize: 21, lineHeight: 27, fontWeight: "800" },
  emptyText: { maxWidth: 310, marginTop: 8, color: theme.colors.inkSoft, fontSize: 13, lineHeight: 20, textAlign: "center" },
  primary: {
    width: "100%",
    height: 52,
    marginTop: 24,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { color: theme.colors.primaryForeground, fontWeight: "800" },
});
