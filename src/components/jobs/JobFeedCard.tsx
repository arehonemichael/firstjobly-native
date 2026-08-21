import { memo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { theme } from "../../constants/theme";
import type { Job } from "../../lib/jobs";
import {
  closingJobCountdown,
  formatJobLocation,
  formatJobSalary,
  jobDisplayTags,
  postedJobLabel,
} from "../../lib/job-display";

export const JobFeedCard = memo(function JobFeedCard({
  job,
  onPress,
  statusLabel,
  bookmarkName = "bookmark-outline",
  onBookmark,
}: {
  job: Job;
  onPress: () => void;
  statusLabel?: string;
  bookmarkName?: "bookmark" | "bookmark-outline" | "checkmark-circle-outline";
  onBookmark?: () => void;
}) {
  const salary = formatJobSalary(job);
  const closing = closingJobCountdown(job);
  const tags = jobDisplayTags(job);

  return (
    <TouchableOpacity activeOpacity={0.84} style={styles.card} onPress={onPress}>
      <View style={styles.logo}>
        {job.company_logo_url ? (
          <Image source={{ uri: job.company_logo_url }} style={styles.logoImage} resizeMode="contain" />
        ) : (
          <Text style={styles.logoText}>{job.company_name.charAt(0).toUpperCase()}</Text>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.companyRow}>
          <Text numberOfLines={1} style={styles.company}>{job.company_name}</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{statusLabel ?? (job.is_urgent ? "Hot" : "New")}</Text>
          </View>
          <TouchableOpacity
            style={styles.bookmarkButton}
            activeOpacity={0.7}
            disabled={!onBookmark}
            onPress={(event) => {
              event.stopPropagation();
              onBookmark?.();
            }}
          >
            <Ionicons name={bookmarkName} size={22} color={theme.colors.ink} />
          </TouchableOpacity>
        </View>

        <Text numberOfLines={2} style={styles.title}>{job.title}</Text>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={theme.colors.inkSoft} />
          <Text numberOfLines={2} style={styles.location}>{formatJobLocation(job)}</Text>
        </View>

        <Text numberOfLines={2} style={styles.description}>{job.description}</Text>

        <View style={styles.footer}>
          <View style={styles.tagsRow}>
            {tags.map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text numberOfLines={1} style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>

          <View style={styles.metaStack}>
            <View style={styles.postedPill}>
              <Text style={styles.postedText}>{postedJobLabel(job)}</Text>
            </View>
            {closing ? <Text numberOfLines={1} style={styles.closingText}>{closing}</Text> : null}
            {salary ? <Text numberOfLines={1} style={styles.salaryText}>{salary}</Text> : null}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    minHeight: 170,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: 12,
    flexDirection: "row",
    gap: 12,
    ...theme.shadow.card,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoImage: { width: 46, height: 46 },
  logoText: { color: theme.colors.brand, fontSize: 24, fontWeight: "800" },
  body: { flex: 1, minWidth: 0 },
  companyRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 34,
    gap: 7,
  },
  company: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  statusPill: {
    flexShrink: 0,
    paddingHorizontal: 7,
    height: 23,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.colors.selectedBorder,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: { color: theme.colors.brand, fontSize: 11, fontWeight: "600" },
  bookmarkButton: {
    position: "absolute",
    right: 0,
    top: -1,
    width: 30,
    height: 30,
    alignItems: "flex-end",
    justifyContent: "flex-start",
  },
  title: {
    color: theme.colors.ink,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "600",
    marginTop: 4,
  },
  locationRow: {
    marginTop: 5,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
    paddingRight: 6,
  },
  location: { flex: 1, minWidth: 0, color: theme.colors.inkSoft, fontSize: 11, lineHeight: 15 },
  description: { color: theme.colors.inkSoft, fontSize: 12, lineHeight: 17, marginTop: 10, maxWidth: 330 },
  footer: {
    marginTop: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  tagsRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagPill: {
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  tagText: { color: theme.colors.ink, fontSize: 10, lineHeight: 14, fontWeight: "500" },
  metaStack: { flexShrink: 0, alignItems: "flex-end", gap: 2, maxWidth: 136 },
  postedPill: {
    minHeight: 26,
    paddingHorizontal: 9,
    borderRadius: 8,
    backgroundColor: theme.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  postedText: { color: theme.colors.brand, fontSize: 10, lineHeight: 14, fontWeight: "500" },
  closingText: { flexShrink: 1, color: theme.colors.danger, fontSize: 10, lineHeight: 14, fontWeight: "700", marginTop: 3 },
  salaryText: { flexShrink: 1, color: theme.colors.brand, fontSize: 10, lineHeight: 14, fontWeight: "600", marginTop: 3 },
});
