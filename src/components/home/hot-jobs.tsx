import { StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { AppText as Text, AppPressable as Pressable } from "../ui/primitives";
import { JobCard } from "../ui/job-card";
import { Colors, Fonts, Space } from "../../constants/theme";
import { HOT_RULES } from "../../lib/hot-jobs/config";
import { useHotJobs } from "../../hooks/use-hot-jobs";
import type { Job } from "../../lib/jobs";
export function HotJobsSection({ onOpen }: { onOpen(job: Job): void }) {
  const { jobs } = useHotJobs();
  if (jobs.length < HOT_RULES.minimumSectionJobs) return null;
  return (
    <View style={styles.section} testID="hot-jobs-section">
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          Hot right now
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See all trending jobs"
          onPress={() => router.push("/hot-jobs")}
          style={styles.link}
        >
          <Text style={styles.linkText}>See all</Text>
          <ArrowRight size={16} color={Colors.primaryPressed} />
        </Pressable>
      </View>
      <Text style={styles.copy}>
        Popular by unique Apply activity over the last 7 days. Clicks do not
        confirm applications.
      </Text>
      {jobs.slice(0, 3).map((job) => (
        <JobCard key={job.id} job={job} onPress={() => onOpen(job)} />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { marginTop: Space.xl },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    fontFamily: Fonts.semibold,
    fontSize: 24,
    lineHeight: 34,
    color: Colors.navy,
  },
  link: { minHeight: 44, flexDirection: "row", gap: 8, alignItems: "center" },
  linkText: {
    color: Colors.primaryPressed,
    fontFamily: Fonts.semibold,
    fontSize: 13,
  },
  copy: { fontSize: 12, lineHeight: 20, color: Colors.muted },
});
