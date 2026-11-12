import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { AppText as Text, AppPressable as Pressable } from "../ui/primitives";
import { Colors, Fonts, Radius } from "../../constants/theme";
import { categoryLabel } from "../../lib/job-filters";
import type {
  DismissReason,
  RankedJob,
  Reason,
} from "../../lib/recommendations/contracts";

export function explanation(reason: Reason): string {
  switch (reason.code) {
    case "saved_search":
      return "Matches one of your saved job alerts";
    case "interest":
      return `Matches your interest in ${categoryLabel(reason.value ?? "")}`;
    case "province":
      return `Matches your search province: ${reason.value}`;
    case "city":
      return `Located in your preferred city: ${reason.value}`;
    case "employment":
      return `Matches your preferred employment type: ${reason.value}`;
    case "experience":
      return `Matches your selected experience level: ${reason.value}`;
    case "skill":
      return `The listing mentions your skill: ${reason.value}`;
    case "education":
      return "Your profile matches the listed education level";
    case "remote":
      return "This listing is explicitly marked remote";
    case "no_experience_listed":
      return "No experience required, according to this listing";
    case "saved_activity":
      return "Similar to opportunities you saved";
    case "application_activity":
      return "Similar to confirmed FirstJobly applications";
    case "feedback_activity":
      return "Similar to jobs you asked to see more of on this device";
    case "view_activity":
      return "Related to opportunities you explored";
    case "fresh":
      return "Listed among the latest available opportunities";
    case "discovery":
      return "A discovery option outside your strongest preferences";
  }
}
const reasons: { key: DismissReason; label: string }[] = [
  { key: "not_relevant", label: "Not relevant" },
  { key: "location", label: "Location" },
  { key: "requirements", label: "Requirements" },
  { key: "already_seen", label: "Already seen" },
  { key: "other", label: "Other" },
];
export function JobFeedback({
  row,
  userId,
  onFeedback,
}: {
  row: RankedJob;
  userId: string | null;
  onFeedback: (
    row: RankedJob,
    kind: "more_like_this" | "dismissed",
    reason?: DismissReason,
  ) => Promise<void>;
}) {
  const [open, setOpen] = useState<"why" | "dismiss" | null>(null),
    [reason, setReason] = useState<DismissReason | undefined>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [liked, setLiked] = useState(false);
  async function send(kind: "more_like_this" | "dismissed") {
    setBusy(true);
    setError(null);
    try {
      await onFeedback(row, kind, reason);
      if (kind === "more_like_this") setLiked(true);
      setOpen(null);
    } catch {
      setError("Could not save feedback. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel={`Why this job: ${row.job.title}`}
          onPress={() => setOpen("why")}
        >
          <Text style={styles.link}>Why this job?</Text>
        </Pressable>
        {!!userId && (
          <>
            <Pressable
              accessibilityLabel={`More like this: ${row.job.title}`}
              disabled={busy}
              onPress={() => void send("more_like_this")}
            >
              <Text style={styles.link}>
                {liked ? "Preference saved" : "More like this"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel={`Not interested: ${row.job.title}`}
              onPress={() => {
                setReason(undefined);
                setOpen("dismiss");
              }}
            >
              <Text style={styles.muted}>Not interested</Text>
            </Pressable>
          </>
        )}
      </View>
      {error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <Modal
        visible={!!open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(null)}
      >
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={styles.title}>
              {open === "why" ? "Why this job?" : "Not interested"}
            </Text>
            <Text style={styles.subtitle}>{row.job.title}</Text>
            {open === "why" ? (
              <>
                {row.ranking.reasons.length ? (
                  row.ranking.reasons.map((r, i) => (
                    <Text key={`${r.code}-${i}`} style={styles.body}>
                      {explanation(r)}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.body}>
                    A recent opportunity available to browse
                  </Text>
                )}
                {row.ranking.eligibility.evidence.filter(
                  (e) => e.state === "unknown",
                ).length > 0 && (
                  <Text style={styles.body}>
                    Some requirement information is missing from your profile
                  </Text>
                )}
                <Text style={styles.note}>
                  Review all listed requirements before applying. Relevance does
                  not confirm eligibility or predict selection.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.body}>
                  Hide this opportunity on this device. A reason is optional.
                </Text>
                {reasons.map((r) => (
                  <Pressable
                    key={r.key}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: reason === r.key }}
                    style={[styles.option, reason === r.key && styles.selected]}
                    onPress={() =>
                      setReason((v) => (v === r.key ? undefined : r.key))
                    }
                  >
                    <Text>
                      {reason === r.key ? "✓ " : ""}
                      {r.label}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  style={styles.primary}
                  disabled={busy}
                  onPress={() => void send("dismissed")}
                >
                  {busy ? (
                    <ActivityIndicator color={Colors.surface} />
                  ) : (
                    <Text style={styles.primaryText}>Hide opportunity</Text>
                  )}
                </Pressable>
              </>
            )}
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            <Pressable
              accessibilityLabel="Close job explanation"
              onPress={() => setOpen(null)}
            >
              <Text style={styles.link}>Close</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", columnGap: 16, paddingTop: 8 },
  link: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    color: Colors.primaryPressed,
  },
  muted: { fontSize: 12, color: Colors.muted },
  error: { fontSize: 12, color: Colors.error, paddingVertical: 8 },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(6,26,48,0.35)",
  },
  sheet: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "90%",
    alignSelf: "center",
    flexGrow: 0,
    padding: 24,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  title: { fontFamily: Fonts.editorial, fontSize: 24 },
  subtitle: { color: Colors.muted, marginVertical: 12 },
  body: { fontSize: 14, lineHeight: 22, marginVertical: 8 },
  note: { fontSize: 12, lineHeight: 20, color: Colors.muted, marginTop: 16 },
  option: { padding: 12, borderRadius: Radius.sm, marginTop: 4 },
  selected: { backgroundColor: Colors.primarySoft },
  primary: {
    marginVertical: 16,
    backgroundColor: Colors.primary,
    padding: 12,
    alignItems: "center",
    borderRadius: Radius.sm,
  },
  primaryText: { color: Colors.surface },
});
