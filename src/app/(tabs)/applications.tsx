import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../hooks/use-auth";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { supabase } from "../../lib/supabase";

const STATUS_LABEL: Record<string, string> = {
  submitted: "Submitted",
  viewed: "Viewed by employer",
  shortlisted: "Shortlisted",
  interview: "Interview",
  offer: "Offer",
  rejected: "Not successful",
  withdrawn: "Withdrawn",
};

type Application = {
  id: string;
  applied_at: string;
  cover_note: string | null;
  is_draft: boolean;
  status: string;
  jobs: {
    id: string;
    slug: string | null;
    title: string;
    company_name: string;
  } | null;
};

type History = {
  id: string;
  application_id: string;
  status: string;
  message: string | null;
  changed_by: string;
  changed_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ApplicationsScreen() {
  const bottomContentPadding = useScreenBottomPadding(false);
  const { userId, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Application[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (authLoading) return;

    if (!userId) {
      setItems([]);
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [applicationsRes, historyRes] = await Promise.all([
      supabase
        .from("applications")
        .select("*, jobs(id,slug,title,company_name)")
        .eq("user_id", userId)
        .order("applied_at", { ascending: false }),
      supabase
        .from("application_status_history")
        .select("id,application_id,status,message,changed_by,changed_at")
        .order("changed_at", { ascending: false }),
    ]);

    setLoading(false);

    if (applicationsRes.error) {
      console.error("Applications load failed:", applicationsRes.error);
      return;
    }

    if (historyRes.error) {
      console.error("Application history load failed:", historyRes.error);
    }

    setItems((applicationsRes.data ?? []) as Application[]);
    setHistory((historyRes.data ?? []) as History[]);
  }, [authLoading, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#E1225F" />
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.empty}>
          <Ionicons name="briefcase-outline" size={45} color="#E1225F" />
          <Text style={styles.emptyTitle}>Track your applications</Text>
          <Text style={styles.emptyText}>
            Sign in to see every FirstJobly application and its latest status.
          </Text>
          <TouchableOpacity style={styles.primary} onPress={() => router.push("/auth")}>
            <Text style={styles.primaryText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: bottomContentPadding }]}
        refreshing={loading}
        onRefresh={() => void load()}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <TouchableOpacity style={styles.back} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={22} color="#061A30" />
              </TouchableOpacity>
              <View>
                <Text style={styles.title}>My applications</Text>
                <Text style={styles.subtitle}>
                  Track jobs you applied for through FirstJobly.
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Ionicons name="briefcase-outline" size={38} color="#94A3B8" />
            <Text style={styles.emptyListTitle}>No applications yet</Text>
            <TouchableOpacity style={styles.secondary} onPress={() => router.push("/jobs")}>
              <Text style={styles.secondaryText}>Search jobs</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const timeline = history.filter(
            (entry) => entry.application_id === item.id
          );
          const latestNote = timeline.find((entry) => entry.message);
          const expanded = openId === item.id;

          return (
            <View style={styles.card}>
              <TouchableOpacity
                disabled={!item.jobs}
                onPress={() => {
                  if (!item.jobs) return;
                  router.push({
                    pathname: "/jobs/[id]",
                    params: { id: item.jobs.id },
                  });
                }}
              >
                <Text style={styles.jobTitle}>
                  {item.jobs?.title ?? "Listing removed"}
                </Text>
                <Text style={styles.company}>
                  {item.jobs?.company_name ?? ""}
                  {item.jobs ? " � " : ""}
                  {formatDate(item.applied_at)}
                </Text>
              </TouchableOpacity>

              <View style={styles.statusRow}>
                <View style={[styles.badge, item.is_draft && styles.draftBadge]}>
                  <Text style={styles.badgeText}>
                    {item.is_draft
                      ? "Draft"
                      : STATUS_LABEL[item.status] ?? item.status}
                  </Text>
                </View>
              </View>

              {latestNote?.message && !expanded ? (
                <View style={styles.note}>
                  <Ionicons
                    name="chatbox-outline"
                    size={15}
                    color="#E1225F"
                  />
                  <Text style={styles.noteText} numberOfLines={2}>
                    {latestNote.message}
                  </Text>
                </View>
              ) : null}

              {timeline.length > 0 ? (
                <TouchableOpacity
                  style={styles.historyButton}
                  onPress={() => setOpenId(expanded ? null : item.id)}
                >
                  <Text style={styles.historyText}>
                    {expanded
                      ? "Hide status history"
                      : `Status history (${timeline.length})`}
                  </Text>
                  <Ionicons
                    name={expanded ? "chevron-up" : "chevron-down"}
                    size={17}
                    color="#E1225F"
                  />
                </TouchableOpacity>
              ) : null}

              {expanded ? (
                <View style={styles.timeline}>
                  {timeline.map((entry) => (
                    <View key={entry.id} style={styles.timelineItem}>
                      <View style={styles.dot} />
                      <View style={styles.timelineBody}>
                        <Text style={styles.timelineStatus}>
                          {STATUS_LABEL[entry.status] ?? entry.status}
                        </Text>
                        <Text style={styles.timelineDate}>
                          {formatDateTime(entry.changed_at)}
                          {entry.changed_by === "employer"
                            ? " � from the employer"
                            : ""}
                        </Text>
                        {entry.message ? (
                          <Text style={styles.timelineMessage}>
                            {entry.message}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F6F7F9" },
  center: {
    flex: 1,
    backgroundColor: "#F6F7F9",
    alignItems: "center",
    justifyContent: "center",
  },
  list: { padding: 16, paddingBottom: 110 },
  header: { paddingTop: 4, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  title: { color: "#061A30", fontSize: 23, fontWeight: "800" },
  subtitle: { color: "#556274", fontSize: 12, marginTop: 3 },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EBF0",
    borderRadius: 8,
    padding: 15,
    marginBottom: 11,
  },
  jobTitle: { color: "#061A30", fontSize: 15, fontWeight: "800" },
  company: { color: "#556274", fontSize: 12, marginTop: 4 },
  statusRow: { flexDirection: "row", marginTop: 11 },
  badge: {
    borderRadius: 8,
    backgroundColor: "#FDEEF3",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  draftBadge: {
    backgroundColor: "#F1F5F9",
  },
  badgeText: { color: "#556274", fontSize: 11, fontWeight: "700" },
  note: {
    marginTop: 12,
    padding: 11,
    borderRadius: 9,
    backgroundColor: "#F9FAFB",
    flexDirection: "row",
    gap: 7,
  },
  noteText: {
    flex: 1,
    color: "#556274",
    fontSize: 12,
    lineHeight: 18,
  },
  historyButton: {
    minHeight: 44,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyText: { color: "#E1225F", fontSize: 12, fontWeight: "700" },
  timeline: {
    marginTop: 4,
    borderLeftWidth: 1,
    borderLeftColor: "#E8EBF0",
    marginLeft: 5,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 15,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#E1225F",
    marginLeft: -5,
    marginTop: 5,
  },
  timelineBody: { flex: 1, marginLeft: 12 },
  timelineStatus: { color: "#061A30", fontSize: 13, fontWeight: "700" },
  timelineDate: { color: "#94A3B8", fontSize: 10, marginTop: 2 },
  timelineMessage: {
    color: "#556274",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  empty: {
    flex: 1,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: "#061A30",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 14,
  },
  emptyText: {
    color: "#556274",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 7,
  },
  emptyList: { alignItems: "center", paddingTop: 80 },
  emptyListTitle: {
    color: "#061A30",
    fontWeight: "800",
    marginTop: 12,
  },
  primary: {
    width: "100%",
    height: 52,
    borderRadius: 10,
    backgroundColor: "#E1225F",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },
  primaryText: { color: "#FFFFFF", fontWeight: "800" },
  secondary: {
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  secondaryText: { color: "#061A30", fontWeight: "700" },
});




