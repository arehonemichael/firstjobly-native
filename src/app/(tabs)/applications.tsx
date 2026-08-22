import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useIsFocused } from "../../hooks/use-is-focused";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../hooks/use-auth";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { supabase } from "../../lib/supabase";
import { theme } from "../../constants/theme";

const APPLICATIONS_STALE_MS = 7 * 60 * 1000;

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
  jobs: { id: string; slug: string | null; title: string; company_name: string } | null;
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
  return new Date(value).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
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

function ApplicationSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.jobMark, styles.skeletonBlock]} />
        <View style={styles.skeletonBody}>
          <View style={[styles.skeletonLine, { width: "68%" }]} />
          <View style={[styles.skeletonLine, { width: "88%", height: 13 }]} />
          <View style={[styles.skeletonLine, { width: "42%" }]} />
        </View>
      </View>
    </View>
  );
}

export default function ApplicationsScreen() {
  const bottomContentPadding = useScreenBottomPadding(false);
  const { userId, loading: authLoading } = useAuth();
  const isFocused = useIsFocused();
  const [items, setItems] = useState<Application[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const lastFetchedAt = useRef(0);
  const inFlight = useRef(false);
  const hasLoaded = useRef(false);

  const load = useCallback(async (force = false, manualRefresh = false) => {
    if (authLoading || inFlight.current) return;
    if (!force && Date.now() - lastFetchedAt.current < APPLICATIONS_STALE_MS) return;

    if (!userId) {
      setItems([]);
      setHistory([]);
      setLoading(false);
      setRefreshing(false);
      hasLoaded.current = true;
      lastFetchedAt.current = Date.now();
      return;
    }

    inFlight.current = true;
    if (!hasLoaded.current) setLoading(true);
    if (manualRefresh) setRefreshing(true);

    try {
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

      if (applicationsRes.error) {
        console.error("Applications load failed:", applicationsRes.error);
        return;
      }
      if (historyRes.error) console.error("Application history load failed:", historyRes.error);

      setItems((applicationsRes.data ?? []) as Application[]);
      setHistory((historyRes.data ?? []) as History[]);
      lastFetchedAt.current = Date.now();
    } finally {
      inFlight.current = false;
      hasLoaded.current = true;
      setLoading(false);
      setRefreshing(false);
    }
  }, [authLoading, userId]);

  useEffect(() => {
    lastFetchedAt.current = 0;
    hasLoaded.current = false;
    void load(true);
  }, [authLoading, userId, load]);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" && isFocused) void load(false);
    });
    return () => subscription.remove();
  }, [isFocused, load]);

  const historyByApplication = useMemo(() => {
    const grouped = new Map<string, History[]>();
    for (const entry of history) {
      const current = grouped.get(entry.application_id);
      if (current) current.push(entry);
      else grouped.set(entry.application_id, [entry]);
    }
    return grouped;
  }, [history]);

  if (authLoading || loading) {
    return (
      <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
        <View style={styles.loadingShell}>
          <View style={styles.header}>
            <Text style={styles.title}>My applications</Text>
            <Text style={styles.subtitle}>Loading your application activity</Text>
          </View>
          <View style={styles.skeletonList}>
            <ApplicationSkeleton />
            <ApplicationSkeleton />
            <ApplicationSkeleton />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!userId) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.signedOutCard}>
          <View style={styles.iconWrap}><Ionicons name="briefcase-outline" size={30} color={theme.colors.brand} /></View>
          <Text style={styles.emptyTitle}>Track your applications</Text>
          <Text style={styles.emptyText}>Sign in to see every FirstJobly application and its latest status.</Text>
          <TouchableOpacity activeOpacity={0.82} style={styles.primary} onPress={() => router.push("/auth")}>
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
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        refreshing={refreshing}
        onRefresh={() => void load(true, true)}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>My applications</Text>
            <Text style={styles.subtitle}>Track jobs you applied for through FirstJobly.</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <View style={styles.iconWrap}><Ionicons name="briefcase-outline" size={28} color={theme.colors.brand} /></View>
            <Text style={styles.emptyListTitle}>No applications yet</Text>
            <TouchableOpacity activeOpacity={0.82} style={styles.secondary} onPress={() => router.push("/jobs")}>
              <Text style={styles.secondaryText}>Search jobs</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const timeline = historyByApplication.get(item.id) ?? [];
          const latestNote = timeline.find((entry) => entry.message);
          const expanded = openId === item.id;
          const status = item.is_draft ? "Draft" : STATUS_LABEL[item.status] ?? item.status;

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.jobMark}>
                  <Text style={styles.jobMarkText}>{item.jobs?.company_name?.charAt(0).toUpperCase() || "F"}</Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.82}
                  style={styles.jobCopy}
                  disabled={!item.jobs}
                  onPress={() => item.jobs && router.push({ pathname: "/jobs/[id]", params: { id: item.jobs.id } })}
                >
                  <View style={styles.companyStatusRow}>
                    <Text numberOfLines={1} style={styles.company}>{item.jobs?.company_name ?? "Listing removed"}</Text>
                    <View style={styles.badge}><Text style={styles.badgeText}>{status}</Text></View>
                  </View>
                  <Text numberOfLines={2} style={styles.jobTitle}>{item.jobs?.title ?? "Listing removed"}</Text>
                  <Text style={styles.appliedDate}>Applied {formatDate(item.applied_at)}</Text>
                </TouchableOpacity>
              </View>

              {latestNote?.message && !expanded ? (
                <View style={styles.note}>
                  <Ionicons name="chatbox-outline" size={15} color={theme.colors.brand} />
                  <Text style={styles.noteText} numberOfLines={2}>{latestNote.message}</Text>
                </View>
              ) : null}

              {timeline.length > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.72}
                  style={styles.historyButton}
                  onPress={() => setOpenId(expanded ? null : item.id)}
                >
                  <Text style={styles.historyText}>{expanded ? "Hide status history" : `Status history (${timeline.length})`}</Text>
                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={17} color={theme.colors.brand} />
                </TouchableOpacity>
              ) : null}

              {expanded ? (
                <View style={styles.timeline}>
                  {timeline.map((entry) => (
                    <View key={entry.id} style={styles.timelineItem}>
                      <View style={styles.dot} />
                      <View style={styles.timelineBody}>
                        <Text style={styles.timelineStatus}>{STATUS_LABEL[entry.status] ?? entry.status}</Text>
                        <Text style={styles.timelineDate}>
                          {formatDateTime(entry.changed_at)}{entry.changed_by === "employer" ? " · from the employer" : ""}
                        </Text>
                        {entry.message ? <Text style={styles.timelineMessage}>{entry.message}</Text> : null}
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
  page: { flex: 1, backgroundColor: theme.colors.background },
  loadingShell: { flex: 1, paddingHorizontal: 16 },
  skeletonList: { gap: 10 },
  skeletonBody: { flex: 1, gap: 10, paddingTop: 4 },
  skeletonBlock: { backgroundColor: theme.colors.surfaceMuted },
  skeletonLine: { height: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceMuted },
  list: { padding: 16, paddingBottom: 110 },
  separator: { height: 10 },
  header: { paddingTop: 4, paddingBottom: 16 },
  title: { color: theme.colors.ink, fontSize: 23, lineHeight: 29, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { color: theme.colors.inkSoft, fontSize: 12, lineHeight: 17, marginTop: 3 },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    padding: 12,
    ...theme.shadow.card,
  },
  cardHeader: { flexDirection: "row", gap: 12 },
  jobMark: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  jobMarkText: { color: theme.colors.brand, fontSize: 24, fontWeight: "800" },
  jobCopy: { flex: 1, minWidth: 0 },
  companyStatusRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  company: { flex: 1, minWidth: 0, color: theme.colors.ink, fontSize: 15, lineHeight: 20, fontWeight: "700" },
  badge: {
    flexShrink: 0,
    minHeight: 23,
    paddingHorizontal: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.colors.selectedBorder,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: theme.colors.brand, fontSize: 10, fontWeight: "600" },
  jobTitle: { color: theme.colors.ink, fontSize: 14, lineHeight: 19, fontWeight: "600", marginTop: 4 },
  appliedDate: { color: theme.colors.brand, fontSize: 10, lineHeight: 14, fontWeight: "500", marginTop: 7 },
  note: {
    marginTop: 12,
    padding: 11,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    flexDirection: "row",
    gap: 7,
  },
  noteText: { flex: 1, color: theme.colors.inkSoft, fontSize: 12, lineHeight: 18 },
  historyButton: { minHeight: 44, marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  historyText: { color: theme.colors.brand, fontSize: 12, fontWeight: "700" },
  timeline: { marginTop: 4, borderLeftWidth: 1, borderLeftColor: theme.colors.line, marginLeft: 5 },
  timelineItem: { flexDirection: "row", marginBottom: 15 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.colors.brand, marginLeft: -5, marginTop: 5 },
  timelineBody: { flex: 1, marginLeft: 12 },
  timelineStatus: { color: theme.colors.ink, fontSize: 13, fontWeight: "700" },
  timelineDate: { color: theme.colors.textMuted, fontSize: 10, marginTop: 2 },
  timelineMessage: { color: theme.colors.inkSoft, fontSize: 12, lineHeight: 18, marginTop: 6 },
  signedOutCard: {
    margin: 16,
    padding: 24,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    ...theme.shadow.card,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: theme.colors.ink, fontSize: 20, fontWeight: "800", marginTop: 14 },
  emptyText: { color: theme.colors.inkSoft, textAlign: "center", lineHeight: 20, marginTop: 7 },
  emptyList: { alignItems: "center", paddingTop: 80 },
  emptyListTitle: { color: theme.colors.ink, fontWeight: "800", marginTop: 12 },
  primary: { width: "100%", height: 52, borderRadius: theme.radius.md, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center", marginTop: 22 },
  primaryText: { color: theme.colors.primaryForeground, fontWeight: "800" },
  secondary: { height: 48, paddingHorizontal: 22, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center", marginTop: 18 },
  secondaryText: { color: theme.colors.ink, fontWeight: "700" },
});