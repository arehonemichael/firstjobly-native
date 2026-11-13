import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  AppText as Text,
  AppPressable as Pressable,
} from "../components/ui/primitives";
import { IdentityImage } from "../components/ui/identity-image";
import { JobMetadata } from "../components/ui/job-metadata";
import { RecommendationControls } from "../components/recommendations/controls";
import { JobFeedback } from "../components/recommendations/job-feedback";
import { useAuth } from "../hooks/use-auth";
import { useRecommendations } from "../hooks/use-recommendations";
import type { FeedFilters } from "../lib/recommendations/contracts";
import { Colors, Fonts, Radius } from "../constants/theme";
export default function DiscoverScreen() {
  const { userId, loading } = useAuth();
  const [filters, setFilters] = useState<FeedFilters>({}),
    [feedbackError, setFeedbackError] = useState<string | null>(null);
  const feed = useRecommendations(userId, loading, filters);
  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()}>
          <Text style={styles.link}>Back</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {feed.page?.label ?? "Opportunities"}
        </Text>
        <RecommendationControls
          userId={userId}
          filters={filters}
          onChange={setFilters}
        />
        {!!feed.error && (
          <View>
            <Text accessibilityRole="alert" style={styles.error}>
              {feed.error}
            </Text>
            <Pressable onPress={() => void feed.refresh()}>
              <Text style={styles.link}>Retry recommendations</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/jobs")}>
              <Text style={styles.link}>Browse job search</Text>
            </Pressable>
          </View>
        )}
        {feed.page?.sparse && (
          <Text style={styles.note}>
            Few suitable opportunities are available in this candidate set. Edit
            your preferences or filters to broaden your search.
          </Text>
        )}
        {!!feed.dismissed && (
          <View style={styles.notice}>
            <Text style={styles.grow}>Opportunity hidden</Text>
            <Pressable
              onPress={() =>
                void feed
                  .undo()
                  .catch(() =>
                    setFeedbackError("Could not undo dismissal. Please retry."),
                  )
              }
            >
              <Text style={styles.link}>Undo dismissal</Text>
            </Pressable>
          </View>
        )}
        {feedbackError && (
          <Text accessibilityRole="alert" style={styles.error}>
            {feedbackError}
          </Text>
        )}
        {feed.page?.items.map((row) => (
          <View key={row.job.id} style={styles.card}>
            <Pressable
              accessibilityLabel={`View ${row.job.title}`}
              onPress={() =>
                router.push({
                  pathname: "/jobs/[id]",
                  params: { id: row.job.id },
                })
              }
            >
              <IdentityImage
                uri={row.job.company_logo_url}
                name={row.job.company_name}
                size={40}
              />
              <Text style={styles.jobTitle}>
                {row.job.title || "Role title not provided"}
              </Text>
              <Text style={styles.note}>
                {row.job.company_name || "Company not listed"}
              </Text>
              {!!(row.job.city || row.job.province) && (
                <Text style={styles.note}>
                  {[row.job.city, row.job.province].filter(Boolean).join(", ")}
                </Text>
              )}
              <JobMetadata job={row.job} />
            </Pressable>
            <JobFeedback row={row} userId={userId} onFeedback={feed.feedback} />
          </View>
        ))}
        {feed.loading && (
          <ActivityIndicator
            accessibilityLabel="Loading recommendations"
            color={Colors.primary}
          />
        )}
        {!feed.loading && !feed.page?.items.length && !feed.error && (
          <Text style={styles.note}>
            No suitable opportunities found. Try broader preferences or filters.
          </Text>
        )}
        {!!feed.page?.nextCursor && (
          <Pressable
            disabled={feed.loading}
            onPress={() => void feed.loadMore()}
          >
            <Text style={styles.link}>Load more opportunities</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  content: {
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
    padding: 24,
    paddingBottom: 64,
  },
  title: { fontFamily: Fonts.editorial, fontSize: 24, marginVertical: 16 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 16,
    marginVertical: 8,
  },
  jobTitle: {
    fontFamily: Fonts.medium,
    fontSize: 18,
    lineHeight: 26,
    marginTop: 12,
  },
  note: {
    color: Colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginVertical: 8,
  },
  link: { color: Colors.primaryPressed, fontFamily: Fonts.medium },
  error: { color: Colors.error, lineHeight: 20, marginVertical: 12 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginVertical: 12,
  },
  grow: { flex: 1 },
});
