import { useEffect, useState, type ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { AppText as Text, AppPressable as Pressable } from "../ui/primitives";
import { Colors, Fonts, Layout } from "../../constants/theme";
import { CircularError } from "../../lib/circular/transport";
import { retrySeconds } from "../../hooks/use-circular";
export const cs = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: 24,
    gap: 16,
    width: "100%",
    maxWidth: Layout.reading,
    alignSelf: "center",
  },
  title: {
    fontFamily: Fonts.bold,
    fontSize: 26,
    lineHeight: 34,
    color: Colors.navy,
  },
  heading: { fontFamily: Fonts.semibold, fontSize: 18, lineHeight: 26 },
  body: { fontSize: 14, lineHeight: 22 },
  muted: { color: Colors.muted, fontSize: 13, lineHeight: 21 },
  card: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  buttonText: { color: Colors.primaryForeground, fontFamily: Fonts.semibold },
  secondary: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
  },
  link: { color: Colors.primary, fontFamily: Fonts.semibold },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  selected: {
    backgroundColor: Colors.primarySoft,
    borderColor: Colors.primary,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    borderRadius: 12,
    minHeight: 48,
  },
  bottom: {
    padding: 16,
    gap: 12,
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
});
export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[cs.button, secondary && cs.secondary]}
    >
      <Text style={secondary ? cs.link : cs.buttonText}>{label}</Text>
    </Pressable>
  );
}
export function PageShell({
  children,
  title,
  back = false,
}: {
  children: ReactNode;
  title?: string;
  back?: boolean;
}) {
  return (
    <SafeAreaView style={cs.page} edges={["top", "left", "right"]}>
      <View style={[cs.content, { paddingBottom: 0 }]}>
        {back && (
          <Pressable
            accessibilityLabel="Back"
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace("/circular-jobs")
            }
            style={cs.row}
          >
            <ArrowLeft size={20} color={Colors.muted} />
            <Text>Back</Text>
          </Pressable>
        )}
        {title && <Text style={cs.title}>{title}</Text>}
      </View>
      {children}
    </SafeAreaView>
  );
}
export function SignIn({ returnTo = "/circular-jobs" }: { returnTo?: string }) {
  return (
    <View style={cs.content}>
      <Text style={cs.heading}>Government jobs, in one place</Text>
      <Text style={cs.body}>
        Sign in to browse circulars, save jobs and prepare your application.
      </Text>
      <Button
        label="Sign in"
        onPress={() => router.push({ pathname: "/auth", params: { returnTo } })}
      />
    </View>
  );
}
export function Skeleton() {
  return (
    <View accessibilityLabel="Loading government jobs" style={cs.content}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[cs.card, { height: 130 }]}>
          <View
            style={{
              height: 18,
              width: "70%",
              backgroundColor: Colors.border,
              borderRadius: 6,
            }}
          />
          <View
            style={{
              height: 12,
              width: "90%",
              backgroundColor: Colors.border,
              borderRadius: 6,
            }}
          />
          <View
            style={{
              height: 12,
              width: "45%",
              backgroundColor: Colors.border,
              borderRadius: 6,
            }}
          />
        </View>
      ))}
    </View>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  const [seconds, setSeconds] = useState(() => retrySeconds(error));
  useEffect(() => {
    const timer = setInterval(() => setSeconds(retrySeconds(error)), 1000);
    return () => clearInterval(timer);
  }, [error]);
  const wait = Math.max(seconds, retrySeconds(error));
  return (
    <View accessibilityLiveRegion="polite" style={cs.card}>
      <Text style={cs.body}>{error.message}</Text>
      {error instanceof CircularError && error.status === 401 ? (
        <Button
          label="Sign in again"
          onPress={() =>
            router.push({
              pathname: "/auth",
              params: { returnTo: "/circular-jobs" },
            })
          }
        />
      ) : (
        <Button
          label={wait ? `Try again in ${wait}s` : "Try again"}
          disabled={wait > 0}
          secondary
          onPress={retry}
        />
      )}
    </View>
  );
}
