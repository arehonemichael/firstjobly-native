import { StyleSheet, View } from "react-native";
import { Skeleton } from "../ui/skeleton";
import { Colors, Radius } from "../../constants/theme";
/** Match the measured Home card footprint, including its metadata/action area. */
export function RecommendationSkeleton({
  featured = false,
}: {
  featured?: boolean;
}) {
  return (
    <View
      accessibilityLabel="Loading opportunity"
      style={[styles.card, { minHeight: featured ? 290 : 286 }]}
    >
      <View
        style={[
          styles.top,
          featured && { backgroundColor: Colors.primarySoft },
        ]}
      >
        <Skeleton width={36} height={36} radius={8} />
        <Skeleton width="45%" height={12} style={{ marginTop: 8 }} />
        <Skeleton width="82%" height={22} style={{ marginTop: 8 }} />
      </View>
      <View style={styles.bottom}>
        <Skeleton width="55%" height={12} />
        <Skeleton width="70%" height={16} style={{ marginTop: 12 }} />
        <View style={styles.actions}>
          <Skeleton width={110} height={32} />
          <Skeleton width={36} height={36} radius={18} />
        </View>
        <Skeleton width="60%" height={12} style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    overflow: "hidden",
  },
  top: { padding: 16, backgroundColor: Colors.secondary },
  bottom: { padding: 16 },
  actions: {
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
});
