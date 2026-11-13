import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { router, Stack } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  AppText as Text,
  AppPressable as Pressable,
} from "../components/ui/primitives";
import { JobCard } from "../components/ui/job-card";
import { EmptyState, InlineErrorState } from "../components/ui/app-ui";
import { useHotJobs } from "../hooks/use-hot-jobs";
import { Colors, Fonts, Layout } from "../constants/theme";
import { AdBanner } from "../ads/AdBanner";
import { useEarlyJobInterstitial } from "../ads/useJobInterstitial";
export default function HotJobsScreen() {
  const { jobs, loading, error, reload } = useHotJobs();
  const { openJobWithEarlyInterstitial } = useEarlyJobInterstitial();
  return (
    <SafeAreaView style={styles.page}>
      <Stack.Screen options={{ title: "Hot right now", headerShown: false }} />
      <FlatList
        contentContainerStyle={styles.content}
        data={jobs}
        keyExtractor={(job) => job.id}
        refreshing={loading && !!jobs.length}
        onRefresh={() => void reload()}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
              onPress={() => router.dismissTo("/")}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ color: Colors.primaryPressed }}>Back to Home</Text>
            </Pressable>
            <Text accessibilityRole="header" style={styles.title}>
              Hot right now
            </Text>
            <Text style={styles.copy}>
              Popular by unique Apply activity over the last 7 days. Clicks do
              not confirm applications.
            </Text>
            {error && (
              <InlineErrorState message={error} onRetry={() => void reload()} />
            )}
            {loading && !jobs.length && (
              <ActivityIndicator
                color={Colors.primary}
                accessibilityLabel="Loading trending opportunities"
              />
            )}
          </View>
        }
        renderItem={({ item }) => (
          <JobCard
            job={item}
            onPress={() =>
              void openJobWithEarlyInterstitial(() =>
                router.push({
                  pathname: "/jobs/[id]",
                  params: { id: item.id },
                }),
              )
            }
          />
        )}
        ListFooterComponent={<AdBanner placement="hot" />}
        ListEmptyComponent={
          !loading && !error ? (
            <EmptyState
              title="No trending opportunities right now"
              message="You can still browse jobs and recommendations."
              actionLabel="Browse all jobs"
              onAction={() => router.push("/jobs")}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  content: {
    width: "100%",
    maxWidth: Layout.reading,
    alignSelf: "center",
    padding: 16,
  },
  title: {
    color: Colors.navy,
    fontFamily: Fonts.semibold,
    fontSize: 26,
    lineHeight: 36,
  },
  copy: { color: Colors.muted, fontSize: 13, lineHeight: 21 },
});
