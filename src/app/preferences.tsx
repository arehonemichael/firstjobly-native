import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  AppText as Text,
  AppPressable as Pressable,
  AppTextInput as TextInput,
} from "../components/ui/primitives";
import {
  MultiSelectField,
  SingleSelectField,
} from "../components/profile/structured-fields";
import { CATEGORIES, PROVINCES, EXPERIENCE_LEVELS } from "../lib/job-filters";
import {
  EMPTY_PREFERENCES,
  type Preferences,
} from "../lib/recommendations/contracts";
import {
  getRecommendationPreferences,
  saveRecommendationPreferences,
  resetRecommendationLearning,
} from "../lib/recommendations/api";
import { useAuth } from "../hooks/use-auth";
import { Colors, Fonts, Radius } from "../constants/theme";
const csv = (value: string) =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
export default function PreferencesScreen() {
  const { userId, loading: authLoading } = useAuth();
  const [state, setState] = useState<{
    owner: string | null;
    value: Preferences;
  }>({ owner: null, value: EMPTY_PREFERENCES });
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null),
    [confirmReset, setConfirmReset] = useState(false);
  const value = state.owner === userId ? state.value : EMPTY_PREFERENCES;
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (authLoading) return;
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      void getRecommendationPreferences()
        .then((result) => {
          if (active) {
            setState({ owner: userId, value: result.preferences });
            setError(null);
          }
        })
        .catch(() => {
          if (active)
            setError(
              "Could not load preferences. Please retry before making changes.",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [userId, authLoading]),
  );
  function patch(p: Partial<Preferences>) {
    setState({ owner: userId, value: { ...value, ...p } });
    setNotice(null);
  }
  const errorMessage = (e: unknown, fallback: string) =>
    e &&
    typeof e === "object" &&
    "message" in e &&
    String(e.message).includes("maintenance")
      ? String(e.message)
      : fallback;
  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveRecommendationPreferences(value);
      setNotice("Job preferences saved");
    } catch (e) {
      setError(errorMessage(e, "Could not save preferences. Please retry."));
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    setBusy(true);
    try {
      await resetRecommendationLearning();
      setConfirmReset(false);
      setNotice(
        "Learned preferences reset on this device. Saved jobs, applications and explicit preferences are unchanged.",
      );
    } catch {
      setError("Could not reset learning. Please retry.");
    } finally {
      setBusy(false);
    }
  }
  const categoryLabels = (ids: string[]) =>
    ids
      .map((id) => CATEGORIES.find((c) => c.key === id)?.label ?? id)
      .join(", ");
  const categoryIds = (labels: string) =>
    csv(labels).map(
      (label) => CATEGORIES.find((c) => c.label === label)?.key ?? label,
    );
  if (authLoading || loading)
    return (
      <SafeAreaView style={styles.page}>
        <ActivityIndicator
          accessibilityLabel="Loading job preferences"
          color={Colors.primary}
        />
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable accessibilityLabel="Go back" onPress={() => router.back()}>
          <Text style={styles.link}>Back</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          Job preferences
        </Text>
        {!userId ? (
          <>
            <Text>
              Sign in to save job preferences to your profile. Extra feed
              controls and feedback stay on this device, separately for each
              account.
            </Text>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/auth",
                  params: { returnTo: "/preferences" },
                })
              }
            >
              <Text style={styles.link}>Sign in</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.body}>
              Your interests, employment types, preferred province and city sync
              with your existing profile. Extra controls, feedback and learning
              settings below apply only on this device. Choose what matters to
              your search. You can skip setup and browse immediately. Profile
              skills and listed qualifications are reused; we do not use your
              name, photo, age or protected characteristics.
            </Text>
            <MultiSelectField
              label="Job interests"
              value={categoryLabels(value.categories)}
              options={CATEGORIES.map((c) => c.label)}
              onChange={(v) => patch({ categories: categoryIds(v) })}
            />
            <SingleSelectField
              label="Preferred province"
              value={value.provinces[0] ?? "Use profile province"}
              options={["Use profile province", ...PROVINCES]}
              onChange={(v) =>
                patch({ provinces: v === "Use profile province" ? [] : [v] })
              }
            />
            <Text style={styles.label}>Preferred city</Text>
            <TextInput
              accessibilityLabel="Preferred city"
              defaultValue={value.cities[0] ?? ""}
              onChangeText={(v) =>
                patch({ cities: v.trim() ? [v.trim()] : [] })
              }
              style={styles.input}
            />
            <MultiSelectField
              label="Employment types"
              value={value.employmentTypes.join(", ")}
              options={[
                "permanent",
                "contract",
                "part_time",
                "full_time",
                "temporary",
              ]}
              onChange={(v) => patch({ employmentTypes: csv(v) })}
            />
            <MultiSelectField
              label="Desired experience levels"
              value={value.experienceLevels.join(", ")}
              options={EXPERIENCE_LEVELS}
              onChange={(v) => patch({ experienceLevels: csv(v) })}
            />
            <View style={styles.toggle}>
              <Text style={styles.grow}>Only explicitly remote listings</Text>
              <Switch
                accessibilityLabel="Only explicitly remote listings"
                value={value.remoteOnly}
                onValueChange={(v) => patch({ remoteOnly: v })}
              />
            </View>
            <MultiSelectField
              label="Exclude opportunity types"
              value={categoryLabels(value.excludedCategories)}
              options={CATEGORIES.map((c) => c.label)}
              onChange={(v) => patch({ excludedCategories: categoryIds(v) })}
            />
            <Text style={styles.label}>
              Exclude employers (exact names, comma separated)
            </Text>
            <TextInput
              accessibilityLabel="Excluded employers"
              defaultValue={value.excludedEmployers.join(", ")}
              onChangeText={(v) => patch({ excludedEmployers: csv(v) })}
              style={styles.input}
            />
            <View style={styles.toggle}>
              <Text style={styles.grow}>
                Learn from my job activity on this device
              </Text>
              <Switch
                accessibilityLabel="Learn from my job activity on this device"
                value={value.learningEnabled}
                onValueChange={(v) => patch({ learningEnabled: v })}
              />
            </View>
            <Text style={styles.body}>
              Learning uses capped, deduplicated opens, saves, confirmed
              applications and feedback. Older inferred activity loses weight.
              Unsaving does not mean you dislike a category.
            </Text>
            {error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            {notice && (
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                {notice}
              </Text>
            )}
            <Pressable
              disabled={busy || state.owner !== userId}
              style={styles.primary}
              onPress={() => void save()}
            >
              <Text style={styles.primaryText}>
                {busy ? "Saving…" : "Save preferences"}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.link}>Skip and browse</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmReset((v) => !v)}>
              <Text style={styles.link}>Reset device learning</Text>
            </Pressable>
            {confirmReset && (
              <View style={styles.reset}>
                <Text style={styles.body}>
                  Clear inferred activity and “More like this” feedback? Saved
                  jobs, applications, dismissals and explicit preferences stay.
                </Text>
                <Pressable disabled={busy} onPress={() => void reset()}>
                  <Text style={styles.link}>Confirm reset</Text>
                </Pressable>
                <Pressable onPress={() => setConfirmReset(false)}>
                  <Text>Cancel</Text>
                </Pressable>
              </View>
            )}
          </>
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
  title: { fontFamily: Fonts.editorial, fontSize: 28, marginVertical: 16 },
  body: { color: Colors.muted, lineHeight: 22, marginVertical: 12 },
  label: { color: Colors.muted, marginTop: 16, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 16,
  },
  grow: { flex: 1 },
  link: { color: Colors.primaryPressed, fontFamily: Fonts.medium },
  primary: {
    marginVertical: 16,
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    padding: 14,
    alignItems: "center",
  },
  primaryText: { color: Colors.surface },
  error: { color: Colors.error, marginVertical: 12 },
  reset: {
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
  },
});
