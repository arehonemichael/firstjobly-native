import { useState } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import {
  AppText as Text,
  AppPressable as Pressable,
  AppTextInput as TextInput,
} from "../ui/primitives";
import { SingleSelectField } from "../profile/structured-fields";
import { CATEGORIES, PROVINCES } from "../../lib/job-filters";
import { Colors, Fonts, Radius } from "../../constants/theme";
import type { FeedFilters } from "../../lib/recommendations/contracts";

export function RecommendationControls({
  userId,
  filters,
  onChange,
}: {
  userId: string | null;
  filters: FeedFilters;
  onChange: (value: FeedFilters) => void;
}) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState<FeedFilters>({});
  return (
    <>
      <View style={styles.row}>
        <Pressable
          onPress={() => {
            setDraft(filters);
            setOpen(true);
          }}
        >
          <Text style={styles.link}>Filter opportunities</Text>
        </Pressable>
        <Pressable
          onPress={() =>
            router.push(
              userId
                ? "/preferences"
                : { pathname: "/auth", params: { returnTo: "/preferences" } },
            )
          }
        >
          <Text style={styles.link}>
            {userId ? "Job preferences" : "Sign in to personalize"}
          </Text>
        </Pressable>
      </View>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={styles.title}>
              Filter opportunities
            </Text>
            <SingleSelectField
              label="Opportunity type"
              value={
                CATEGORIES.find((c) => c.key === draft.category)?.label ??
                "All opportunities"
              }
              options={["All opportunities", ...CATEGORIES.map((c) => c.label)]}
              onChange={(v) =>
                setDraft((s) => ({
                  ...s,
                  category: CATEGORIES.find((c) => c.label === v)?.key,
                }))
              }
            />
            <SingleSelectField
              label="Province"
              value={draft.province ?? "All provinces"}
              options={["All provinces", ...PROVINCES]}
              onChange={(v) =>
                setDraft((s) => ({
                  ...s,
                  province: v === "All provinces" ? undefined : v,
                }))
              }
            />
            <Text style={styles.label}>City or town</Text>
            <TextInput
              accessibilityLabel="City or town"
              value={draft.city ?? ""}
              onChangeText={(city) => setDraft((s) => ({ ...s, city }))}
              style={styles.input}
            />
            <Text style={styles.label}>Role or company</Text>
            <TextInput
              accessibilityLabel="Role or company"
              value={draft.q ?? ""}
              onChangeText={(q) => setDraft((s) => ({ ...s, q }))}
              style={styles.input}
            />
            <Pressable
              style={styles.primary}
              onPress={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              <Text style={styles.primaryText}>Apply filters</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onChange({});
                setOpen(false);
              }}
            >
              <Text style={styles.link}>Clear filters</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Close opportunity filters"
              onPress={() => setOpen(false)}
            >
              <Text>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  link: {
    color: Colors.primaryPressed,
    fontFamily: Fonts.medium,
    fontSize: 13,
  },
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
  title: { fontFamily: Fonts.editorial, fontSize: 24, marginBottom: 16 },
  label: { marginTop: 16, marginBottom: 8, color: Colors.muted },
  input: {
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: Radius.sm,
    paddingHorizontal: 12,
  },
  primary: {
    marginTop: 24,
    padding: 12,
    alignItems: "center",
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
  },
  primaryText: { color: Colors.surface },
});
