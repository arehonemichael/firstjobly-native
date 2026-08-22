import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { getJob } from "../../lib/job-api";
import { useSavedJobs } from "../../hooks/use-saved-jobs";
import { useAuth } from "../../hooks/use-auth";
import { evaluateEasyApply } from "../../lib/apply-gate";
import { trackApplyClick } from "../../lib/apply-clicks";
import { maybeRequestReviewAfterSuccessfulApply } from "../../lib/rate-us";
import { supabase } from "../../lib/supabase";
import type { Job } from "../../lib/jobs";
import { formatCategoryLabel } from "../../lib/job-formatters";
import { closingJobCountdown, formatJobLocation, formatJobSalary } from "../../lib/job-display";
import { theme } from "../../constants/theme";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { AdBanner } from "../../ads/AdBanner";
import { useJobInterstitial } from "../../ads/useJobInterstitial";
import { NativeAdBlock } from "../../ads/NativeAdBlock";

const WEB_APP_URL = "https://firstjobly.co.za";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function JobDetailsScreen() {
  const bottomContentPadding = useScreenBottomPadding(false);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const { isSaved, toggleSave } = useSavedJobs();
  const { continueWithOptionalAd } = useJobInterstitial(id);

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [coverNote, setCoverNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingApplication, setExistingApplication] = useState<{
    id: string;
    is_draft: boolean;
    status: string;
    cover_note: string | null;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    getJob(id)
      .then((data) => {
        if (!data) setError(true);
        else setJob(data);
      })
      .catch((err) => {
        console.error("Job detail failed:", err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!job?.id || !userId) {
      setExistingApplication(null);
      return;
    }
    void supabase
      .from("applications")
      .select("id,is_draft,status,cover_note")
      .eq("user_id", userId)
      .eq("job_id", job.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error) {
          setExistingApplication(data);
          setCoverNote(data?.cover_note ?? "");
        }
      });
  }, [job?.id, userId]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.brand} />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView style={styles.center}>
        <View style={styles.errorIcon}>
          <Ionicons name="alert-circle-outline" size={34} color={theme.colors.brand} />
        </View>
        <Text style={styles.errorTitle}>This opportunity is unavailable</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const location = formatJobLocation(job);
  const salaryLabel = formatJobSalary(job);
  const closingCountdown = closingJobCountdown(job);

  async function openApply() {
    if (job!.apply_type !== "easy_apply") {
      if (!job!.external_url) return;
      const canOpen = await Linking.canOpenURL(job!.external_url);
      if (canOpen) {
        await trackApplyClick(job!.id, userId);
        await Linking.openURL(job!.external_url);
      }
      return;
    }

    if (!userId) {
      await trackApplyClick(job!.id, null);
      Alert.alert("Sign in to apply", "Sign in to use FirstJobly Easy Apply.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign in", onPress: () => router.push("/auth") },
      ]);
      return;
    }

    if (existingApplication && !existingApplication.is_draft) {
      Alert.alert("Already applied", `This application is currently marked as ${existingApplication.status ?? "submitted"}.`);
      return;
    }

    await trackApplyClick(job!.id, userId);

    const [profileRes, experienceRes, documentsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("work_experience").select("user_id").eq("user_id", userId),
      supabase.from("user_documents").select("kind").eq("user_id", userId),
    ]);

    if (profileRes.error || experienceRes.error || documentsRes.error) {
      Alert.alert("Easy Apply", "Could not check your profile right now.");
      return;
    }

    const readiness = evaluateEasyApply({
      profile: profileRes.data,
      experience: experienceRes.data ?? [],
      documents: documentsRes.data ?? [],
      job: job!,
    });

    if (!readiness.ok) {
      const detail = readiness.missing.length > 0 ? `\n\nMissing:\n\u2022 ${readiness.missing.join("\n\u2022 ")}` : "";
      Alert.alert(
        "Complete your profile to apply",
        `Your profile is ${readiness.percent}% complete. Easy Apply needs at least 50%.${detail}`,
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Profile", onPress: () => router.push("/profile") },
        ],
      );
      return;
    }
    setApplyOpen(true);
  }

  async function saveApplication(isDraft: boolean) {
    if (!userId || !job?.id || submitting) return;
    setSubmitting(true);

    if (!isDraft) {
      const [profileRes, experienceRes, documentsRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("work_experience").select("user_id").eq("user_id", userId),
        supabase.from("user_documents").select("kind").eq("user_id", userId),
      ]);
      const readiness = evaluateEasyApply({
        profile: profileRes.data,
        experience: experienceRes.data ?? [],
        documents: documentsRes.data ?? [],
        job,
      });
      if (!readiness.ok) {
        setSubmitting(false);
        setApplyOpen(false);
        Alert.alert("Profile changed", "Your profile no longer meets the Easy Apply requirements. Please review it and try again.");
        return;
      }
    }

    const { data, error: applyError } = await supabase
      .from("applications")
      .upsert(
        {
          user_id: userId,
          job_id: job.id,
          status: "submitted",
          is_draft: isDraft,
          cover_note: coverNote.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,job_id" },
      )
      .select("id,is_draft,status,cover_note")
      .maybeSingle();

    setSubmitting(false);
    if (applyError) {
      console.error("Easy Apply failed:", applyError);
      Alert.alert("Easy Apply", "Could not save your application.");
      return;
    }

    setExistingApplication(data);
    if (!isDraft) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        await fetch(`${WEB_APP_URL}/api/public/notify-employer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({ jobId: job.id, applicationId: data!.id, origin: WEB_APP_URL }),
        });
      } catch (notifyError) {
        console.error("Employer notify failed:", notifyError);
      }
    }

    setApplyOpen(false);
    Alert.alert(
      isDraft ? "Draft saved" : "Application submitted",
      isDraft ? "You can return to this application later." : "Your application is now in My Applications.",
      [
        {
          text: "My Applications",
          onPress: () => {
            router.push("/applications");
            if (!isDraft) setTimeout(() => void maybeRequestReviewAfterSuccessfulApply(), 900);
          },
        },
        {
          text: "Done",
          style: "cancel",
          onPress: () => {
            if (!isDraft) setTimeout(() => void maybeRequestReviewAfterSuccessfulApply(), 250);
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => void continueWithOptionalAd(() => router.back())}>
          <Ionicons name="arrow-back" size={23} color={theme.colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Job details</Text>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={async () => {
            const result = await toggleSave(job.id);
            if (!result.ok && result.reason === "not-signed-in") router.push("/auth");
          }}
        >
          <Ionicons
            name={isSaved(job.id) ? "bookmark" : "bookmark-outline"}
            size={22}
            color={isSaved(job.id) ? theme.colors.brand : theme.colors.ink}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          {job.company_logo_url ? (
            <Image source={{ uri: job.company_logo_url }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={styles.logo}><Text style={styles.logoLetter}>{job.company_name.charAt(0).toUpperCase()}</Text></View>
          )}

          <View style={styles.badgeRow}>
            {job.apply_type === "easy_apply" ? <View style={styles.badge}><Text style={styles.badgeText}>Easy Apply</Text></View> : null}
            {job.category ? <View style={styles.neutralBadge}><Text style={styles.neutralBadgeText}>{formatCategoryLabel(job.category)}</Text></View> : null}
            {existingApplication ? (
              <View style={styles.neutralBadge}>
                <Text style={styles.neutralBadgeText}>{existingApplication.is_draft ? "Draft saved" : "Already applied"}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.title}>{job.title}</Text>
          <Text style={styles.company}>{job.company_name}</Text>

          <View style={styles.metaBlock}>
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={17} color={theme.colors.inkSoft} />
              <Text style={styles.metaText}>{location}</Text>
            </View>
            {job.job_type ? (
              <View style={styles.metaRow}>
                <Ionicons name="briefcase-outline" size={17} color={theme.colors.inkSoft} />
                <Text style={styles.metaText}>{formatCategoryLabel(job.job_type)}</Text>
              </View>
            ) : null}
            {job.closing_date ? (
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={17} color={closingCountdown ? theme.colors.danger : theme.colors.inkSoft} />
                <View style={styles.dateCopy}>
                  <Text style={[styles.metaText, closingCountdown && styles.closingUrgent]}>Closes {formatDate(job.closing_date)}</Text>
                  {closingCountdown ? <Text style={styles.countdownText}>{closingCountdown}</Text> : null}
                </View>
              </View>
            ) : null}
            {salaryLabel ? <Text style={styles.salaryText}>{salaryLabel}</Text> : null}
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.heading}>About this opportunity</Text>
          <Text style={styles.body}>{job.description}</Text>
        </View>

        <AdBanner />

        {job.responsibilities?.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.heading}>Responsibilities</Text>
            {job.responsibilities.map((item, index) => (
              <View key={`${index}-${item}`} style={styles.bulletRow}><View style={styles.bullet} /><Text style={styles.bulletText}>{item}</Text></View>
            ))}
          </View>
        ) : null}

        {job.requirements?.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.heading}>Requirements</Text>
            {job.requirements.map((item, index) => (
              <View key={`${index}-${item}`} style={styles.bulletRow}><View style={styles.bullet} /><Text style={styles.bulletText}>{item}</Text></View>
            ))}
          </View>
        ) : null}

        {job.required_documents?.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.heading}>Documents required</Text>
            {job.required_documents.map((item, index) => (
              <View key={`${index}-${item}`} style={styles.bulletRow}><View style={styles.bullet} /><Text style={styles.bulletText}>{item}</Text></View>
            ))}
          </View>
        ) : null}

        <NativeAdBlock />

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.applyButton, job.apply_type !== "easy_apply" && !job.external_url && styles.disabledButton]}
            disabled={job.apply_type !== "easy_apply" && !job.external_url}
            onPress={() => void openApply()}
          >
            <Text style={styles.applyText}>
              {job.apply_type === "easy_apply"
                ? existingApplication?.is_draft
                  ? "Continue application"
                  : existingApplication
                    ? "Application submitted"
                    : "Easy Apply"
                : job.external_url
                  ? "Apply now"
                  : "Application unavailable"}
            </Text>
            <Ionicons name={job.apply_type === "easy_apply" ? "flash-outline" : "arrow-forward"} size={19} color={theme.colors.primaryForeground} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={applyOpen} animationType="slide" transparent onRequestClose={() => setApplyOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Easy Apply</Text>
                <Text style={styles.modalSubtitle}>{job.title} {"\u00B7"} {job.company_name}</Text>
              </View>
              <TouchableOpacity style={styles.close} onPress={() => setApplyOpen(false)}>
                <Ionicons name="close" size={22} color={theme.colors.ink} />
              </TouchableOpacity>
            </View>

            <Text style={styles.noteLabel}>Cover note (optional)</Text>
            <TextInput
              value={coverNote}
              onChangeText={setCoverNote}
              multiline
              maxLength={1000}
              placeholder="Tell the employer briefly why you're interested."
              placeholderTextColor={theme.colors.textMuted}
              style={styles.noteInput}
            />
            <Text style={styles.modalHint}>Your FirstJobly profile and uploaded documents will be used with this application.</Text>

            <TouchableOpacity style={styles.submitButton} disabled={submitting} onPress={() => void saveApplication(false)}>
              {submitting ? <ActivityIndicator color={theme.colors.primaryForeground} /> : <Text style={styles.submitText}>Submit application</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.draftButton} disabled={submitting} onPress={() => void saveApplication(true)}>
              <Text style={styles.draftText}>Save as draft</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", padding: 25 },
  header: {
    minHeight: 60,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
    backgroundColor: theme.colors.background,
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.ink },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 16, paddingBottom: 120, gap: 12 },
  heroCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: 18,
    ...theme.shadow.card,
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: { color: theme.colors.brand, fontSize: 28, fontWeight: "800" },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 15 },
  badge: { backgroundColor: theme.colors.brandSoft, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
  badgeText: { color: theme.colors.brand, fontSize: 11, fontWeight: "800" },
  neutralBadge: { backgroundColor: theme.colors.surfaceMuted, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
  neutralBadgeText: { color: theme.colors.inkSoft, fontSize: 11, fontWeight: "700" },
  title: { fontSize: 26, lineHeight: 33, fontWeight: "800", color: theme.colors.ink, marginTop: 15, letterSpacing: -0.4 },
  company: { color: theme.colors.inkSoft, fontSize: 16, marginTop: 6 },
  metaBlock: { marginTop: 20, gap: 10 },
  metaRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  metaText: { color: theme.colors.inkSoft, fontSize: 14, lineHeight: 19 },
  dateCopy: { flex: 1 },
  closingUrgent: { color: theme.colors.danger, fontWeight: "700" },
  countdownText: { color: theme.colors.danger, fontSize: 11, lineHeight: 15, fontWeight: "700", marginTop: 2 },
  salaryText: { color: theme.colors.brand, fontSize: 12, lineHeight: 17, fontWeight: "600", marginLeft: 25 },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.line,
    padding: 16,
  },
  heading: { color: theme.colors.ink, fontSize: 18, lineHeight: 24, fontWeight: "800", marginBottom: 11 },
  body: { color: theme.colors.inkSoft, fontSize: 15, lineHeight: 24 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.brand, marginTop: 8, marginRight: 10 },
  bulletText: { flex: 1, color: theme.colors.inkSoft, fontSize: 15, lineHeight: 22 },
  footer: { marginTop: 12, paddingTop: 4 },
  applyButton: {
    height: 56,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disabledButton: { backgroundColor: theme.colors.textMuted },
  applyText: { color: theme.colors.primaryForeground, fontSize: 16, fontWeight: "800" },
  errorIcon: { width: 62, height: 62, borderRadius: theme.radius.md, backgroundColor: theme.colors.brandSoft, alignItems: "center", justifyContent: "center" },
  errorTitle: { color: theme.colors.ink, fontSize: 19, fontWeight: "800", marginTop: 15, textAlign: "center" },
  backButton: { backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, paddingHorizontal: 24, paddingVertical: 13, marginTop: 20 },
  backButtonText: { color: theme.colors.primaryForeground, fontWeight: "800" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(23,33,43,0.42)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, padding: 20, paddingBottom: 30 },
  modalHeader: { flexDirection: "row", alignItems: "flex-start" },
  modalTitle: { color: theme.colors.ink, fontSize: 21, fontWeight: "800" },
  modalSubtitle: { color: theme.colors.inkSoft, fontSize: 12, marginTop: 4 },
  close: { width: 38, height: 38, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  noteLabel: { color: theme.colors.inkSoft, fontSize: 13, fontWeight: "700", marginTop: 20, marginBottom: 7 },
  noteInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.sm,
    padding: 12,
    color: theme.colors.ink,
    backgroundColor: theme.colors.surface,
    textAlignVertical: "top",
  },
  modalHint: { color: theme.colors.inkSoft, fontSize: 11, lineHeight: 17, marginTop: 10 },
  submitButton: { height: 52, backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center", marginTop: 18 },
  submitText: { color: theme.colors.primaryForeground, fontWeight: "800", fontSize: 15 },
  draftButton: { height: 50, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center", marginTop: 9 },
  draftText: { color: theme.colors.ink, fontWeight: "700" },
});
