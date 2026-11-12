import {
  StyleSheet,
  View,
  type DimensionValue,
  type ViewStyle,
} from "react-native";
import type { ReactNode } from "react";
import { Colors } from "../../constants/theme";

export function SkeletonGroup({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function Skeleton({
  width = "100%",
  height = 12,
  radius = 4,
  circle = false,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  circle?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius: circle ? height / 2 : radius,
          opacity: 0.7,
        },
        style,
      ]}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}

export function JobSkeletonCard() {
  return (
    <View style={styles.jobCard}>
      <Skeleton width={52} height={52} radius={8} />

      <View style={styles.jobBody}>
        <Skeleton width="82%" height={13} />
        <Skeleton width="52%" height={10} style={styles.lineGap} />

        <View style={styles.metaRow}>
          <Skeleton width={14} height={14} circle />
          <Skeleton width="48%" height={9} />
        </View>

        <View style={styles.chipRow}>
          <Skeleton width={78} height={24} radius={6} />
          <Skeleton width={64} height={24} radius={6} />
        </View>
      </View>
    </View>
  );
}

export function JobListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <SkeletonGroup>
      <View>
        {Array.from({ length: count }, (_, index) => (
          <JobSkeletonCard key={index} />
        ))}
      </View>
    </SkeletonGroup>
  );
}

export function JobDetailSkeleton() {
  return (
    <SkeletonGroup>
      <View style={styles.detail}>
        <Skeleton width={72} height={72} radius={8} />
        <Skeleton width="88%" height={22} style={styles.detailTitle} />
        <Skeleton width="52%" height={12} />
        <Skeleton
          width="100%"
          height={78}
          radius={8}
          style={styles.detailBlock}
        />
        <Skeleton width="42%" height={16} />
        <Skeleton width="100%" height={11} style={styles.detailLine} />
        <Skeleton width="94%" height={11} />
        <Skeleton width="86%" height={11} style={styles.detailLine} />
        <Skeleton
          width="100%"
          height={52}
          radius={8}
          style={styles.detailCta}
        />
      </View>
    </SkeletonGroup>
  );
}

export function ProfileSkeleton() {
  return (
    <SkeletonGroup>
      <View style={styles.profile}>
        <View style={styles.profileRow}>
          <Skeleton width={48} height={48} circle />
          <View style={styles.profileCopy}>
            <Skeleton width="56%" height={13} />
            <Skeleton width="74%" height={10} style={styles.lineGap} />
          </View>
        </View>

        <Skeleton
          width="100%"
          height={96}
          radius={8}
          style={styles.profileBlock}
        />
        <Skeleton
          width="100%"
          height={132}
          radius={8}
          style={styles.profileBlock}
        />
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.secondary,
  },
  jobCard: {
    minHeight: 112,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  jobBody: {
    flex: 1,
    marginLeft: 12,
  },
  lineGap: {
    marginTop: 8,
  },
  metaRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  chipRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  detail: {
    padding: 20,
  },
  detailTitle: {
    marginTop: 20,
    marginBottom: 8,
  },
  detailBlock: {
    marginTop: 20,
    marginBottom: 24,
  },
  detailLine: {
    marginTop: 8,
  },
  detailCta: {
    marginTop: 28,
  },
  profile: {
    padding: 16,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileCopy: {
    flex: 1,
    marginLeft: 12,
  },
  profileBlock: {
    marginTop: 16,
  },
});
