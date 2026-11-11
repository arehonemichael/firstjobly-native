import {
  AppText as Text,
  AppTouchableOpacity as TouchableOpacity,
} from "../ui/primitives";
import { Colors, Fonts, Radius } from "../../constants/theme";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
  View,
} from "react-native";
import { Icon as Ionicons } from "../ui/icon";
import * as DocumentPicker from "expo-document-picker";

import { supabase } from "../../lib/supabase";

const MAX_BYTES = 5 * 1024 * 1024;

const KINDS = [
  { key: "cv", label: "CV", required: true, hint: "PDF or Word, max 5 MB" },
  {
    key: "matric_certificate",
    label: "Matric certificate",
    required: false,
    hint: "Certified copy",
  },
  {
    key: "academic_transcript",
    label: "Academic transcript",
    required: false,
    hint: "Latest results",
  },
  {
    key: "qualification_certificate",
    label: "Qualification certificate",
    required: false,
    hint: "Diploma or degree certificate",
  },
  {
    key: "cover_letter",
    label: "Cover letter",
    required: false,
    hint: "Optional",
  },
] as const;

type Kind = (typeof KINDS)[number]["key"];

type UserDocument = {
  id: string;
  user_id: string;
  kind: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
};

const allowedExtensions = ["pdf", "doc", "docx", "jpg", "jpeg", "png"];

export function DocumentsSection({
  userId,
  onChanged,
}: {
  userId: string;
  onChanged?: (kinds: string[]) => void;
}) {
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKind, setBusyKind] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("user_documents")
      .select("*")
      .eq("user_id", userId);

    setLoading(false);

    if (error) {
      console.error("Could not load documents:", error);
      return;
    }

    const rows = (data ?? []) as UserDocument[];
    setDocuments(rows);
    onChanged?.(rows.map((row) => row.kind));
  }, [userId, onChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  async function choose(kind: Kind) {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/png",
      ],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    const ext = asset.name.split(".").pop()?.toLowerCase() ?? "";

    if (!allowedExtensions.includes(ext)) {
      Alert.alert(
        "Unsupported file",
        "Please upload a PDF, Word document, JPG or PNG.",
      );
      return;
    }

    if (!asset.size || asset.size <= 0) {
      Alert.alert("Invalid file", "That file looks empty.");
      return;
    }

    if (asset.size > MAX_BYTES) {
      Alert.alert("File too large", "Please choose a file smaller than 5 MB.");
      return;
    }

    setBusyKind(kind);

    try {
      const existing = documents.find((doc) => doc.kind === kind);
      const path = `${userId}/${kind}-${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, arrayBuffer, {
          contentType: asset.mimeType ?? "application/octet-stream",
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { error: rowError } = await supabase.from("user_documents").upsert(
        {
          user_id: userId,
          kind,
          file_path: path,
          file_name: asset.name.slice(0, 160),
          file_size: asset.size,
        },
        { onConflict: "user_id,kind" },
      );

      if (rowError) {
        await supabase.storage.from("documents").remove([path]);
        throw rowError;
      }

      if (existing) {
        await supabase.storage.from("documents").remove([existing.file_path]);
      }

      await load();
      Alert.alert("Uploaded", "Your document has been saved.");
    } catch (error) {
      console.error("Document upload failed:", error);
      Alert.alert("Upload failed", "Could not upload that document.");
    } finally {
      setBusyKind(null);
    }
  }

  function remove(doc: UserDocument) {
    Alert.alert("Remove document", `Remove ${doc.file_name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setBusyKind(doc.kind);

          const { error } = await supabase
            .from("user_documents")
            .delete()
            .eq("id", doc.id)
            .eq("user_id", userId);

          if (!error) {
            await supabase.storage.from("documents").remove([doc.file_path]);
          }

          setBusyKind(null);

          if (error) {
            Alert.alert("Documents", "Could not remove that document.");
            return;
          }

          await load();
        },
      },
    ]);
  }

  async function open(doc: UserDocument) {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 60);

    if (error || !data?.signedUrl) {
      Alert.alert("Documents", "Could not open that document.");
      return;
    }

    await Linking.openURL(data.signedUrl);
  }

  if (loading) {
    return (
      <ActivityIndicator
        color={Colors.primary}
        style={{ marginVertical: 16 }}
      />
    );
  }

  return (
    <View>
      {KINDS.map((kind) => {
        const doc = documents.find((item) => item.kind === kind.key);
        const busy = busyKind === kind.key;

        return (
          <View key={kind.key} style={styles.row}>
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{kind.label}</Text>

                {kind.required && !doc ? (
                  <Text style={styles.required}>Required</Text>
                ) : null}

                {doc ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={17}
                    color={Colors.primary}
                  />
                ) : null}
              </View>

              <Text style={styles.hint} numberOfLines={1}>
                {doc ? doc.file_name : kind.hint}
              </Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                disabled={busy}
                style={[styles.upload, busy && styles.disabled]}
                onPress={() => void choose(kind.key)}
              >
                {busy ? (
                  <ActivityIndicator
                    color={doc ? Colors.foreground : Colors.surface}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={17}
                      color={doc ? Colors.foreground : Colors.surface}
                    />
                    <Text style={doc ? styles.outlineText : styles.uploadText}>
                      {doc ? "Replace" : "Upload"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {doc ? (
                <>
                  <TouchableOpacity
                    accessibilityLabel="Open action"
                    style={styles.iconButton}
                    onPress={() => void open(doc)}
                  >
                    <Ionicons
                      name="open-outline"
                      size={18}
                      color={Colors.foreground}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    disabled={busy}
                    style={styles.iconButton}
                    onPress={() => remove(doc)}
                  >
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color={Colors.error}
                    />
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>
        );
      })}

      <Text style={styles.private}>
        Your documents are private. They are only shared when you apply for a
        job.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    backgroundColor: Colors.surface,
    marginBottom: 10,
  },
  header: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: {
    color: Colors.foreground,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    fontSize: 14,
  },
  required: {
    color: Colors.error,
    fontSize: 11,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },
  hint: { color: Colors.muted, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: "row", gap: 7, marginTop: 12 },
  upload: {
    flex: 1,
    height: 42,
    backgroundColor: Colors.primary,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  uploadText: {
    color: Colors.surface,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },
  outlineText: {
    color: Colors.foreground,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },
  iconButton: {
    width: 44,
    height: 42,
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.55 },
  private: {
    color: Colors.muted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 3,
  },
});
