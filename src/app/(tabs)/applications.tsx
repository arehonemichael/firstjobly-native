import {
  AppText as Text,
  AppTouchableOpacity as TouchableOpacity,
} from "../../components/ui/primitives";
import { Fonts, Colors } from "../../constants/theme";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { Icon as Ionicons } from "../../components/ui/icon";
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
        <ActivityIndicator color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.empty}>
          <Ionicons name="briefcase-outline" size={45} color={Colors.primary} />
          <Text style={styles.emptyTitle}>Track your applications</Text>
          <Text style={styles.emptyText}>
            Sign in to see every FirstJobly application and its latest status.
          </Text>
          <TouchableOpacity
            style={styles.primary}
            onPress={() =>
              router.push({
                pathname: "/auth",
                params: { returnTo: "/applications" },
              })
            }
          >
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
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomContentPadding },
        ]}
        refreshing={loading}
        onRefresh={() => void load()}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <TouchableOpacity
                style={styles.back}
                onPress={() => router.back()}
              >
                <Ionicons
                  name="arrow-back"
                  size={18}
                  color={Colors.foreground}
                />
              </TouchableOpacity>
              <View>
                <Text style={styles.title}>My applications</Text>
                <Text style={styles.subtitle}>
                  Jobs you applied for through FirstJobly
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Ionicons
              name="briefcase-outline"
              size={38}
              color={Colors.mutedSubtle}
            />
            <Text style={styles.emptyListTitle}>No applications yet</Text>
            <TouchableOpacity
              style={styles.secondary}
              onPress={() => router.push("/jobs")}
            >
              <Text style={styles.secondaryText}>Search jobs</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const timeline = history.filter(
            (entry) => entry.application_id === item.id,
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
                  {item.jobs ? " · " : ""}
                  {formatDate(item.applied_at)}
                </Text>
              </TouchableOpacity>

              <View style={styles.statusRow}>
                <View
                  style={[styles.badge, item.is_draft && styles.draftBadge]}
                >
                  <Text style={styles.badgeText}>
                    {item.is_draft
                      ? "Draft"
                      : (STATUS_LABEL[item.status] ?? item.status)}
                  </Text>
                </View>
              </View>

              {latestNote?.message && !expanded ? (
                <View style={styles.note}>
                  <Ionicons
                    name="chatbox-outline"
                    size={18}
                    color={Colors.primary}
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
                    size={18}
                    color={Colors.primary}
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
                            ? " · from the employer"
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
  page: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { padding: 16, paddingBottom: 112 },
  header: { paddingTop: 4, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  back: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  title: {
    fontFamily: Fonts.editorial,
    fontWeight: "400",
    color: Colors.foreground,
    fontSize: 24,
  },
  subtitle: { color: Colors.muted, fontSize: 12, marginTop: 4 },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  jobTitle: { color: Colors.foreground, fontSize: 15, fontWeight: "500" },
  company: { color: Colors.muted, fontSize: 12, marginTop: 4 },
  statusRow: { flexDirection: "row", marginTop: 12 },
  badge: {
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  draftBadge: {
    backgroundColor: Colors.secondary,
  },
  badgeText: { color: Colors.muted, fontSize: 12, fontWeight: "500" },
  note: {
    marginTop: 12,
    padding: 12,
    borderRadius: 9,
    backgroundColor: Colors.background,
    flexDirection: "row",
    gap: 8,
  },
  noteText: {
    flex: 1,
    color: Colors.muted,
    fontSize: 12,
    lineHeight: 20,
  },
  historyButton: {
    minHeight: 44,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyText: { color: Colors.primaryPressed, fontSize: 12, fontWeight: "500" },
  timeline: {
    marginTop: 4,
    borderLeftWidth: 1,
    borderLeftColor: Colors.border,
    marginLeft: 4,
  },
  timelineItem: {
    flexDirection: "row",
    marginBottom: 16,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginLeft: -5,
    marginTop: 4,
  },
  timelineBody: { flex: 1, marginLeft: 12 },
  timelineStatus: { color: Colors.foreground, fontSize: 13, fontWeight: "500" },
  timelineDate: { color: Colors.mutedSubtle, fontSize: 12, marginTop: 2 },
  timelineMessage: {
    color: Colors.muted,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 8,
  },
  empty: {
    flex: 1,
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    fontFamily: Fonts.editorial,
    fontWeight: "400",
    color: Colors.foreground,
    fontSize: 20,
    marginTop: 16,
  },
  emptyText: {
    color: Colors.muted,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  emptyList: { alignItems: "center", paddingTop: 80 },
  emptyListTitle: {
    color: Colors.foreground,
    fontWeight: "500",
    marginTop: 12,
  },
  primary: {
    width: "100%",
    height: 52,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  primaryText: { color: Colors.surface, fontWeight: "500" },
  secondary: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  secondaryText: { color: Colors.foreground, fontWeight: "500" },
});
