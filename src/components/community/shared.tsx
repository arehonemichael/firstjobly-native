import type { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";
import { UsersRound } from "lucide-react-native";
import { AppText as Text, AppPressable as Pressable } from "../ui/primitives";
import { Colors, Fonts, Radius, Space, Layout } from "../../constants/theme";
import { useAuth } from "../../hooks/use-auth";
import { useCommunityQuery } from "../../hooks/use-community";
import { CommunityError } from "../../lib/community/transport";
import { SETUP_MESSAGE, type Viewer } from "../../lib/community/contract";
export function Button({
  label,
  onPress,
  disabled,
  primary = false,
  selected = false,
  quiet = false,
}: {
  label: string;
  onPress(): void;
  disabled?: boolean;
  primary?: boolean;
  selected?: boolean;
  quiet?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        quiet && s.quietButton,
        primary && s.primaryButton,
        selected && s.selected,
        pressed && { opacity: 0.75 },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Text
        style={[
          s.buttonText,
          primary && { color: Colors.primaryForeground },
          selected && { fontFamily: Fonts.semibold, color: Colors.primary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <View style={s.notice}>
      <Text accessibilityLiveRegion="polite" style={s.body}>
        {children}
      </Text>
    </View>
  );
}
export function ErrorBox({
  error,
  retry,
}: {
  error: Error | null;
  retry?: () => void;
}) {
  const pathname = usePathname();
  if (!error) return null;
  const signIn =
    error instanceof CommunityError && error.code === "AUTH_REQUIRED";
  return (
    <View style={s.error}>
      <Text accessibilityRole="alert" style={s.body}>
        {error.message}
      </Text>
      {signIn ? (
        <Button
          label="Sign in again"
          onPress={() =>
            router.push({ pathname: "/auth", params: { returnTo: pathname } })
          }
        />
      ) : (
        retry && <Button label="Try again" onPress={retry} />
      )}
    </View>
  );
}
export function CommunityScreen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView edges={["top", "left", "right", "bottom"]} style={s.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function CommunityGate({
  children,
}: {
  children: (viewer: Viewer, owner: string) => ReactNode;
}) {
  const { userId, loading } = useAuth();
  const pathname = usePathname();
  const query = useCommunityQuery<Viewer>(
    "viewer",
    "viewer-state",
    {},
    !!userId,
  );
  if (loading || (userId && query.loading && !query.value))
    return (
      <View style={s.center}>
        <ActivityIndicator
          color={Colors.primary}
          accessibilityLabel="Loading Community access"
        />
      </View>
    );
  if (!userId)
    return (
      <View style={s.center}>
        <UsersRound size={28} color={Colors.primary} />
        <Text style={s.title}>Community</Text>
        <Text style={s.body}>Sign in to connect with other job seekers.</Text>
        <Button
          primary
          label="Sign in"
          onPress={() =>
            router.push({ pathname: "/auth", params: { returnTo: pathname } })
          }
        />
      </View>
    );
  if (
    query.error &&
    !(
      query.error instanceof CommunityError && query.error.code === "NOT_MEMBER"
    )
  )
    return <ErrorBox error={query.error} retry={() => void query.reload()} />;
  if (!query.value && !query.error)
    return (
      <View style={s.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  if (
    !query.value?.member ||
    (query.error instanceof CommunityError && query.error.code === "NOT_MEMBER")
  )
    return (
      <View style={s.center}>
        <Text style={s.title}>Community</Text>
        <Text style={s.body}>{SETUP_MESSAGE}</Text>
        <Button
          primary
          label="Complete my profile"
          onPress={() => router.push("/profile")}
        />
      </View>
    );
  return (
    <View style={{ flex: 1 }}>
      {query.value.banned && (
        <Notice>
          Your Community access is currently suspended. You can still read
          discussions.
        </Notice>
      )}
      {children(query.value, userId)}
    </View>
  );
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  center: {
    padding: 24,
    gap: 16,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  content: {
    padding: Space.xl,
    gap: Space.lg,
    width: "100%",
    maxWidth: Layout.reading,
    alignSelf: "center",
  },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  title: {
    fontFamily: Fonts.semibold,
    color: Colors.navy,
    fontSize: 26,
    lineHeight: 36,
  },
  heading: {
    fontFamily: Fonts.semibold,
    color: Colors.navy,
    fontSize: 18,
    lineHeight: 27,
  },
  body: { fontSize: 14, lineHeight: 23, color: Colors.foreground },
  muted: { fontSize: 12, lineHeight: 20, color: Colors.muted },
  button: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  buttonText: {
    color: Colors.muted,
    fontSize: 13,
    lineHeight: 21,
    fontFamily: Fonts.medium,
    textAlign: "center",
  },
  quietButton: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    paddingHorizontal: Space.sm,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  selected: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  card: {
    padding: 16,
    gap: 12,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: Radius.sm,
    marginBottom: Space.md,
  },
  notice: {
    padding: 12,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primarySoft,
  },
  error: {
    padding: 16,
    gap: 8,
    borderColor: Colors.errorBorder,
    borderWidth: 1,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
  },
  metadata: { fontSize: 12, lineHeight: 20, color: Colors.muted },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.secondary,
    color: Colors.muted,
    fontSize: 12,
    lineHeight: 20,
  },
  field: {
    borderWidth: 1,
    borderColor: Colors.input,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    padding: 12,
    fontSize: 15,
    lineHeight: 24,
    color: Colors.foreground,
    minHeight: 48,
  },
});
