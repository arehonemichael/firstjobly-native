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
import { supabase } from "../../lib/supabase";
import type { Job } from "../../lib/jobs";

import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { AdBanner } from "../../ads/AdBanner";
import { useJobInterstitial } from "../../ads/useJobInterstitial";
import { NativeAdBlock } from "../../ads/NativeAdBlock";

const WEB_APP_URL = "https://firstjobly.co.za";

import { InlineErrorState, SectionCard, SkeletonJobCard } from "../../components/ui/app-ui";

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function salary(job: Job) {
  if (!job.salary_min && !job.salary_max) return null;
  const format = (value: number) =>
    `R${Math.round(value).toLocaleString("en-ZA")}`;

  if (job.salary_min && job.salary_max) {
    return `${format(job.salary_min)} - ${format(job.salary_max)}`;
  }

  return format(job.salary_min ?? job.salary_max!);
}

export default function JobDetailsScreen() {
  const bottomContentPadding = useScreenBottomPadding(false);
  // Keep fixed CTA above the app tab bar.
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
        <ActivityIndicator size="large" color="#E1225F" />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={45} color="#E1225F" />
        <Text style={styles.errorTitle}>This opportunity is unavailable</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const location = job.city
    ? `${job.city}, ${job.province}`
    : job.province;

  const salaryLabel = salary(job);

  async function openApply() {
    if (job!.apply_type !== "easy_apply") {
      if (!job!.external_url) return;
      const canOpen = await Linking.canOpenURL(job!.external_url);
      if (canOpen) await Linking.openURL(job!.external_url);
      return;
    }

    if (!userId) {
      Alert.alert("Sign in to apply", "Sign in to use FirstJobly Easy Apply.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign in", onPress: () => router.push("/auth") },
      ]);
      return;
    }

    if (existingApplication && !existingApplication.is_draft) {
      Alert.alert(
        "Already applied",
        `This application is currently marked as ${
          existingApplication.status ?? "submitted"
        }.`
      );
      return;
    }

    const [profileRes, experienceRes, documentsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("work_experience")
        .select("user_id")
        .eq("user_id", userId),
      supabase
        .from("user_documents")
        .select("kind")
        .eq("user_id", userId),
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
      const detail =
        readiness.missing.length > 0
          ? `\n\nMissing:\n� ${readiness.missing.join("\n� ")}`
          : "";

      Alert.alert(
        "Complete your profile to apply",
        `Your profile is ${readiness.percent}% complete. Easy Apply needs at least 50%.${detail}`,
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Open Profile",
            onPress: () => router.push("/profile"),
          },
        ]
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
        supabase
          .from("work_experience")
          .select("user_id")
          .eq("user_id", userId),
        supabase
          .from("user_documents")
          .select("kind")
          .eq("user_id", userId),
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
        Alert.alert(
          "Profile changed",
          "Your profile no longer meets the Easy Apply requirements. Please review it and try again."
        );
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
        { onConflict: "user_id,job_id" }
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
            "Authorization": `Bearer ${sessionData.session?.access_token}`,
          },
          body: JSON.stringify({ jobId: job.id, applicationId: data.id, origin: WEB_APP_URL }),
        });
      } catch (notifyError) {
        console.error("Employer notify failed:", notifyError);
      }
    }

    setApplyOpen(false);

    Alert.alert(
      isDraft ? "Draft saved" : "Application submitted",
      isDraft
        ? "You can return to this application later."
        : "Your application is now in My Applications.",
      [
        {
          text: "My Applications",
          onPress: () => router.push("/applications"),
        },
        { text: "Done", style: "cancel" },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => void continueWithOptionalAd(() => router.back())}
        >
          <Ionicons name="arrow-back" size={23} color="#061A30" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Job Details</Text>

        <TouchableOpacity
          style={styles.iconButton}
          onPress={async () => {
            const result = await toggleSave(job.id);
            if (!result.ok && result.reason === "not-signed-in") {
              router.push("/auth");
            }
          }}
        >
          <Ionicons
            name={isSaved(job.id) ? "bookmark" : "bookmark-outline"}
            size={22}
            color={isSaved(job.id) ? "#E1225F" : "#061A30"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        {job.company_logo_url ? (
          <Image
            source={{ uri: job.company_logo_url }}
            style={styles.logo}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.logo}>
            <Text style={styles.logoLetter}>
              {job.company_name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.badgeRow}>
          {job.apply_type === "easy_apply" ? (
            <View style={styles.easyBadge}>
              <Text style={styles.easyBadgeText}>Easy Apply</Text>
            </View>
          ) : null}

          {existingApplication ? (
            <View style={styles.appliedBadge}>
              <Text style={styles.appliedBadgeText}>
                {existingApplication.is_draft
                  ? "Draft saved"
                  : "Already applied"}
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.title}>{job.title}</Text>
        <Text style={styles.company}>{job.company_name}</Text>

        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={18} color="#556274" />
            <Text style={styles.metaText}>{location}</Text>
          </View>

          {job.job_type ? (
            <View style={styles.metaRow}>
              <Ionicons name="briefcase-outline" size={18} color="#556274" />
              <Text style={styles.metaText}>{job.job_type}</Text>
            </View>
          ) : null}

          {salaryLabel ? (
            <View style={styles.metaRow}>
              <Ionicons name="cash-outline" size={18} color="#556274" />
              <Text style={styles.metaText}>{salaryLabel}</Text>
            </View>
          ) : null}

          {job.closing_date ? (
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={18} color="#556274" />
              <Text style={styles.metaText}>
                Closes {formatDate(job.closing_date)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        <Text style={styles.heading}>About this opportunity</Text>
        <Text style={styles.body}>{job.description}</Text>

        <AdBanner />

        {job.responsibilities?.length > 0 ? (
          <>
            <Text style={styles.heading}>Responsibilities</Text>
            {job.responsibilities.map((item, index) => (
              <View key={`${index}-${item}`} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </>
        ) : null}

        {job.requirements?.length > 0 ? (
          <>
            <Text style={styles.heading}>Requirements</Text>
            {job.requirements.map((item, index) => (
              <View key={`${index}-${item}`} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </>
        ) : null}

        {job.required_documents?.length > 0 ? (
          <>
            <Text style={styles.heading}>Documents required</Text>
            {job.required_documents.map((item, index) => (
              <View key={`${index}-${item}`} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </>
        ) : null}

      <NativeAdBlock />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.applyButton,
            job.apply_type !== "easy_apply" &&
              !job.external_url &&
              styles.disabledButton,
          ]}
          disabled={
            job.apply_type !== "easy_apply" && !job.external_url
          }
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

          <Ionicons
            name={
              job.apply_type === "easy_apply"
                ? "flash-outline"
                : "arrow-forward"
            }
            size={19}
            color="#FFFFFF"
          />
        </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={applyOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setApplyOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Easy Apply</Text>
                <Text style={styles.modalSubtitle}>
                  {job.title} � {job.company_name}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.close}
                onPress={() => setApplyOpen(false)}
              >
                <Ionicons name="close" size={22} color="#061A30" />
              </TouchableOpacity>
            </View>

            <Text style={styles.noteLabel}>Cover note (optional)</Text>
            <TextInput
              value={coverNote}
              onChangeText={setCoverNote}
              multiline
              maxLength={1000}
              placeholder="Tell the employer briefly why you're interested."
              placeholderTextColor="#94A3B8"
              style={styles.noteInput}
            />

            <Text style={styles.modalHint}>
              Your FirstJobly profile and uploaded documents will be used with
              this application.
            </Text>

            <TouchableOpacity
              style={styles.submitButton}
              disabled={submitting}
              onPress={() => void saveApplication(false)}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>Submit application</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.draftButton}
              disabled={submitting}
              onPress={() => void saveApplication(true)}
            >
              <Text style={styles.draftText}>Save as draft</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FFFFFF" },
  center: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },
  header: {
    height: 60,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EBF0",
  },
  headerTitle: { fontSize: 16, fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800", color: "#061A30" },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { padding: 20, paddingBottom: 120 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  logoLetter: { color: "#E1225F", fontSize: 28, fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800" },
  badgeRow: { flexDirection: "row", gap: 7, marginTop: 15 },
  easyBadge: {
    backgroundColor: "#FDEEF3",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  easyBadgeText: { color: "#E1225F", fontSize: 11, fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800" },
  appliedBadge: {
    backgroundColor: "#F1F5F9",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  appliedBadgeText: { color: "#556274", fontSize: 11, fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700" },
  title: {
    fontSize: 26,
    lineHeight: 33,
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
    color: "#061A30",
    marginTop: 15,
  },
  company: { color: "#556274", fontSize: 16, marginTop: 6 },
  metaBlock: { marginTop: 20, gap: 11 },
  metaRow: { flexDirection: "row", alignItems: "center" },
  metaText: { color: "#556274", marginLeft: 8, fontSize: 14 },
  divider: { height: 1, backgroundColor: "#E8EBF0", marginVertical: 26 },
  heading: {
    color: "#061A30",
    fontSize: 18,
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
    marginTop: 20,
    marginBottom: 11,
  },
  body: { color: "#556274", fontSize: 15, lineHeight: 24 },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E1225F",
    marginTop: 8,
    marginRight: 10,
  },
  bulletText: { flex: 1, color: "#556274", fontSize: 15, lineHeight: 22 },
  footer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E8EBF0",
  },
  applyButton: {
    height: 56,
    borderRadius: 8,
    backgroundColor: "#E1225F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disabledButton: { backgroundColor: "#94A3B8" },
  applyText: { color: "#FFFFFF", fontSize: 16, fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800" },
  errorTitle: {
    color: "#061A30",
    fontSize: 19,
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
    marginTop: 15,
    textAlign: "center",
  },
  backButton: {
    backgroundColor: "#E1225F",
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 20,
  },
  backButtonText: { color: "#FFFFFF", fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(11,31,48,0.38)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 30,
  },
  modalHeader: { flexDirection: "row", alignItems: "flex-start" },
  modalTitle: { color: "#061A30", fontSize: 21, fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800" },
  modalSubtitle: { color: "#556274", fontSize: 12, marginTop: 4 },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  noteLabel: {
    color: "#556274",
    fontSize: 13,
    fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700",
    marginTop: 20,
    marginBottom: 7,
  },
  noteInput: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    borderRadius: 8,
    padding: 12,
    color: "#061A30",
    textAlignVertical: "top",
  },
  modalHint: {
    color: "#556274",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 10,
  },
  submitButton: {
    height: 52,
    backgroundColor: "#E1225F",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  submitText: { color: "#FFFFFF", fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800", fontSize: 15 },
  draftButton: {
    height: 50,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 9,
  },
  draftText: { color: "#061A30", fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700" },
});













