import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Check, EyeOff } from "lucide-react-native";
import { InstitutionPicker } from "../../components/graduateroom/institution-picker";

import {
  POST_TYPES,
  graduateRoomApi,
  type PostType,
} from "../../lib/graduateroom";

export default function NewGraduateRoomPost() {
  const [postType, setPostType] = useState<PostType>("question");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [institution, setInstitution] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const valid = title.trim().length >= 5 && body.trim().length >= 20;

  async function publish() {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await graduateRoomApi<{ id: string }>("create-post", {
        title: title.trim(),
        body: body.trim(),
        postType,
        institution: institution.trim(),
        isAnonymous: anonymous,
      });
      router.replace({
        pathname: "/graduateroom/[postId]",
        params: { postId: result.id },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={s.page} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable style={s.icon44} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#061A30" />
        </Pressable>
        <Text style={s.headerTitle}>New discussion</Text>
        <View style={s.icon44} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.label}>Discussion type</Text>
        <View style={s.typeGrid}>
          {POST_TYPES.map((type) => (
            <Pressable
              key={type.value}
              style={[
                s.typeOption,
                postType === type.value && s.typeOptionActive,
              ]}
              onPress={() => setPostType(type.value)}
            >
              <Text
                style={[
                  s.typeLabel,
                  postType === type.value && s.typeLabelActive,
                ]}
              >
                {type.label}
              </Text>
              <Text style={s.typeHint}>{type.hint}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={s.label}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          maxLength={140}
          placeholder="What do you want to ask or share?"
          placeholderTextColor="#94A3B8"
          style={s.input}
        />
        <Text style={s.counter}>{title.length}/140</Text>

        <Text style={s.label}>Details</Text>
        <TextInput
          value={body}
          onChangeText={setBody}
          maxLength={5000}
          multiline
          textAlignVertical="top"
          placeholder="Share enough detail for other graduates to help."
          placeholderTextColor="#94A3B8"
          style={[s.input, s.bodyInput]}
        />
        <Text style={s.counter}>{body.length}/5000</Text>

        <Text style={s.label}>Institution (optional)</Text>
        <InstitutionPicker
          value={institution}
          onChange={setInstitution}
          optional
        />

        <Pressable
          style={[s.anonRow, anonymous && s.anonRowActive]}
          onPress={() => setAnonymous((value) => !value)}
        >
          <View style={[s.checkbox, anonymous && s.checkboxActive]}>
            {anonymous ? <Check size={15} color="#FFFFFF" /> : null}
          </View>
          <EyeOff size={19} color="#556274" />
          <View style={{ flex: 1 }}>
            <Text style={s.anonTitle}>Post anonymously</Text>
            <Text style={s.anonText}>
              Your name and institution stay hidden from members. Moderators
              can still trace content if community rules are broken.
            </Text>
          </View>
        </Pressable>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {!valid ? (
          <Text style={s.helper}>
            Add a title of at least 5 characters and details of at least 20
            characters to publish.
          </Text>
        ) : null}

        <Pressable
          style={[s.publish, (!valid || busy) && s.disabled]}
          disabled={!valid || busy}
          onPress={() => void publish()}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={s.publishText}>Publish post</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F6F7F9" },
  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EBF0",
    backgroundColor: "#FFFFFF",
  },
  icon44: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: "#061A30",
    fontSize: 16,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
  },
  content: { padding: 16, paddingBottom: 40 },
  label: {
    color: "#061A30",
    fontSize: 12,
    marginTop: 14,
    marginBottom: 7,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
  },
  typeGrid: { gap: 8 },
  typeOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: "#E8EBF0",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  typeOptionActive: { borderColor: "#E1225F", backgroundColor: "#FDEEF3" },
  typeLabel: {
    color: "#061A30",
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
  },
  typeLabelActive: { color: "#B0164A" },
  typeHint: { color: "#556274", fontSize: 11, lineHeight: 16, marginTop: 2 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 13,
    color: "#061A30",
    fontSize: 13,
  },
  bodyInput: { minHeight: 150, paddingTop: 12 },
  counter: { color: "#94A3B8", fontSize: 10, textAlign: "right", marginTop: 4 },
  anonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 18,
    padding: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EBF0",
    borderRadius: 8,
  },
  anonRowActive: { backgroundColor: "#FDEEF3", borderColor: "#E1225F" },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: { backgroundColor: "#E1225F", borderColor: "#E1225F" },
  anonTitle: { color: "#061A30", fontSize: 13, fontWeight: "700" },
  anonText: { color: "#556274", fontSize: 11, lineHeight: 17, marginTop: 3 },
  error: { color: "#DC2626", fontSize: 12, lineHeight: 18, marginTop: 14 },
  helper: { color: "#556274", fontSize: 11, lineHeight: 17, marginTop: 14 },
  publish: {
    minHeight: 50,
    marginTop: 18,
    borderRadius: 8,
    backgroundColor: "#E1225F",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.45 },
  publishText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});

