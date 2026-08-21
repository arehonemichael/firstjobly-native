import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { theme } from "../../constants/theme";

const TOOLS = [
  {
    title: "CV Maker",
    description: "Build a clean, ATS-friendly CV and save it as a PDF on your phone.",
    icon: "document-text-outline" as const,
    route: "/cv-maker" as const,
  },
  {
    title: "Z83 Form Filler",
    description: "Complete the official South African government Z83 form from your phone.",
    icon: "reader-outline" as const,
    route: "/z83" as const,
  },
];

export default function ToolsScreen() {
  const bottomContentPadding = useScreenBottomPadding(true);
  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Career tools</Text>
        <Text style={styles.subtitle}>Free tools to help you prepare stronger applications.</Text>

        <View style={styles.grid}>
          {TOOLS.map((tool) => (
            <Pressable
              key={tool.title}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push(tool.route)}
              accessibilityRole="button"
              accessibilityLabel={tool.title}
            >
              <View style={styles.icon}>
                <Ionicons name={tool.icon} size={25} color={theme.colors.brand} />
              </View>
              <View style={styles.body}>
                <Text style={styles.cardTitle}>{tool.title}</Text>
                <Text style={styles.description}>{tool.description}</Text>
              </View>
              <View style={styles.chevronWrap}>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.inkSoft} />
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.tip}>
          <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.brand} />
          <Text style={styles.tipText}>
            Your CV draft stays on your device. FirstJobly only receives profile information when you choose to save it to your account.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 40 },
  title: { color: theme.colors.ink, fontSize: 27, lineHeight: 33, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { color: theme.colors.inkSoft, fontSize: 14, lineHeight: 20, marginTop: 5 },
  grid: { marginTop: 22, gap: 10 },
  card: {
    minHeight: 112,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...theme.shadow.card,
  },
  cardPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  icon: {
    width: 54,
    height: 54,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  cardTitle: { color: theme.colors.ink, fontSize: 16, lineHeight: 21, fontWeight: "800" },
  description: { color: theme.colors.inkSoft, fontSize: 12, lineHeight: 18, marginTop: 4 },
  chevronWrap: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  tip: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: theme.colors.selectedBorder,
    backgroundColor: theme.colors.brandSoft,
    borderRadius: theme.radius.md,
    padding: 14,
    flexDirection: "row",
    gap: 10,
  },
  tipText: { flex: 1, color: theme.colors.inkSoft, fontSize: 12, lineHeight: 18 },
});