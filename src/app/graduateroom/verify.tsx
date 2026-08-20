import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { ArrowLeft, BadgeCheck, FileUp, Mail } from "lucide-react-native";

import { useAuth } from "../../hooks/use-auth";
import { InstitutionPicker } from "../../components/graduateroom/institution-picker";
import { supabase } from "../../lib/supabase";
import {
  VerificationState,
  graduateRoomApi,
} from "../../lib/graduateroom";

export default function GraduateRoomVerify() {
  const { userId } = useAuth();
  const [state, setState] = useState<VerificationState | null>(null);
  const [path, setPath] = useState<"email" | "document">("email");
  const [email, setEmail] = useState("");
  const [institution, setInstitution] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await graduateRoomApi<VerificationState>(
        "verification-state",
      );
      setState(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load verification.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendCode() {
    if (!email.trim()) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await graduateRoomApi<{
        ok: boolean;
        reason?: string;
      }>("send-code", {
        email: email.trim(),
        institutionName: institution.trim(),
      });
      if (!result.ok) {
        setError(
          result.reason === "undeliverable"
            ? "We could not send a code to this email address."
            : result.reason === "email_taken"
              ? "This institution email is already linked to another account."
              : "Could not send the verification code.",
        );
      } else {
        setMessage("Verification code sent. Check your institution email.");
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (code.trim().length < 4) return;
    setBusy(true);
    setError("");
    try {
      const result = await graduateRoomApi<{ ok: boolean; reason?: string }>(
        "confirm-code",
        { code: code.trim() },
      );
      if (!result.ok) {
        setError(
          result.reason === "locked"
            ? "Too many incorrect attempts. Try again later."
            : "That code is incorrect or has expired.",
        );
      } else {
        await load();
        router.replace("/graduateroom");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not confirm code.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadProof() {
    if (!userId) return;

    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png"],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return;

    const file = result.assets[0];
    if (!file) return;
    if ((file.size ?? 0) <= 0 || (file.size ?? 0) > 5 * 1024 * 1024) {
      setError("Choose a PDF or image under 5 MB.");
      return;
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["pdf", "jpg", "jpeg", "png"].includes(ext)) {
      setError("Upload a PDF or an image (.jpg/.png).");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      const storagePath = `${userId}/graduateroom-proof-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(storagePath, blob, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.mimeType ?? undefined,
        });

      if (uploadError) throw uploadError;

      const submit = await graduateRoomApi<{ ok: boolean; reason?: string }>(
        "submit-proof",
        {
          proofPath: storagePath,
          proofFileName: file.name,
          institutionName: institution.trim(),
        },
      );

      if (!submit.ok) {
        setError(
          submit.reason === "already"
            ? "You are already verified."
            : "Could not submit that proof.",
        );
        return;
      }

      setMessage("Proof submitted for review.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  if (state?.status === "verified") {
    return (
      <SafeAreaView style={s.center} edges={["top", "bottom"]}>
        <View style={s.iconBox}>
          <BadgeCheck size={28} color="#16A34A" />
        </View>
        <Text style={s.title}>You're verified</Text>
        <Text style={s.text}>
          Your GraduateRoom access is active
          {state.institutionName ? ` for ${state.institutionName}` : ""}.
        </Text>
        <Pressable
          style={s.primary}
          onPress={() => router.replace("/graduateroom")}
        >
          <Text style={s.primaryText}>Open GraduateRoom</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.page} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable style={s.icon44} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#061A30" />
        </Pressable>
        <Text style={s.headerTitle}>GraduateRoom verification</Text>
        <View style={s.icon44} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.title}>Verify your student or graduate status</Text>
        <Text style={s.text}>
          Use an institution email, or upload proof for manual review. This is
          the same verification used on FirstJobly web.
        </Text>

        {state?.status === "pending" && state.method === "document" ? (
          <View style={s.statusCard}>
            <Text style={s.statusTitle}>Proof under review</Text>
            <Text style={s.statusText}>
              Your document was submitted successfully. You will get access
              after approval.
            </Text>
          </View>
        ) : null}

        {state?.status === "rejected" ? (
          <View style={s.statusCard}>
            <Text style={s.statusTitle}>Verification not approved</Text>
            <Text style={s.statusText}>
              {state.reviewNote || "You can try again with updated details."}
            </Text>
          </View>
        ) : null}

        <View style={s.tabs}>
          <Pressable
            style={[s.tab, path === "email" && s.tabActive]}
            onPress={() => setPath("email")}
          >
            <Mail size={18} color={path === "email" ? "#B0164A" : "#556274"} />
            <Text style={[s.tabText, path === "email" && s.tabTextActive]}>
              Institution email
            </Text>
          </Pressable>
          <Pressable
            style={[s.tab, path === "document" && s.tabActive]}
            onPress={() => setPath("document")}
          >
            <FileUp
              size={18}
              color={path === "document" ? "#B0164A" : "#556274"}
            />
            <Text style={[s.tabText, path === "document" && s.tabTextActive]}>
              Upload proof
            </Text>
          </Pressable>
        </View>

        <Text style={s.label}>Institution</Text>
        <InstitutionPicker
          value={institution}
          onChange={setInstitution}
        />

        {path === "email" ? (
          <>
            <Text style={s.label}>Institution email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="student@university.ac.za"
              placeholderTextColor="#94A3B8"
              style={s.input}
            />

            <Pressable
              style={[s.primary, (!email.trim() || busy) && s.disabled]}
              disabled={!email.trim() || busy}
              onPress={() => void sendCode()}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={s.primaryText}>Send verification code</Text>
              )}
            </Pressable>

            {state?.codePending || message.includes("code sent") ? (
              <>
                <Text style={s.label}>Verification code</Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  maxLength={8}
                  placeholder="Enter code"
                  placeholderTextColor="#94A3B8"
                  style={s.input}
                />
                <Pressable
                  style={[
                    s.secondaryButton,
                    (code.trim().length < 4 || busy) && s.disabled,
                  ]}
                  disabled={code.trim().length < 4 || busy}
                  onPress={() => void confirm()}
                >
                  <Text style={s.secondaryText}>Confirm code</Text>
                </Pressable>
              </>
            ) : null}
          </>
        ) : (
          <>
            <Text style={s.uploadHelp}>
              Upload a PDF, JPG or PNG showing your student or graduate status.
              Maximum file size: 5 MB.
            </Text>
            <Pressable
              style={[s.primary, busy && s.disabled]}
              disabled={busy}
              onPress={() => void uploadProof()}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={s.primaryText}>Choose proof document</Text>
              )}
            </Pressable>
          </>
        )}

        {message ? <Text style={s.success}>{message}</Text> : null}
        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F6F7F9" },
  center: {
    flex: 1,
    backgroundColor: "#F6F7F9",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EBF0",
  },
  icon44: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#061A30",
    fontSize: 15,
    fontWeight: "700",
  },
  content: { padding: 16, paddingBottom: 40 },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#061A30", fontSize: 21, lineHeight: 28, fontWeight: "800" },
  text: { color: "#556274", fontSize: 13, lineHeight: 20, marginTop: 6 },
  statusCard: {
    marginTop: 16,
    padding: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EBF0",
    borderRadius: 8,
  },
  statusTitle: { color: "#061A30", fontSize: 13, fontWeight: "700" },
  statusText: { color: "#556274", fontSize: 11, lineHeight: 17, marginTop: 3 },
  tabs: { flexDirection: "row", gap: 8, marginTop: 20 },
  tab: {
    flex: 1,
    minHeight: 52,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E8EBF0",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  tabActive: { backgroundColor: "#FDEEF3", borderColor: "#E1225F" },
  tabText: { color: "#556274", fontSize: 11, fontWeight: "600" },
  tabTextActive: { color: "#B0164A" },
  label: {
    color: "#061A30",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 16,
    marginBottom: 7,
  },
  input: {
    minHeight: 48,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFE4EC",
    borderRadius: 8,
    paddingHorizontal: 13,
    color: "#061A30",
    fontSize: 13,
  },
  uploadHelp: { color: "#556274", fontSize: 12, lineHeight: 18, marginTop: 16 },
  primary: {
    minHeight: 49,
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: "#E1225F",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  secondaryButton: {
    minHeight: 48,
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DFE4EC",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: "#061A30", fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  success: { color: "#16A34A", fontSize: 12, lineHeight: 18, marginTop: 14 },
  error: { color: "#DC2626", fontSize: 12, lineHeight: 18, marginTop: 14 },
});

