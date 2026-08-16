import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { AdBanner } from "../../ads/AdBanner";
import { NativeAdBlock } from "../../ads/NativeAdBlock";
import { useJobInterstitial } from "../../ads/useJobInterstitial";
import { getJob } from "../../lib/job-api";
import { useSavedJobs } from "../../hooks/use-saved-jobs";
import type { Job } from "../../lib/jobs";

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
  const { id } = useLocalSearchParams<{ id: string }>();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const { isSaved, toggleSave } = useSavedJobs();
  const { continueWithOptionalAd } = useJobInterstitial(id);

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

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#E31C5F" />
      </SafeAreaView>
    );
  }

  if (error || !job) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="alert-circle-outline" size={45} color="#E31C5F" />

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

  const apply = async () => {
    if (!job.external_url) return;

    const canOpen = await Linking.canOpenURL(job.external_url);

    if (canOpen) {
      await Linking.openURL(job.external_url);
    }
  };

  const goBack = () => {
    void continueWithOptionalAd(() => router.back());
  };

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={goBack}>
          <Ionicons name="arrow-back" size={23} color="#0B1F30" />
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
            color={isSaved(job.id) ? "#E31C5F" : "#0B1F30"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
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

        <Text style={styles.title}>{job.title}</Text>
        <Text style={styles.company}>{job.company_name}</Text>

        <View style={styles.metaBlock}>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={18} color="#667085" />
            <Text style={styles.metaText}>{location}</Text>
          </View>

          {job.job_type && (
            <View style={styles.metaRow}>
              <Ionicons name="briefcase-outline" size={18} color="#667085" />
              <Text style={styles.metaText}>{job.job_type}</Text>
            </View>
          )}

          {salaryLabel && (
            <View style={styles.metaRow}>
              <Ionicons name="cash-outline" size={18} color="#667085" />
              <Text style={styles.metaText}>{salaryLabel}</Text>
            </View>
          )}

          {job.closing_date && (
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={18} color="#667085" />
              <Text style={styles.metaText}>
                Closes {formatDate(job.closing_date)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <Text style={styles.heading}>About this opportunity</Text>
        <Text style={styles.body}>{job.description}</Text>

        <AdBanner />

        {job.responsibilities?.length > 0 && (
          <>
            <Text style={styles.heading}>Responsibilities</Text>

            {job.responsibilities.map((item, index) => (
              <View key={`${index}-${item}`} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </>
        )}

        {job.requirements?.length > 0 && (
          <>
            <Text style={styles.heading}>Requirements</Text>

            {job.requirements.map((item, index) => (
              <View key={`${index}-${item}`} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </>
        )}

        {job.required_documents?.length > 0 && (
          <>
            <Text style={styles.heading}>Documents required</Text>

            {job.required_documents.map((item, index) => (
              <View key={`${index}-${item}`} style={styles.bulletRow}>
                <View style={styles.bullet} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </>
        )}

        <NativeAdBlock />

        <View style={{ height: 110 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.applyButton,
            !job.external_url && styles.disabledButton,
          ]}
          disabled={!job.external_url}
          onPress={() => void apply()}
        >
          <Text style={styles.applyText}>
            {job.external_url ? "Apply now" : "Application unavailable"}
          </Text>

          {job.external_url && (
            <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
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
    borderBottomColor: "#EAECF0",
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B1F30",
  },

  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    padding: 20,
    paddingBottom: 120,
  },

  logo: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: "#F2F4F7",
    alignItems: "center",
    justifyContent: "center",
  },

  logoLetter: {
    color: "#E31C5F",
    fontSize: 28,
    fontWeight: "800",
  },

  title: {
    fontSize: 26,
    lineHeight: 33,
    fontWeight: "800",
    color: "#0B1F30",
    marginTop: 20,
  },

  company: {
    color: "#475467",
    fontSize: 16,
    marginTop: 6,
  },

  metaBlock: {
    marginTop: 20,
    gap: 11,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  metaText: {
    color: "#667085",
    marginLeft: 8,
    fontSize: 14,
  },

  divider: {
    height: 1,
    backgroundColor: "#EAECF0",
    marginVertical: 26,
  },

  heading: {
    color: "#0B1F30",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 20,
    marginBottom: 11,
  },

  body: {
    color: "#475467",
    fontSize: 15,
    lineHeight: 24,
  },

  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },

  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E31C5F",
    marginTop: 8,
    marginRight: 10,
  },

  bulletText: {
    flex: 1,
    color: "#475467",
    fontSize: 15,
    lineHeight: 22,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EAECF0",
  },

  applyButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#E31C5F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  disabledButton: {
    backgroundColor: "#98A2B3",
  },

  applyText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  errorTitle: {
    color: "#0B1F30",
    fontSize: 19,
    fontWeight: "800",
    marginTop: 15,
    textAlign: "center",
  },

  backButton: {
    backgroundColor: "#E31C5F",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 20,
  },

  backButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
