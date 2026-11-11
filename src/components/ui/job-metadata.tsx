import { View, StyleSheet } from "react-native";
import { AppText as Text } from "./primitives";
import { Colors, Fonts } from "../../constants/theme";
import type { Job } from "../../lib/jobs";

const currency = (value: number) => `R${value.toLocaleString("en-ZA")}`;
export function JobMetadata({ job }: { job: Job }) {
  const min = job.salary_min;
  const max = job.salary_max;
  const salary =
    min != null && max != null
      ? `${currency(min)} – ${currency(max)}`
      : min != null
        ? `From ${currency(min)}`
        : max != null
          ? `Up to ${currency(max)}`
          : null;
  const posted = new Date(job.posted_at);
  return (
    <View style={styles.row}>
      {salary && (
        <Text style={styles.salary}>
          {salary}
          {job.salary_period ? ` / ${job.salary_period}` : ""}
        </Text>
      )}
      {job.job_type && (
        <Text style={styles.meta}>{job.job_type.replace(/_/g, " ")}</Text>
      )}
      {!Number.isNaN(posted.getTime()) && (
        <Text style={styles.meta}>
          Posted{" "}
          {posted.toLocaleDateString("en-ZA", {
            day: "numeric",
            month: "short",
          })}
        </Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  salary: {
    color: Colors.foreground,
    fontFamily: Fonts.semibold,
    fontSize: 12,
    lineHeight: 18,
  },
  meta: { color: Colors.muted, fontSize: 12, lineHeight: 18 },
});
