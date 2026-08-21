import { useEffect, useState } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";

import { useAuth } from "../hooks/use-auth";
import { supabase } from "../lib/supabase";
import { generateCvText } from "../lib/cv-ai";
import { savePdfToDownloads } from "../lib/save-pdf";
import { useRewardedDocumentDownload } from "../ads/useRewardedDocumentDownload";
import {
  TEMPLATE_LIST,
  cvHtml,
  emptyCertification,
  emptyCv,
  emptyEducation,
  emptyExperience,
  emptyReference,
  fileBase,
  type CvData,
  type TemplateId,
} from "../lib/cv/native";
import { useScreenBottomPadding } from "../hooks/use-screen-bottom-padding";
import { theme } from "../constants/theme";

const STORAGE_KEY = "firstjobly.cv.draft.v1";
const TEMPLATE_KEY = "firstjobly.cv.template.v1";

export default function CvMakerScreen() {
  const bottomContentPadding = useScreenBottomPadding(false);
  const { userId, isAuthenticated } = useAuth();
  const { requestRewardedDownload } = useRewardedDocumentDownload();
  const [data, setData] = useState<CvData>(() => emptyCv());
  const [templateId, setTemplateId] = useState<TemplateId>("classic");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([AsyncStorage.getItem(STORAGE_KEY), AsyncStorage.getItem(TEMPLATE_KEY)]).then(([raw, tpl]) => {
      if (raw) {
        try { setData({ ...emptyCv(), ...(JSON.parse(raw) as Partial<CvData>) }); } catch {}
      }
      if (tpl === "classic" || tpl === "professional" || tpl === "graduate" || tpl === "skills" || tpl === "compact") {
        setTemplateId(tpl);
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    void AsyncStorage.setItem(TEMPLATE_KEY, templateId);
  }, [data, templateId, loaded]);

  const patch = (changes: Partial<CvData>) => setData((current) => ({ ...current, ...changes }));

  async function prefill() {
    if (!userId) { router.push("/auth"); return; }
    setBusy(true);
    const [profileRes, workRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("work_experience").select("*").eq("user_id", userId).order("start_date", { ascending: false }),
    ]);
    setBusy(false);
    if (profileRes.error || workRes.error) {
      Alert.alert("CV Maker", "Could not load your FirstJobly profile.");
      return;
    }
    const p = profileRes.data;
    if (!p) return;
    patch({
      firstName: p.first_name ?? data.firstName,
      lastName: p.last_name ?? data.lastName,
      email: p.email ?? data.email,
      phone: p.phone ?? data.phone,
      city: p.city ?? data.city,
      province: p.province ?? data.province,
      summary: p.about ?? data.summary,
      skills: (p.skills ?? []).join("\n") || data.skills,
      languages: (p.languages ?? []).join("\n") || data.languages,
      education: p.institution || p.field_of_study || p.highest_qualification
        ? [{ ...emptyEducation(), qualification: p.field_of_study ?? p.highest_qualification ?? "", institution: p.institution ?? "", year: p.year_completed ? String(p.year_completed) : "" }]
        : data.education,
      experience: (workRes.data ?? []).length > 0
        ? (workRes.data ?? []).map((w) => ({ ...emptyExperience(), jobTitle: w.job_title ?? "", company: w.company ?? "", startDate: w.start_date ?? "", endDate: w.end_date ?? "", current: w.currently_working === true, bullets: w.description ?? "" }))
        : data.experience,
    });
    Alert.alert("CV Maker", "Your FirstJobly profile has been added.");
  }

  async function generateSummary() {
    if (!data.headline.trim()) { Alert.alert("AI Assist", "Add your professional title first."); return; }
    setAiBusy("summary");
    try {
      const text = await generateCvText({ purpose: "summary", professionalTitle: data.headline, skills: data.skills, existingText: data.summary });
      patch({ summary: text });
    } catch (error) {
      console.error("CV AI summary failed:", error);
      Alert.alert("AI Assist", "Could not generate the summary right now.");
    } finally { setAiBusy(null); }
  }

  async function generateExperience(index: number) {
    const item = data.experience[index];
    if (!item?.jobTitle.trim()) { Alert.alert("AI Assist", "Add the job title first."); return; }
    setAiBusy(`experience-${index}`);
    try {
      const text = await generateCvText({ purpose: "experience", professionalTitle: data.headline, skills: data.skills, jobTitle: item.jobTitle, company: item.company, existingText: item.bullets });
      patch({ experience: data.experience.map((value, i) => i === index ? { ...value, bullets: text } : value) });
    } catch (error) {
      console.error("CV AI experience failed:", error);
      Alert.alert("AI Assist", "Could not generate work-experience points right now.");
    } finally { setAiBusy(null); }
  }

  async function createPdf() {
    if (!data.firstName.trim() && !data.lastName.trim()) { Alert.alert("CV Maker", "Add your name first."); return; }
    setBusy(true);
    try {
      const result = await Print.printToFileAsync({ html: cvHtml(data, templateId), base64: false });
      const fileName = `${fileBase(data)}.pdf`;
      await savePdfToDownloads(result.uri, fileName);
      Alert.alert("Downloaded", `${fileName} has been saved to your Downloads folder.`);
    } catch (error) {
      console.error("CV PDF failed:", error);
      if (error instanceof Error && error.message === "DOWNLOAD_PERMISSION_DENIED") {
        Alert.alert("Download cancelled", "Choose the Downloads folder when Android asks where FirstJobly may save your PDFs.");
      } else {
        Alert.alert("CV Maker", "Could not download the PDF.");
      }
    } finally { setBusy(false); }
  }

  if (!loaded) {
    return <SafeAreaView style={s.center}><ActivityIndicator color={theme.colors.brand} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.page} edges={["top", "bottom"]}>
      <Header title="CV Maker" />
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: bottomContentPadding }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>Choose the same ATS-safe template used on FirstJobly web, then fill every section you need.</Text>

        <Text style={s.sectionHeading}>1. Choose a template</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={s.templateRow}>
            {TEMPLATE_LIST.map((t) => (
              <TouchableOpacity key={t.id} style={[s.templateCard, templateId === t.id && s.templateCardActive]} onPress={() => setTemplateId(t.id)}>
                <Text style={s.templateName}>{t.name}</Text>
                <Text style={s.templateTag}>{t.tagline}</Text>
                {t.recommended ? <Text style={s.recommended}>Recommended</Text> : null}
                <Text style={s.templateBest}>{t.bestFor}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={s.infoCard}>
          <Text style={s.infoTitle}>{TEMPLATE_LIST.find((t) => t.id === templateId)?.name}</Text>
          <Text style={s.infoText}>{TEMPLATE_LIST.find((t) => t.id === templateId)?.notes}</Text>
        </View>

        {isAuthenticated ? (
          <TouchableOpacity style={s.profileButton} disabled={busy} onPress={() => void prefill()}>
            <Ionicons name="person-circle-outline" size={20} color={theme.colors.ink} />
            <Text style={s.profileText}>Use my FirstJobly profile</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={s.sectionHeading}>2. Fill in your details</Text>

        <Card title="Personal details">
          <Field label="First name" value={data.firstName} onChangeText={(firstName) => patch({ firstName })} />
          <Field label="Last name" value={data.lastName} onChangeText={(lastName) => patch({ lastName })} />
          <Field label="Professional headline" value={data.headline} placeholder="Junior Software Developer" onChangeText={(headline) => patch({ headline })} />
          <Field label="Email" value={data.email} keyboardType="email-address" onChangeText={(email) => patch({ email })} />
          <Field label="Phone" value={data.phone} keyboardType="phone-pad" onChangeText={(phone) => patch({ phone })} />
          <Field label="City" value={data.city} onChangeText={(city) => patch({ city })} />
          <Field label="Province" value={data.province} onChangeText={(province) => patch({ province })} />
          <Field label="LinkedIn / portfolio link" value={data.link} onChangeText={(link) => patch({ link })} />
        </Card>

        <Card title="Professional summary  ✦✦">
          <Field label="Summary" value={data.summary} multiline onChangeText={(summary) => patch({ summary })} />
          <TouchableOpacity style={s.aiButton} disabled={aiBusy === "summary"} onPress={() => void generateSummary()}>
            {aiBusy === "summary" ? <ActivityIndicator color={theme.colors.brand} /> : <Text style={s.aiButtonText}>✦✦ Generate from professional title</Text>}
          </TouchableOpacity>
        </Card>

        <Card title="Work experience">
          {data.experience.map((x, index) => (
            <SubCard key={x.id} title={`Experience ${index + 1}`}>
              <Field label="Job title" value={x.jobTitle} onChangeText={(jobTitle) => patch({ experience: data.experience.map((v, i) => i === index ? { ...v, jobTitle } : v) })} />
              <Field label="Company" value={x.company} onChangeText={(company) => patch({ experience: data.experience.map((v, i) => i === index ? { ...v, company } : v) })} />
              <Field label="Location" value={x.location} onChangeText={(location) => patch({ experience: data.experience.map((v, i) => i === index ? { ...v, location } : v) })} />
              <Field label="Start date" value={x.startDate} placeholder="Jan 2025" onChangeText={(startDate) => patch({ experience: data.experience.map((v, i) => i === index ? { ...v, startDate } : v) })} />
              {!x.current ? <Field label="End date" value={x.endDate} placeholder="Dec 2025" onChangeText={(endDate) => patch({ experience: data.experience.map((v, i) => i === index ? { ...v, endDate } : v) })} /> : null}
              <Toggle label="I currently work here" value={x.current} onValueChange={(current) => patch({ experience: data.experience.map((v, i) => i === index ? { ...v, current } : v) })} />
              <Field label="Achievements / duties" value={x.bullets} multiline placeholder={"Resolved customer queries\nSupported daily operations"} onChangeText={(bullets) => patch({ experience: data.experience.map((v, i) => i === index ? { ...v, bullets } : v) })} />
              <TouchableOpacity style={s.aiButton} disabled={aiBusy === `experience-${index}`} onPress={() => void generateExperience(index)}>
                {aiBusy === `experience-${index}` ? <ActivityIndicator color={theme.colors.brand} /> : <Text style={s.aiButtonText}>✦✦ Help write achievement points</Text>}
              </TouchableOpacity>
              <Remove label="Remove experience" onPress={() => patch({ experience: data.experience.filter((_, i) => i !== index) })} />
            </SubCard>
          ))}
          <Add label="Add work experience" onPress={() => patch({ experience: [...data.experience, emptyExperience()] })} />
        </Card>

        <Card title="Education">
          {data.education.map((x, index) => (
            <SubCard key={x.id} title={`Qualification ${index + 1}`}>
              <Field label="Qualification" value={x.qualification} onChangeText={(qualification) => patch({ education: data.education.map((v, i) => i === index ? { ...v, qualification } : v) })} />
              <Field label="Institution" value={x.institution} onChangeText={(institution) => patch({ education: data.education.map((v, i) => i === index ? { ...v, institution } : v) })} />
              <Field label="NQF level" value={x.nqfLevel} placeholder="NQF 6" onChangeText={(nqfLevel) => patch({ education: data.education.map((v, i) => i === index ? { ...v, nqfLevel } : v) })} />
              <Field label="Year" value={x.year} onChangeText={(year) => patch({ education: data.education.map((v, i) => i === index ? { ...v, year } : v) })} />
              <Field label="Notes" value={x.notes} multiline onChangeText={(notes) => patch({ education: data.education.map((v, i) => i === index ? { ...v, notes } : v) })} />
              <Remove label="Remove qualification" onPress={() => patch({ education: data.education.filter((_, i) => i !== index) })} />
            </SubCard>
          ))}
          <Add label="Add qualification" onPress={() => patch({ education: [...data.education, emptyEducation()] })} />
        </Card>

        <Card title="Core skills"><Field label="One skill per line" value={data.skills} multiline onChangeText={(skills) => patch({ skills })} /></Card>

        <Card title="Certifications">
          <Toggle label="Include certifications" value={data.includeCertifications} onValueChange={(includeCertifications) => patch({ includeCertifications })} />
          {data.includeCertifications ? data.certifications.map((x, index) => (
            <SubCard key={x.id} title={`Certification ${index + 1}`}>
              <Field label="Certification" value={x.name} onChangeText={(name) => patch({ certifications: data.certifications.map((v, i) => i === index ? { ...v, name } : v) })} />
              <Field label="Issuer" value={x.issuer} onChangeText={(issuer) => patch({ certifications: data.certifications.map((v, i) => i === index ? { ...v, issuer } : v) })} />
              <Field label="Year" value={x.year} onChangeText={(year) => patch({ certifications: data.certifications.map((v, i) => i === index ? { ...v, year } : v) })} />
              <Remove label="Remove certification" onPress={() => patch({ certifications: data.certifications.filter((_, i) => i !== index) })} />
            </SubCard>
          )) : null}
          {data.includeCertifications ? <Add label="Add certification" onPress={() => patch({ certifications: [...data.certifications, emptyCertification()] })} /> : null}
        </Card>

        <Card title="Languages">
          <Toggle label="Include languages" value={data.includeLanguages} onValueChange={(includeLanguages) => patch({ includeLanguages })} />
          {data.includeLanguages ? <Field label="One language per line" value={data.languages} multiline onChangeText={(languages) => patch({ languages })} /> : null}
        </Card>

        <Card title="References">
          <Toggle label="References available on request" value={data.referencesOnRequest} onValueChange={(referencesOnRequest) => patch({ referencesOnRequest })} />
          {!data.referencesOnRequest ? data.references.map((x, index) => (
            <SubCard key={x.id} title={`Reference ${index + 1}`}>
              <Field label="Name" value={x.name} onChangeText={(name) => patch({ references: data.references.map((v, i) => i === index ? { ...v, name } : v) })} />
              <Field label="Relationship" value={x.relationship} onChangeText={(relationship) => patch({ references: data.references.map((v, i) => i === index ? { ...v, relationship } : v) })} />
              <Field label="Phone" value={x.phone} keyboardType="phone-pad" onChangeText={(phone) => patch({ references: data.references.map((v, i) => i === index ? { ...v, phone } : v) })} />
              <Field label="Email" value={x.email} keyboardType="email-address" onChangeText={(email) => patch({ references: data.references.map((v, i) => i === index ? { ...v, email } : v) })} />
              <Remove label="Remove reference" onPress={() => patch({ references: data.references.filter((_, i) => i !== index) })} />
            </SubCard>
          )) : null}
          {!data.referencesOnRequest ? <Add label="Add reference" onPress={() => patch({ references: [...data.references, emptyReference()] })} /> : null}
        </Card>

        <TouchableOpacity style={s.primary} disabled={busy} onPress={() => void requestRewardedDownload(createPdf)}>
          {busy ? <ActivityIndicator color={theme.colors.primaryForeground} /> : <><Ionicons name="download-outline" size={20} color={theme.colors.primaryForeground} /><Text style={s.primaryText}>Download PDF</Text></>}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.clear}
          onPress={() => Alert.alert("Start over", "Clear the whole CV?", [
            { text: "Cancel", style: "cancel" },
            { text: "Clear", style: "destructive", onPress: () => setData(emptyCv()) },
          ])}
        >
          <Text style={s.clearText}>Start over</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ title }: { title: string }) {
  return (
    <View style={s.header}>
      <TouchableOpacity style={s.headerIcon} onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={theme.colors.ink} /></TouchableOpacity>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={s.headerIcon} />
    </View>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={s.card}><Text style={s.cardTitle}>{title}</Text>{children}</View>;
}

function SubCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={s.subCard}><Text style={s.subTitle}>{title}</Text>{children}</View>;
}

function Field({ label, multiline, ...props }: { label: string; multiline?: boolean } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput {...props} multiline={multiline} placeholderTextColor={theme.colors.textMuted} style={[s.input, multiline && s.multiline]} />
    </View>
  );
}

function Toggle({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={s.toggle}>
      <Text style={s.toggleText}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: theme.colors.line, true: theme.colors.toolSwitchTrack }} thumbColor={value ? theme.colors.brand : theme.colors.surface} />
    </View>
  );
}

function Add({ label, onPress }: { label: string; onPress: () => void }) {
  return <TouchableOpacity style={s.add} onPress={onPress}><Ionicons name="add" size={18} color={theme.colors.ink} /><Text style={s.addText}>{label}</Text></TouchableOpacity>;
}

function Remove({ label, onPress }: { label: string; onPress: () => void }) {
  return <TouchableOpacity style={s.remove} onPress={onPress}><Ionicons name="trash-outline" size={17} color={theme.colors.danger} /><Text style={s.removeText}>{label}</Text></TouchableOpacity>;
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background },
  header: {
    minHeight: 62,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: theme.colors.ink, fontSize: 18, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 44 },
  intro: { color: theme.colors.inkSoft, fontSize: 13, lineHeight: 20 },
  sectionHeading: { marginTop: 20, marginBottom: 10, color: theme.colors.ink, fontSize: 16, fontWeight: "800" },
  templateRow: { flexDirection: "row", gap: 10, paddingRight: 16 },
  templateCard: {
    width: 180,
    minHeight: 150,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    padding: 13,
    ...theme.shadow.card,
  },
  templateCardActive: { borderColor: theme.colors.brand, borderWidth: 2 },
  templateName: { color: theme.colors.ink, fontWeight: "800", fontSize: 14 },
  templateTag: { color: theme.colors.inkSoft, fontSize: 11, marginTop: 3 },
  recommended: { color: theme.colors.brand, fontWeight: "800", fontSize: 10, marginTop: 8 },
  templateBest: { color: theme.colors.inkSoft, fontSize: 11, lineHeight: 16, marginTop: 8 },
  infoCard: { backgroundColor: theme.colors.brandSoft, borderWidth: 1, borderColor: theme.colors.selectedBorder, borderRadius: theme.radius.md, padding: 12, marginTop: 12 },
  infoTitle: { color: theme.colors.ink, fontWeight: "800" },
  infoText: { color: theme.colors.inkSoft, fontSize: 11, lineHeight: 17, marginTop: 3 },
  profileButton: { height: 48, marginTop: 12, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  profileText: { color: theme.colors.ink, fontWeight: "700" },
  card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, padding: 14, marginBottom: 12, ...theme.shadow.card },
  cardTitle: { color: theme.colors.ink, fontSize: 15, fontWeight: "800" },
  subCard: { marginTop: 12, backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.sm, padding: 12 },
  subTitle: { color: theme.colors.inkSoft, fontWeight: "800", fontSize: 12 },
  field: { marginTop: 11 },
  label: { color: theme.colors.inkSoft, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: { minHeight: 46, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.sm, paddingHorizontal: 11, color: theme.colors.ink },
  multiline: { minHeight: 90, paddingTop: 10, textAlignVertical: "top" },
  toggle: { minHeight: 50, marginTop: 11, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.sm, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.colors.surface },
  toggleText: { flex: 1, color: theme.colors.inkSoft, fontSize: 12, fontWeight: "700" },
  add: { marginTop: 12, height: 44, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center" },
  addText: { color: theme.colors.ink, fontWeight: "700", fontSize: 12 },
  remove: { marginTop: 11, flexDirection: "row", gap: 5, alignItems: "center" },
  removeText: { color: theme.colors.danger, fontSize: 11, fontWeight: "700" },
  aiButton: { minHeight: 42, marginTop: 10, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.colors.selectedBorder, backgroundColor: theme.colors.brandSoft, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  aiButtonText: { color: theme.colors.brand, fontSize: 12, fontWeight: "800" },
  primary: { height: 54, borderRadius: theme.radius.md, backgroundColor: theme.colors.brand, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", marginTop: 6 },
  primaryText: { color: theme.colors.primaryForeground, fontWeight: "800", fontSize: 15 },
  clear: { height: 48, marginTop: 9, alignItems: "center", justifyContent: "center" },
  clearText: { color: theme.colors.danger, fontWeight: "700" },
});
