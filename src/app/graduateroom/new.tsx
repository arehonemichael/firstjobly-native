import {
  AppPressable as Pressable,
  AppText as Text,
  AppTextInput as TextInput,
} from "../../components/ui/primitives";
import { Colors, Fonts, Radius } from "../../constants/theme";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
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
        <Pressable
          accessibilityLabel="Go back"
          style={s.icon44}
          onPress={() => router.back()}
        >
          <ArrowLeft size={22} color={Colors.foreground} />
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
              accessibilityState={{ selected: postType === type.value }}
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
          placeholderTextColor={Colors.mutedSubtle}
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
          placeholderTextColor={Colors.mutedSubtle}
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
            {anonymous ? <Check size={15} color={Colors.surface} /> : null}
          </View>
          <EyeOff size={19} color={Colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={s.anonTitle}>Post anonymously</Text>
            <Text style={s.anonText}>
              Your name and institution stay hidden from members. Moderators can
              still trace content if community rules are broken.
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
            <ActivityIndicator color={Colors.surface} />
          ) : (
            <Text style={s.publishText}>Publish post</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  icon44: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: Colors.foreground,
    fontSize: 16,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },
  content: {
    width: "100%",
    maxWidth: 800,
    alignSelf: "center",
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    color: Colors.foreground,
    fontSize: 12,
    marginTop: 14,
    marginBottom: 7,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },
  typeGrid: { gap: 8 },
  typeOption: {
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  typeOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  typeLabel: {
    color: Colors.foreground,
    fontSize: 13,
    fontFamily: Fonts.bold,
    fontWeight: "700",
  },
  typeLabelActive: { color: Colors.primaryPressed },
  typeHint: { color: Colors.muted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: 13,
    color: Colors.foreground,
    fontSize: 13,
  },
  bodyInput: { minHeight: 150, paddingTop: 12 },
  counter: {
    color: Colors.mutedSubtle,
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
  anonRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 18,
    padding: 13,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
  },
  anonRowActive: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  anonTitle: { color: Colors.foreground, fontSize: 13, fontWeight: "700" },
  anonText: { color: Colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  error: { color: Colors.error, fontSize: 12, lineHeight: 18, marginTop: 14 },
  helper: { color: Colors.muted, fontSize: 11, lineHeight: 17, marginTop: 14 },
  publish: {
    minHeight: 50,
    marginTop: 18,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.45 },
  publishText: { color: Colors.surface, fontSize: 14, fontWeight: "700" },
});
