import { View } from "react-native";
import { Flame } from "lucide-react-native";
import { AppText as Text } from "./primitives";
import { Colors, Fonts } from "../../constants/theme";
import { useHotJobs } from "../../hooks/use-hot-jobs";
import { hotJobOpen } from "../../lib/hot-jobs/service";
import type { Job } from "../../lib/jobs";
export function HotJobBadge({ job }: { job: Job }) {
  const { jobs, asOf } = useHotJobs();
  const hot = jobs.find((item) => item.id === job.id);
  if (!hot || !hotJobOpen({ ...hot, ...job }, asOf)) return null;
  return (
    <View
      accessibilityLabel="Trending: Apply activity, not confirmed applications"
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 5,
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: Colors.primarySoft,
        borderRadius: 8,
      }}
    >
      <Flame size={14} color={Colors.primaryPressed} aria-hidden />
      <Text
        style={{
          color: Colors.primaryPressed,
          fontFamily: Fonts.semibold,
          fontSize: 11,
          lineHeight: 18,
        }}
      >
        Trending · Apply activity
      </Text>
    </View>
  );
}
