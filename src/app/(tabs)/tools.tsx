import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { EmptyState, SectionCard } from "../../components/ui/app-ui";

const TOOLS = [
  {
    title: "CV Maker",
    description:
      "Build a clean, ATS-friendly CV and save it as a PDF on your phone.",
    icon: "document-text-outline" as const,
    route: "/cv-maker" as const,
    available: true,
  },
  {
    title: "Z83 Form Filler",
    description:
      "Complete the official South African government Z83 form from your phone.",
    icon: "reader-outline" as const,
    route: "/z83" as const,
    available: true,
  },
];

export default function ToolsScreen() {
  const bottomContentPadding = useScreenBottomPadding(true);
  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}>
        <Text style={styles.title}>Career tools</Text>
        <Text style={styles.subtitle}>
          Free tools to help you prepare stronger applications.
        </Text>

        <View style={styles.grid}>
          {TOOLS.map((tool) => (
            <TouchableOpacity
              key={tool.title}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => router.push(tool.route)}
            >
              <View style={styles.icon}>
                <Ionicons name={tool.icon} size={25} color="#E1225F" />
              </View>

              <View style={styles.body}>
                <Text style={styles.cardTitle}>{tool.title}</Text>
                <Text style={styles.description}>{tool.description}</Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={20}
                color="#94A3B8"
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tip}>
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color="#E1225F"
          />
          <Text style={styles.tipText}>
            Your CV draft stays on your device. FirstJobly only receives profile
            information when you choose to save it to your account.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F6F7F9" },
  content: { padding: 20, paddingBottom: 40 },
  title: {
    color: "#061A30",
    fontSize: 27,
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
  },
  subtitle: {
    color: "#556274",
    fontSize: 14,
    lineHeight: 20,
    marginTop: 5,
  },
  grid: { marginTop: 22, gap: 12 },
  card: {
    minHeight: 112,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EBF0",
    borderRadius: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#FDEEF3",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, marginHorizontal: 13 },
  cardTitle: {
    color: "#061A30",
    fontSize: 16,
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
  },
  description: {
    color: "#556274",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  tip: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#F8D3E0",
    backgroundColor: "#FDEEF3",
    borderRadius: 8,
    padding: 14,
    flexDirection: "row",
    gap: 10,
  },
  tipText: {
    flex: 1,
    color: "#556274",
    fontSize: 12,
    lineHeight: 18,
  },
});





