import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../hooks/use-auth";
import {
  DateOfBirthField,
  MultiSelectField,
  QUALIFICATIONS,
  SOUTH_AFRICAN_LANGUAGES,
  SOUTH_AFRICAN_PROVINCES,
  SingleSelectField,
  YearCompletedField,
} from "../../components/profile/structured-fields";
import { supabase } from "../../lib/supabase";
import { computeProfileCompletion } from "../../lib/profile-contract";
import { WorkExperienceSection } from "../../components/profile/work-experience";
import { DocumentsSection } from "../../components/profile/documents";

import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { InlineErrorState, SectionCard } from "../../components/ui/app-ui";

const PINK = "#E1225F";
const NAVY = "#061A30";
const BORDER = "#E8EBF0";
const MUTED = "#556274";

type Draft = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  province: string;
  city: string;
  address: string;
  about: string;
  highest_qualification: string;
  institution: string;
  field_of_study: string;
  year_completed: string;
  currently_studying: boolean;
  skills: string;
  languages: string;
  preferred_job_types: string;
  preferred_province: string;
  preferred_city: string;
  available_immediately: boolean | null;
  willing_to_relocate: boolean | null;
};

const empty: Draft = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  date_of_birth: "",
  province: "",
  city: "",
  address: "",
  about: "",
  highest_qualification: "",
  institution: "",
  field_of_study: "",
  year_completed: "",
  currently_studying: false,
  skills: "",
  languages: "",
  preferred_job_types: "",
  preferred_province: "",
  preferred_city: "",
  available_immediately: null,
  willing_to_relocate: null,
};

const list = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

function has(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

export default function ProfileScreen() {
  const bottomContentPadding = useScreenBottomPadding(true);
  const { user, loading, isAuthenticated } = useAuth();

  const [draft, setDraft] = useState<Draft>(empty);
  const [busy, setBusy] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [experienceCount, setExperienceCount] = useState(0);
  const [documentKinds, setDocumentKinds] = useState<string[]>([]);

  const onExperienceChanged = useCallback((count: number) => {
    setExperienceCount(count);
  }, []);

  const onDocumentsChanged = useCallback((kinds: string[]) => {
    setDocumentKinds(kinds);
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let alive = true;

    void (async () => {
      setProfileLoading(true);

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (!alive) return;

      setProfileLoading(false);

      if (error) {
        Alert.alert("Profile", "Could not load your profile.");
        return;
      }

      setDraft({
        first_name: data?.first_name ?? "",
        last_name: data?.last_name ?? "",
        email: data?.email ?? user.email ?? "",
        phone: data?.phone ?? "",
        date_of_birth: data?.date_of_birth ?? "",
        province: data?.province ?? "",
        city: data?.city ?? "",
        address: data?.address ?? "",
        about: data?.about ?? "",
        highest_qualification: data?.highest_qualification ?? "",
        institution: data?.institution ?? "",
        field_of_study: data?.field_of_study ?? "",
        year_completed: data?.year_completed ? String(data.year_completed) : "",
        currently_studying: data?.currently_studying ?? false,
        skills: (data?.skills ?? []).join(", "),
        languages: (data?.languages ?? []).join(", "),
        preferred_job_types: (data?.preferred_job_types ?? []).join(", "),
        preferred_province: data?.preferred_province ?? "",
        preferred_city: data?.preferred_city ?? "",
        available_immediately: data?.available_immediately ?? null,
        willing_to_relocate: data?.willing_to_relocate ?? null,
      });
    })();

    return () => {
      alive = false;
    };
  }, [user?.id, user?.email]);


  const completion = useMemo(
    () =>
      computeProfileCompletion(
        {
          ...draft,
          skills: list(draft.skills),
          languages: list(draft.languages),
          preferred_job_types: list(draft.preferred_job_types),
        },
        Array.from({ length: experienceCount }, () => ({})),
        documentKinds.map((kind) => ({ kind })),
      ),
    [draft, experienceCount, documentKinds],
  );

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function save() {
    if (!user?.id) return;

    setBusy(true);

    const first = draft.first_name.trim().slice(0, 60);
    const last = draft.last_name.trim().slice(0, 60);

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: first || null,
        last_name: last || null,
        full_name: [first, last].filter(Boolean).join(" ") || null,
        phone: draft.phone.trim().slice(0, 20) || null,
        date_of_birth: draft.date_of_birth || null,
        province: draft.province.trim() || null,
        city: draft.city.trim().slice(0, 80) || null,
        address: draft.address.trim().slice(0, 200) || null,
        about: draft.about.trim().slice(0, 800) || null,
        highest_qualification:
          draft.highest_qualification.trim() || null,
        institution: draft.institution.trim().slice(0, 120) || null,
        field_of_study:
          draft.field_of_study.trim().slice(0, 120) || null,
        year_completed: draft.year_completed
          ? Number(draft.year_completed)
          : null,
        currently_studying: draft.currently_studying,
        skills: list(draft.skills).slice(0, 40),
        languages: list(draft.languages).slice(0, 15),
        preferred_job_types: list(draft.preferred_job_types),
        preferred_province: draft.preferred_province.trim() || null,
        preferred_city:
          draft.preferred_city.trim().slice(0, 80) || null,
        available_immediately: draft.available_immediately,
        willing_to_relocate: draft.willing_to_relocate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setBusy(false);

    Alert.alert(
      error ? "Profile" : "Saved",
      error
        ? "Could not save your profile."
        : "Your profile has been updated."
    );
  }

  if (loading || profileLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={PINK} />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={styles.page}>
        <View style={styles.loggedOut}>
          <Ionicons
            name="person-circle-outline"
            size={72}
            color={PINK}
          />
          <Text style={styles.heading}>Your FirstJobly account</Text>
          <Text style={styles.muted}>
            Sign in to save jobs, track applications and manage your profile.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push("/auth")}
          >
            <Text style={styles.buttonText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top", "bottom"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.heading}>My profile</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {[draft.first_name, draft.last_name]
              .filter(Boolean)
              .join(" ") || "FirstJobly account"}
          </Text>
          <Text style={styles.muted}>{user.email}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.cardTitle}>Profile completion</Text>
            <Text style={styles.percent}>{completion}%</Text>
          </View>
          <View style={styles.track}>
            <View
              style={[styles.fill, { width: `${completion}%` }]}
            />
          </View>
          <Text style={styles.muted}>
            A complete profile makes Easy Apply faster and improves your
            matches.
          </Text>
        </View>

        <Section title="Personal information">
          <Field
            label="First name"
            value={draft.first_name}
            onChangeText={(v) => set("first_name", v)}
          />
          <Field
            label="Last name"
            value={draft.last_name}
            onChangeText={(v) => set("last_name", v)}
          />
          <Field
            label="Email address"
            value={draft.email}
            editable={false}
          />
          <Field
            label="Phone number"
            value={draft.phone}
            onChangeText={(v) => set("phone", v)}
            keyboardType="phone-pad"
          />
          <DateOfBirthField
            value={draft.date_of_birth}
            onChange={(v) => set("date_of_birth", v)}
          />
          <SingleSelectField
            label="Province"
            value={draft.province}
            options={SOUTH_AFRICAN_PROVINCES}
            placeholder="Select province"
            onChange={(v) => set("province", v)}
          />
          <Field
            label="City / town"
            value={draft.city}
            onChangeText={(v) => set("city", v)}
          />
          <Field
            label="Residential address"
            value={draft.address}
            onChangeText={(v) => set("address", v)}
            multiline
          />
        </Section>

        <Section title="Professional summary">
          <Field
            label="About me"
            value={draft.about}
            onChangeText={(v) => set("about", v)}
            multiline
          />
        </Section>

        <Section title="Education">
          <SingleSelectField
            label="Highest qualification"
            value={draft.highest_qualification}
            options={QUALIFICATIONS}
            placeholder="Select qualification"
            onChange={(v) => set("highest_qualification", v)}
          />
          <Field
            label="Institution"
            value={draft.institution}
            onChangeText={(v) => set("institution", v)}
          />
          <Field
            label="Field of study"
            value={draft.field_of_study}
            onChangeText={(v) => set("field_of_study", v)}
          />
          <YearCompletedField
            value={draft.year_completed}
            onChange={(v) => set("year_completed", v)}
          />
          <Toggle
            label="Currently studying"
            value={draft.currently_studying}
            onValueChange={(v) => set("currently_studying", v)}
          />
        </Section>

        <Section title="Work experience">
          <WorkExperienceSection
            userId={user.id}
            onChanged={onExperienceChanged}
          />
        </Section>

        <Section title="Skills">
          <Field
            label="Skills"
            value={draft.skills}
            onChangeText={(v) => set("skills", v)}
            multiline
            placeholder="Communication, Excel, Customer service"
          />
          <Text style={styles.helper}>Separate skills with commas.</Text>
        </Section>

        <Section title="Languages">
          <MultiSelectField
            label="Languages"
            value={draft.languages}
            options={SOUTH_AFRICAN_LANGUAGES}
            placeholder="Select languages"
            onChange={(v) => set("languages", v)}
          />
        </Section>

        <Section title="Employment preferences">
          <Field
            label="Job types"
            value={draft.preferred_job_types}
            onChangeText={(v) => set("preferred_job_types", v)}
            placeholder="Internship, Learnership, Permanent"
          />
          <SingleSelectField
            label="Preferred province"
            value={draft.preferred_province}
            options={SOUTH_AFRICAN_PROVINCES}
            placeholder="Select preferred province"
            onChange={(v) => set("preferred_province", v)}
          />
          <Field
            label="Preferred city"
            value={draft.preferred_city}
            onChangeText={(v) => set("preferred_city", v)}
          />
          <Toggle
            label="Available immediately"
            value={draft.available_immediately}
            onValueChange={(v) => set("available_immediately", v)}
          />
          <Toggle
            label="Willing to relocate"
            value={draft.willing_to_relocate}
            onValueChange={(v) => set("willing_to_relocate", v)}
          />
        </Section>

        <Section title="Documents">
          <DocumentsSection
            userId={user.id}
            onChanged={onDocumentsChanged}
          />
        </Section>

        <TouchableOpacity
          style={styles.button}
          disabled={busy}
          onPress={() => void save()}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>Save profile</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.signOut}
          onPress={() => {
            Alert.alert(
              "Sign out",
              "Do you want to sign out of FirstJobly?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Sign out",
                  style: "destructive",
                  onPress: async () => {
                    await supabase.auth.signOut();
                  },
                },
              ]
            );
          }}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Field({
  label,
  multiline,
  ...props
}: {
  label: string;
  multiline?: boolean;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#94A3B8"
        style={[
          styles.input,
          multiline && styles.multiline,
          props.editable === false && styles.disabled,
        ]}
      />
    </View>
  );
}

function Toggle({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean | null;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value === true}
        onValueChange={onValueChange}
        trackColor={{ false: "#DFE4EC", true: "#F6A8C4" }}
        thumbColor={value ? PINK : "#FFFFFF"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F6F7F9" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F6F7F9",
  },
  loggedOut: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 40,
  },
  heading: {
    color: NAVY,
    fontSize: 24,
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
    marginBottom: 14,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { color: NAVY, fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700", fontSize: 15 },
  sectionTitle: {
    color: NAVY,
    fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800",
    fontSize: 16,
    marginBottom: 4,
  },
  muted: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  percent: { color: PINK, fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800" },
  track: {
    height: 9,
    backgroundColor: "#F1F5F9",
    borderRadius: 99,
    overflow: "hidden",
    marginVertical: 10,
  },
  fill: { height: "100%", backgroundColor: PINK, borderRadius: 99 },
  field: { marginTop: 12 },
  label: {
    color: "#556274",
    fontSize: 13,
    fontFamily: "PlusJakartaSans_600SemiBold", fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: NAVY,
    backgroundColor: "#FFFFFF",
  },
  multiline: {
    minHeight: 90,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  disabled: { backgroundColor: "#F9FAFB", color: MUTED },
  helper: { color: MUTED, fontSize: 11, marginTop: 6 },
  toggle: {
    minHeight: 54,
    marginTop: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  button: {
    height: 52,
    backgroundColor: PINK,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    width: "100%",
  },
  buttonText: { color: "#FFFFFF", fontFamily: "PlusJakartaSans_800ExtraBold", fontWeight: "800", fontSize: 15 },
  signOut: {
    height: 50,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  signOutText: { color: PINK, fontFamily: "PlusJakartaSans_700Bold", fontWeight: "700" },
});







