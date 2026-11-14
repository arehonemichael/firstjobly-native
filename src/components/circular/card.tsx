import { useEarlyJobInterstitial } from "../../ads/useJobInterstitial";
import { View } from "react-native";
import { Heart, MapPin } from "lucide-react-native";
import { router } from "expo-router";
import { AppText as Text, AppPressable as Pressable } from "../ui/primitives";
import { Colors } from "../../constants/theme";
import type { CircularJob } from "../../lib/circular/contract";
import { saDate, salary, titleCase } from "../../lib/circular/contract";
import { cs } from "./shared";
export function CircularCard({
  job,
  onSave,
  busy,
}: {
  job: CircularJob;
  onSave: () => void;
  busy?: boolean;
}) {
  const { openJobWithEarlyInterstitial } = useEarlyJobInterstitial();
  const open = () =>
    void openJobWithEarlyInterstitial(() =>
      router.push({ pathname: "/circular-jobs/[id]", params: { id: job.id } }),
    );
  const urgent =
    job.closes_in_days !== null &&
    job.closes_in_days >= 0 &&
    job.closes_in_days <= 2;
  return (
    <View style={{ position: "relative" }}>
      <Pressable
        accessibilityLabel={`Open ${titleCase(job.post_title)}`}
        onPress={open}
        style={[cs.card, job.is_expired && { opacity: 0.65 }]}
      >
        <View style={{ paddingRight: 42 }}>
          <Text style={cs.heading}>{titleCase(job.post_title)}</Text>
          <Text style={cs.muted}>{job.department}</Text>
        </View>
        <View style={cs.row}>
          <MapPin size={15} color={Colors.muted} />
          <Text style={[cs.muted, { flex: 1 }]}>
            {[job.centre, job.province].filter(Boolean).join(" · ") ||
              "Location not stated"}
          </Text>
        </View>
        <Text style={cs.body}>{salary(job.salary_text)}</Text>
        <View style={cs.row}>
          <Text style={[cs.muted, urgent && { color: Colors.primary }]}>
            {job.is_expired ? "Closed" : `Closes ${saDate(job.closing_date)}`}
          </Text>
          {job.is_closing_soon && !job.is_expired && (
            <Text style={[cs.muted, urgent && { color: Colors.primary }]}>
              {job.closes_in_days === 0
                ? "Closes today"
                : `Closes in ${job.closes_in_days} days`}
            </Text>
          )}
          {job.application_stage === "sent" && (
            <Text style={cs.muted}>Applied</Text>
          )}
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel={`${job.saved ? "Unsave" : "Save"} ${titleCase(job.post_title)}`}
        accessibilityState={{ selected: !!job.saved }}
        disabled={busy}
        onPress={onSave}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Heart
          size={22}
          color={Colors.muted}
          fill={job.saved ? Colors.muted : "none"}
        />
      </Pressable>
    </View>
  );
}
