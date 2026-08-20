import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../../lib/supabase";

type WorkExperience = {
  id: string;
  user_id: string;
  company: string;
  job_title: string;
  start_date: string | null;
  end_date: string | null;
  currently_working: boolean;
  description: string | null;
};

type Draft = {
  company: string;
  job_title: string;
  start_date: string;
  end_date: string;
  currently_working: boolean;
  description: string;
};

const EMPTY: Draft = {
  company: "",
  job_title: "",
  start_date: "",
  end_date: "",
  currently_working: false,
  description: "",
};

export function WorkExperienceSection({
  userId,
  onChanged,
}: {
  userId: string;
  onChanged?: (count: number) => void;
}) {
  const [entries, setEntries] = useState<WorkExperience[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("work_experience")
      .select("*")
      .eq("user_id", userId)
      .order("start_date", { ascending: false, nullsFirst: false });

    setLoading(false);

    if (error) {
      console.error("Could not load work experience:", error);
      return;
    }

    const rows = (data ?? []) as WorkExperience[];
    setEntries(rows);
    onChanged?.(rows.length);
  }, [userId, onChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!draft || !draft.company.trim() || !draft.job_title.trim()) return;

    setSaving(true);

    const payload = {
      user_id: userId,
      company: draft.company.trim().slice(0, 120),
      job_title: draft.job_title.trim().slice(0, 120),
      start_date: draft.start_date || null,
      end_date: draft.currently_working ? null : draft.end_date || null,
      currently_working: draft.currently_working,
      description: draft.description.trim().slice(0, 600) || null,
    };

    const { error } = editingId
      ? await supabase
          .from("work_experience")
          .update(payload)
          .eq("id", editingId)
          .eq("user_id", userId)
      : await supabase.from("work_experience").insert(payload);

    setSaving(false);

    if (error) {
      Alert.alert("Work experience", "Could not save that experience.");
      return;
    }

    setDraft(null);
    setEditingId(null);
    await load();
  }

  function edit(entry: WorkExperience) {
    setEditingId(entry.id);
    setDraft({
      company: entry.company,
      job_title: entry.job_title,
      start_date: entry.start_date ?? "",
      end_date: entry.end_date ?? "",
      currently_working: entry.currently_working,
      description: entry.description ?? "",
    });
  }

  function remove(entry: WorkExperience) {
    Alert.alert(
      "Remove experience",
      `Remove ${entry.job_title} at ${entry.company}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from("work_experience")
              .delete()
              .eq("id", entry.id)
              .eq("user_id", userId);

            if (error) {
              Alert.alert("Work experience", "Could not remove that experience.");
              return;
            }

            await load();
          },
        },
      ]
    );
  }

  if (loading) {
    return <ActivityIndicator color="#E1225F" style={{ marginVertical: 16 }} />;
  }

  return (
    <View>
      {entries.length === 0 && !draft ? (
        <Text style={styles.empty}>
          No experience yet. Volunteering, holiday work and internships all count.
        </Text>
      ) : null}

      {entries.map((entry) => (
        <View key={entry.id} style={styles.entry}>
          <View style={styles.icon}>
            <Ionicons name="briefcase-outline" size={18} color="#E1225F" />
          </View>

          <View style={styles.entryBody}>
            <Text style={styles.jobTitle}>{entry.job_title}</Text>
            <Text style={styles.company}>{entry.company}</Text>
            <Text style={styles.date}>
              {entry.start_date ?? "�"} ?{" "}
              {entry.currently_working ? "Present" : entry.end_date ?? "�"}
            </Text>

            {entry.description ? (
              <Text style={styles.description}>{entry.description}</Text>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.outlineButton} onPress={() => edit(entry)}>
                <Text style={styles.outlineText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => remove(entry)}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}

      {draft ? (
        <View style={styles.editor}>
          <Field
            label="Company"
            value={draft.company}
            onChangeText={(company) => setDraft({ ...draft, company })}
          />
          <Field
            label="Job title"
            value={draft.job_title}
            onChangeText={(job_title) => setDraft({ ...draft, job_title })}
          />
          <Field
            label="Start date"
            placeholder="YYYY-MM-DD"
            value={draft.start_date}
            onChangeText={(start_date) => setDraft({ ...draft, start_date })}
          />

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Currently working here</Text>
            <Switch
              value={draft.currently_working}
              onValueChange={(currently_working) =>
                setDraft({ ...draft, currently_working })
              }
              trackColor={{ false: "#DFE4EC", true: "#F6A8C4" }}
              thumbColor={draft.currently_working ? "#E1225F" : "#FFFFFF"}
            />
          </View>

          {!draft.currently_working ? (
            <Field
              label="End date"
              placeholder="YYYY-MM-DD"
              value={draft.end_date}
              onChangeText={(end_date) => setDraft({ ...draft, end_date })}
            />
          ) : null}

          <Field
            label="Short description"
            placeholder="What you did day to day"
            value={draft.description}
            multiline
            onChangeText={(description) => setDraft({ ...draft, description })}
          />

          <View style={styles.editorActions}>
            <TouchableOpacity
              style={[
                styles.saveButton,
                (!draft.company.trim() || !draft.job_title.trim() || saving) &&
                  styles.disabled,
              ]}
              disabled={!draft.company.trim() || !draft.job_title.trim() || saving}
              onPress={() => void save()}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                setDraft(null);
                setEditingId(null);
              }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            setEditingId(null);
            setDraft({ ...EMPTY });
          }}
        >
          <Ionicons name="add" size={18} color="#061A30" />
          <Text style={styles.addText}>Add experience</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function Field({
  label,
  multiline,
  ...props
}: {
  label: string;
  multiline?: boolean;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#94A3B8"
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { color: "#556274", fontSize: 13, lineHeight: 19, marginBottom: 12 },
  entry: {
    flexDirection: "row",
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8EBF0",
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#FDEEF3",
    alignItems: "center",
    justifyContent: "center",
  },
  entryBody: { flex: 1, marginLeft: 11 },
  jobTitle: { color: "#061A30", fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800", fontSize: 14 },
  company: { color: "#556274", fontSize: 13, marginTop: 2 },
  date: { color: "#556274", fontSize: 11, marginTop: 6 },
  description: { color: "#556274", fontSize: 12, lineHeight: 18, marginTop: 7 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  outlineButton: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: { color: "#061A30", fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700" },
  deleteButton: {
    width: 44,
    height: 42,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  editor: {
    borderWidth: 1,
    borderColor: "#E8EBF0",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#FFFFFF",
  },
  field: { marginBottom: 12 },
  label: { color: "#556274", fontSize: 13, fontFamily: "PlusJakartaSans_600SemiBold", fontWeight: "600", marginBottom: 6 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#061A30",
    backgroundColor: "#FFFFFF",
  },
  multiline: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
  toggleRow: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#E8EBF0",
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  toggleLabel: { color: "#556274", fontSize: 13, fontFamily: "PlusJakartaSans_600SemiBold", fontWeight: "600" },
  editorActions: { flexDirection: "row", gap: 8 },
  saveButton: {
    flex: 1,
    height: 46,
    backgroundColor: "#E1225F",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { color: "#FFFFFF", fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800" },
  cancelButton: {
    height: 46,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { color: "#061A30", fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700" },
  disabled: { opacity: 0.55 },
  addButton: {
    height: 48,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  addText: { color: "#061A30", fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700" },
});


