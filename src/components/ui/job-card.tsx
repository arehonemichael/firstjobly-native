import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import {
  AppText as Text,
  AppTouchableOpacity as TouchableOpacity,
} from "./primitives";
import { Icon as Ionicons } from "./icon";
import { JobMetadata } from "./job-metadata";
import { Colors, Fonts } from "../../constants/theme";
import { categoryLabel, daysUntil } from "../../lib/job-filters";
import type { Job } from "../../lib/jobs";
export const JobCard = memo(function JobCard({
  job,
  onPress,
}: {
  job: Job;
  onPress: () => void;
}) {
  const location = job.city ? `${job.city}, ${job.province}` : job.province;

  const closing = daysUntil(job.closing_date);

  return (
    <TouchableOpacity
      accessibilityLabel={`View job: ${job.title} at ${job.company_name}`}
      style={styles.card}
      activeOpacity={0.75}
      onPress={onPress}
    >
      {job.company_logo_url ? (
        <ExpoImage
          source={{ uri: job.company_logo_url }}
          style={styles.logo}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={100}
        />
      ) : (
        <View style={styles.logo}>
          <Text style={styles.logoText}>
            {job.company_name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.jobInfo}>
        <View style={styles.titleRow}>
          <Text style={styles.jobTitle}>{job.title}</Text>

          {job.is_urgent && (
            <View style={styles.urgent}>
              <Text style={styles.urgentText}>Urgent</Text>
            </View>
          )}
        </View>

        <Text style={styles.company}>{job.company_name}</Text>

        <View style={styles.meta}>
          <Ionicons name="location-outline" size={18} color={Colors.muted} />

          <Text style={styles.metaText} numberOfLines={1}>
            {location}
          </Text>
        </View>

        <JobMetadata job={job} />
        <View style={styles.cardFooter}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {categoryLabel(job.category)}
            </Text>
          </View>

          {closing !== null && closing >= 0 && (
            <Text style={[styles.closing, closing <= 7 && styles.closingSoon]}>
              {closing === 0 ? "Closes today" : `${closing} days left`}
            </Text>
          )}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={Colors.mutedSubtle} />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 16,
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
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 20,
  },

  jobInfo: {
    flex: 1,
    marginHorizontal: 12,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },

  jobTitle: {
    flex: 1,
    color: Colors.foreground,
    fontSize: 14,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    lineHeight: 20,
  },

  company: {
    marginTop: 4,
    color: Colors.muted,
    fontSize: 12,
  },

  meta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  metaText: {
    color: Colors.muted,
    fontSize: 12,
    marginLeft: 4,
    flex: 1,
  },

  cardFooter: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  categoryBadge: {
    backgroundColor: Colors.secondary,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  categoryText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    color: Colors.muted,
  },

  urgent: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  urgentText: {
    color: Colors.primaryPressed,
    fontSize: 12,
    fontFamily: Fonts.medium,
    fontWeight: "500",
  },

  closing: {
    color: Colors.muted,
    fontSize: 12,
  },

  closingSoon: {
    color: Colors.primaryPressed,
    fontFamily: Fonts.medium,
    fontWeight: "500",
  },
});
