import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SignatureCanvas from "react-native-signature-canvas";
import { File, Paths } from "expo-file-system";

import { useAuth } from "../hooks/use-auth";
import { supabase } from "../lib/supabase";
import { fillZ83 } from "../lib/z83/fill";
import { savePdfToDownloads } from "../lib/save-pdf";
import { useRewardedDocumentDownload } from "../ads/useRewardedDocumentDownload";
import {
  SA_LANGUAGES,
  deriveInitials,
  emptyJob,
  emptyQualification,
  emptyReference,
  emptyZ83,
  missingRequired,
  type Z83Data,
  type YesNo,
} from "../lib/z83/types";
import { useScreenBottomPadding } from "../hooks/use-screen-bottom-padding";
import { theme } from "../constants/theme";

const BASE_KEY = "firstjobly.z83.base.native.v1";
const TEMPLATE_URL = "https://firstjobly.co.za/forms/z83-2021.pdf";

const sensitiveKeys: (keyof Z83Data)[] = [
  "dateOfBirth", "idNumber", "passportNumber", "race", "gender", "disability", "saCitizen", "nationality",
  "workPermit", "criminalConviction", "criminalDetail", "pendingCriminal", "pendingCriminalDetail",
  "dismissedForMisconduct", "dismissedDetail", "pendingDisciplinary", "pendingDisciplinaryDetail",
  "resignedPendingDisciplinary", "resignedDetail", "dischargedIllHealth", "businessWithState",
  "relinquishBusiness", "yearsPrivate", "yearsPublic", "registrationDate", "registrationNumber", "signature",
];

export default function Z83Screen() {
  const bottomContentPadding = useScreenBottomPadding(false);
  const { userId, isAuthenticated } = useAuth();
  const { requestRewardedDownload } = useRewardedDocumentDownload();
  const [data, setData] = useState<Z83Data>(() => emptyZ83());
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formScrollEnabled, setFormScrollEnabled] = useState(true);

  useEffect(() => {
    void AsyncStorage.getItem(BASE_KEY).then((raw) => {
      if (raw) {
        try { setData((current) => ({ ...current, ...(JSON.parse(raw) as Partial<Z83Data>) })); } catch {}
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const safe = { ...data } as Record<string, unknown>;
    for (const key of sensitiveKeys) delete safe[key];
    void AsyncStorage.setItem(BASE_KEY, JSON.stringify(safe));
  }, [data, loaded]);

  const patch = (changes: Partial<Z83Data>) => setData((current) => ({ ...current, ...changes }));

  async function prefill() {
    if (!userId) { router.push("/auth"); return; }
    setBusy(true);
    const [profileRes, workRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("work_experience").select("*").eq("user_id", userId).order("start_date", { ascending: false }),
    ]);
    setBusy(false);
    if (profileRes.error || workRes.error) {
      Alert.alert("Z83", "Could not load your FirstJobly profile.");
      return;
    }
    const p = profileRes.data;
    if (!p) return;
    const surname = (p.last_name ?? "").toUpperCase();
    const first = p.first_name ?? "";
    const full = surname && first ? `${surname}, ${first}` : p.full_name ?? "";
    const contact = [p.email, p.phone, [p.address, p.city, p.province].filter(Boolean).join(", ")].filter(Boolean).join("\n");
    patch({
      surnameAndNames: full || data.surnameAndNames,
      contactDetails: contact || data.contactDetails,
      initials: deriveInitials(full) || data.initials,
      qualifications: p.institution || p.field_of_study || p.highest_qualification
        ? [{ ...emptyQualification(), institution: p.institution ?? "", qualification: p.field_of_study ?? p.highest_qualification ?? "", year: p.year_completed ? String(p.year_completed) : "" }, ...data.qualifications.slice(1)]
        : data.qualifications,
      jobs: (workRes.data ?? []).length > 0
        ? (workRes.data ?? []).slice(0, 3).map((w) => {
            const from = w.start_date ? new Date(w.start_date) : null;
            const to = w.end_date ? new Date(w.end_date) : null;
            return {
              ...emptyJob(),
              employer: w.company ?? "",
              post: w.job_title ?? "",
              fromMonth: from ? String(from.getMonth() + 1).padStart(2, "0") : "",
              fromYear: from ? String(from.getFullYear()).slice(-2) : "",
              toMonth: w.currently_working || !to ? "" : String(to.getMonth() + 1).padStart(2, "0"),
              toYear: w.currently_working || !to ? "" : String(to.getFullYear()).slice(-2),
              reason: "",
            };
          })
        : data.jobs,
      languages: (p.languages ?? []).length > 0
        ? (p.languages ?? []).slice(0, 5).map((name: string) => ({ name, speak: "", write: "" }))
        : data.languages,
    });
    Alert.alert("Z83", "Profile details added. Check every field before downloading.");
  }

  async function download() {
    const missing = missingRequired(data);
    if (missing.length) {
      const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Some required fields are incomplete",
          missing.map((x) => `• ${x}`).join("\n"),
          [
            { text: "Go back", style: "cancel", onPress: () => resolve(false) },
            { text: "Download anyway", onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      });
      if (!proceed) return;
    }
    setBusy(true);
    try {
      const response = await fetch(TEMPLATE_URL);
      if (!response.ok) throw new Error("Official Z83 template unavailable");
      const template = await response.arrayBuffer();
      const bytes = await fillZ83(data, template);
      const safeName = data.surnameAndNames.trim().replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") || "Application";
      const file = new File(Paths.cache, `Z83_${safeName}.pdf`);
      file.write(bytes);
      const fileName = `Z83_${safeName}.pdf`;
      await savePdfToDownloads(file.uri, fileName);
      Alert.alert("Downloaded", `${fileName} has been saved to your Downloads folder.`);
    } catch (e) {
      console.error("Z83 PDF failed:", e);
      Alert.alert("Z83", "Could not create the official PDF. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  if (!loaded) return <SafeAreaView style={s.center}><ActivityIndicator color={theme.colors.brand} /></SafeAreaView>;

  return (
    <SafeAreaView style={s.page} edges={["top", "bottom"]}>
      <Header />
      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: bottomContentPadding }]}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={formScrollEnabled}
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.intro}>Fill the genuine 2021 Z83. Section A must be completed for each post.</Text>

        <View style={s.privacy}>
          <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.brand} />
          <Text style={s.privacyText}>Your ID number, employment-equity answers, criminal/disciplinary disclosures and signature are not saved to FirstJobly or persistent device storage.</Text>
        </View>

        {isAuthenticated ? (
          <TouchableOpacity style={s.profileBtn} disabled={busy} onPress={() => void prefill()}>
            <Ionicons name="person-circle-outline" size={20} color={theme.colors.ink} />
            <Text style={s.profileText}>Use my FirstJobly profile</Text>
          </TouchableOpacity>
        ) : null}

        <Section title="A. The advertised post" hint="Copy these straight from the advert.">
          <Field label="Position you are applying for (as advertised)" value={data.position} onChangeText={(position) => patch({ position })} />
          <Field label="Department where the position was advertised" value={data.department} onChangeText={(department) => patch({ department })} />
          <Field label="Reference number" value={data.reference} onChangeText={(reference) => patch({ reference })} />
          <Field label="When can you start / notice period?" value={data.availability} onChangeText={(availability) => patch({ availability })} />
        </Section>

        <Section title="B. Personal information" hint="Sensitive answers stay in this app session only.">
          <Field label="Surname and full names" value={data.surnameAndNames} onChangeText={(surnameAndNames) => patch({ surnameAndNames, initials: data.initials || deriveInitials(surnameAndNames) })} />
          <Field label="Date of birth (DD/MM/YYYY)" value={data.dateOfBirth} keyboardType="number-pad" onChangeText={(dateOfBirth) => patch({ dateOfBirth })} />
          <Field label="Identity number" value={data.idNumber} keyboardType="number-pad" maxLength={13} onChangeText={(idNumber) => patch({ idNumber: idNumber.replace(/\D/g, "").slice(0, 13) })} />
          <Field label="Passport number (non-SA applicants only)" value={data.passportNumber} maxLength={13} onChangeText={(passportNumber) => patch({ passportNumber })} />
          <Choice label="Population group" value={data.race} options={[["african", "African"], ["white", "White"], ["coloured", "Coloured"], ["indian", "Indian"], ["other", "Other"]]} onChange={(race) => patch({ race: race as Z83Data["race"] })} />
          <Choice label="Gender" value={data.gender} options={[["female", "Female"], ["male", "Male"]]} onChange={(gender) => patch({ gender: gender as Z83Data["gender"] })} />
          <YesNo label="Do you have a disability?" value={data.disability} onChange={(disability) => patch({ disability })} />
          <YesNo label="Are you a South African citizen?" value={data.saCitizen} onChange={(saCitizen) => patch({ saCitizen })} />
          {data.saCitizen === "no" ? <><Field label="Nationality" value={data.nationality} onChangeText={(nationality) => patch({ nationality })} /><YesNo label="Do you have a valid work permit?" value={data.workPermit} onChange={(workPermit) => patch({ workPermit })} /></> : null}
          <YesNo label="Have you been convicted or found guilty of a criminal offence (including an admission of guilt)?" value={data.criminalConviction} onChange={(criminalConviction) => patch({ criminalConviction })} />
          {data.criminalConviction === "yes" ? <Field label="Provide details" value={data.criminalDetail} multiline onChangeText={(criminalDetail) => patch({ criminalDetail })} /> : null}
          <YesNo label="Do you have any pending criminal case against you?" value={data.pendingCriminal} onChange={(pendingCriminal) => patch({ pendingCriminal })} />
          {data.pendingCriminal === "yes" ? <Field label="Provide details" value={data.pendingCriminalDetail} multiline onChangeText={(pendingCriminalDetail) => patch({ pendingCriminalDetail })} /> : null}
          <YesNo label="Have you ever been dismissed for misconduct from the Public Service?" value={data.dismissedForMisconduct} onChange={(dismissedForMisconduct) => patch({ dismissedForMisconduct })} />
          {data.dismissedForMisconduct === "yes" ? <Field label="Provide details" value={data.dismissedDetail} multiline onChangeText={(dismissedDetail) => patch({ dismissedDetail })} /> : null}
          <YesNo label="Do you have any pending disciplinary case against you?" value={data.pendingDisciplinary} onChange={(pendingDisciplinary) => patch({ pendingDisciplinary })} />
          {data.pendingDisciplinary === "yes" ? <Field label="Provide details" value={data.pendingDisciplinaryDetail} multiline onChangeText={(pendingDisciplinaryDetail) => patch({ pendingDisciplinaryDetail })} /> : null}
          <YesNo label="Have you resigned from a recent job pending disciplinary proceedings?" value={data.resignedPendingDisciplinary} onChange={(resignedPendingDisciplinary) => patch({ resignedPendingDisciplinary })} />
          {data.resignedPendingDisciplinary === "yes" ? <Field label="Provide details" value={data.resignedDetail} multiline onChangeText={(resignedDetail) => patch({ resignedDetail })} /> : null}
          <YesNo label="Have you been discharged or retired from the Public Service on grounds of ill-health, or on a condition preventing re-employment?" value={data.dischargedIllHealth} onChange={(dischargedIllHealth) => patch({ dischargedIllHealth })} />
          <YesNo label="Are you conducting business with the State, or a director of a company doing business with the State?" value={data.businessWithState} onChange={(businessWithState) => patch({ businessWithState })} />
          <YesNo label="If employed in the Public Service, will you immediately relinquish those business interests?" value={data.relinquishBusiness} onChange={(relinquishBusiness) => patch({ relinquishBusiness })} />
          <Field label="Years of experience — private sector" value={data.yearsPrivate} keyboardType="number-pad" onChangeText={(yearsPrivate) => patch({ yearsPrivate })} />
          <Field label="Years of experience — public sector" value={data.yearsPublic} keyboardType="number-pad" onChangeText={(yearsPublic) => patch({ yearsPublic })} />
          <Field label="Professional registration date" value={data.registrationDate} placeholder="02/2024" onChangeText={(registrationDate) => patch({ registrationDate })} />
          <Field label="Registration number" value={data.registrationNumber} onChangeText={(registrationNumber) => patch({ registrationNumber })} />
        </Section>

        <Section title="C. Contact details and medium of communication">
          <Choice label="Preferred language for correspondence" value={data.preferredLanguage} options={SA_LANGUAGES.map((x) => [x, x])} onChange={(preferredLanguage) => patch({ preferredLanguage })} />
          <Choice label="Preferred method of correspondence" value={data.method} options={[["post", "Post"], ["email", "E-mail"], ["fax", "Fax"], ["telephone", "Telephone"]]} onChange={(method) => patch({ method: method as Z83Data["method"] })} />
          <Field label="Contact details" hint="One per line — email, phone and postal address." value={data.contactDetails} multiline onChangeText={(contactDetails) => patch({ contactDetails })} />
        </Section>

        <Section title="D. South African official language proficiency" hint="Up to five languages fit on the official form.">
          {data.languages.map((lang, index) => (
            <Sub key={index} title={`Language ${index + 1}`}>
              <Choice label="Language" value={lang.name} options={SA_LANGUAGES.map((x) => [x, x])} onChange={(name) => patch({ languages: data.languages.map((v, i) => i === index ? { ...v, name } : v) })} />
              <Choice label="Speak" value={lang.speak} options={[["Good", "Good"], ["Fair", "Fair"], ["Poor", "Poor"]]} onChange={(speak) => patch({ languages: data.languages.map((v, i) => i === index ? { ...v, speak } : v) })} />
              <Choice label="Write / read" value={lang.write} options={[["Good", "Good"], ["Fair", "Fair"], ["Poor", "Poor"]]} onChange={(write) => patch({ languages: data.languages.map((v, i) => i === index ? { ...v, write } : v) })} />
              <Remove label="Remove language" onPress={() => patch({ languages: data.languages.filter((_, i) => i !== index) })} />
            </Sub>
          ))}
          {data.languages.length < 5 ? <Add label="Add language" onPress={() => patch({ languages: [...data.languages, { name: "", speak: "", write: "" }] })} /> : null}
        </Section>

        <Section title="E. Formal qualifications" hint="Highest first. Four rows fit on the official form.">
          {data.qualifications.map((q, index) => (
            <Sub key={index} title={`Qualification ${index + 1}`}>
              <Field label="School / college / university" value={q.institution} onChangeText={(institution) => patch({ qualifications: data.qualifications.map((v, i) => i === index ? { ...v, institution } : v) })} />
              <Field label="Qualification obtained" value={q.qualification} onChangeText={(qualification) => patch({ qualifications: data.qualifications.map((v, i) => i === index ? { ...v, qualification } : v) })} />
              <Field label="Year" value={q.year} keyboardType="number-pad" onChangeText={(year) => patch({ qualifications: data.qualifications.map((v, i) => i === index ? { ...v, year } : v) })} />
              <Remove label="Remove qualification" onPress={() => patch({ qualifications: data.qualifications.filter((_, i) => i !== index) })} />
            </Sub>
          ))}
          {data.qualifications.length < 4 ? <Add label="Add qualification" onPress={() => patch({ qualifications: [...data.qualifications, emptyQualification()] })} /> : null}
          <Field label="Current study (institution and qualification)" value={data.currentStudy} onChangeText={(currentStudy) => patch({ currentStudy })} />
        </Section>

        <Section title="F. Work experience" hint="Most recent first. Three rows fit on the official form.">
          {data.jobs.map((job, index) => (
            <Sub key={index} title={`Position ${index + 1}`}>
              <Field label="Employer" value={job.employer} onChangeText={(employer) => patch({ jobs: data.jobs.map((v, i) => i === index ? { ...v, employer } : v) })} />
              <Field label="Post held" value={job.post} onChangeText={(post) => patch({ jobs: data.jobs.map((v, i) => i === index ? { ...v, post } : v) })} />
              <Field label="From month (MM)" value={job.fromMonth} keyboardType="number-pad" maxLength={2} onChangeText={(fromMonth) => patch({ jobs: data.jobs.map((v, i) => i === index ? { ...v, fromMonth } : v) })} />
              <Field label="From year (YY)" value={job.fromYear} keyboardType="number-pad" maxLength={2} onChangeText={(fromYear) => patch({ jobs: data.jobs.map((v, i) => i === index ? { ...v, fromYear } : v) })} />
              <Field label="To month (MM)" value={job.toMonth} keyboardType="number-pad" maxLength={2} onChangeText={(toMonth) => patch({ jobs: data.jobs.map((v, i) => i === index ? { ...v, toMonth } : v) })} />
              <Field label="To year (YY)" value={job.toYear} keyboardType="number-pad" maxLength={2} onChangeText={(toYear) => patch({ jobs: data.jobs.map((v, i) => i === index ? { ...v, toYear } : v) })} />
              <Field label="Reason for leaving" value={job.reason} onChangeText={(reason) => patch({ jobs: data.jobs.map((v, i) => i === index ? { ...v, reason } : v) })} />
              <Remove label="Remove position" onPress={() => patch({ jobs: data.jobs.filter((_, i) => i !== index) })} />
            </Sub>
          ))}
          {data.jobs.length < 3 ? <Add label="Add position" onPress={() => patch({ jobs: [...data.jobs, emptyJob()] })} /> : null}
          <YesNo label="If previously employed in the Public Service, is there any condition preventing your re-appointment?" value={data.prevPublicServiceCondition} onChange={(prevPublicServiceCondition) => patch({ prevPublicServiceCondition })} />
          {data.prevPublicServiceCondition === "yes" ? <Field label="Previous department and nature of the condition" value={data.prevPublicServiceDetail} multiline onChangeText={(prevPublicServiceDetail) => patch({ prevPublicServiceDetail })} /> : null}
        </Section>

        <Section title="G. References" hint="People who agreed to be contacted during office hours.">
          {data.references.map((ref, index) => (
            <Sub key={index} title={`Reference ${index + 1}`}>
              <Field label="Name" value={ref.name} onChangeText={(name) => patch({ references: data.references.map((v, i) => i === index ? { ...v, name } : v) })} />
              <Field label="Relationship to you" value={ref.relationship} onChangeText={(relationship) => patch({ references: data.references.map((v, i) => i === index ? { ...v, relationship } : v) })} />
              <Field label="Telephone (office hours)" value={ref.phone} keyboardType="phone-pad" onChangeText={(phone) => patch({ references: data.references.map((v, i) => i === index ? { ...v, phone } : v) })} />
              <Remove label="Remove reference" onPress={() => patch({ references: data.references.filter((_, i) => i !== index) })} />
            </Sub>
          ))}
          {data.references.length < 3 ? <Add label="Add reference" onPress={() => patch({ references: [...data.references, emptyReference()] })} /> : null}
        </Section>

        <Section title="Declaration and signature" hint="Each Z83 must be signed and each page initialled.">
          <Choice label="How will you sign?" value={data.signMode} options={[["digital", "Sign on screen"], ["print", "Print and sign by hand"]]} onChange={(signMode) => patch({ signMode: signMode as Z83Data["signMode"] })} />
          {data.signMode === "digital" ? (
            <View style={s.signatureWrap}>
              <Text style={s.label}>Draw your signature</Text>
              <View style={s.signature}>
                <SignatureCanvas
                  onOK={(signature) => patch({ signature })}
                  onEmpty={() => patch({ signature: "" })}
                  onBegin={() => setFormScrollEnabled(false)}
                  onEnd={() => setFormScrollEnabled(true)}
                  scrollable={false}
                  nestedScrollEnabled={false}
                  descriptionText="Sign above"
                  clearText="Clear"
                  confirmText="Use signature"
                  webStyle={`.m-signature-pad { box-shadow:none; border:none; } .m-signature-pad--body { border:1px solid ${theme.colors.line}; } .m-signature-pad--footer { margin: 8px; }`}
                />
              </View>
            </View>
          ) : <Text style={s.hint}>The PDF signature line will stay blank so you can sign it in pen.</Text>}
          <Field label="Initials (printed on both pages)" value={data.initials} maxLength={6} onChangeText={(initials) => patch({ initials })} />
          <Field label="Declaration date" value={data.declarationDate} onChangeText={(declarationDate) => patch({ declarationDate })} />
        </Section>

        {missingRequired(data).length > 0 ? (
          <View style={s.warning}>
            <Ionicons name="warning-outline" size={20} color={theme.colors.brand} />
            <View style={{ flex: 1 }}>
              <Text style={s.warningTitle}>Still to complete</Text>
              {missingRequired(data).map((x) => <Text key={x} style={s.warningText}>• {x}</Text>)}
            </View>
          </View>
        ) : null}

        <TouchableOpacity style={s.primary} disabled={busy} onPress={() => void requestRewardedDownload(download)}>
          {busy ? <ActivityIndicator color={theme.colors.primaryForeground} /> : <><Ionicons name="download-outline" size={20} color={theme.colors.primaryForeground} /><Text style={s.primaryText}>Download completed official Z83</Text></>}
        </TouchableOpacity>
        <TouchableOpacity
          style={s.clear}
          onPress={() => Alert.alert("Clear Z83", "Clear this form?", [
            { text: "Cancel", style: "cancel" },
            { text: "Clear", style: "destructive", onPress: async () => { setData(emptyZ83()); await AsyncStorage.removeItem(BASE_KEY); } },
          ])}
        >
          <Text style={s.clearText}>Clear form</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={s.header}>
      <TouchableOpacity style={s.headerIcon} onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color={theme.colors.ink} /></TouchableOpacity>
      <Text style={s.headerTitle}>Z83 Form Filler</Text>
      <View style={s.headerIcon} />
    </View>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return <View style={s.section}><View style={s.sectionHead}><Text style={s.sectionTitle}>{title}</Text>{hint ? <Text style={s.hint}>{hint}</Text> : null}</View><View style={s.sectionBody}>{children}</View></View>;
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={s.sub}><Text style={s.subTitle}>{title}</Text>{children}</View>;
}

function Field({ label, hint, multiline, ...props }: { label: string; hint?: string; multiline?: boolean } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput {...props} multiline={multiline} placeholderTextColor={theme.colors.textMuted} style={[s.input, multiline && s.multiline]} />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: YesNo; onChange: (value: YesNo) => void }) {
  return (
    <View style={s.yesNo}>
      <Text style={s.yesNoLabel}>{label}</Text>
      <View style={s.yesNoButtons}>
        {(["yes", "no"] as const).map((v) => (
          <TouchableOpacity key={v} style={[s.choice, value === v && s.choiceActive]} onPress={() => onChange(value === v ? "" : v)}>
            <Text style={[s.choiceText, value === v && s.choiceTextActive]}>{v === "yes" ? "Yes" : "No"}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: (string | readonly string[])[]; onChange: (value: string) => void }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.choiceWrap}>
        {options.map((raw) => {
          const pair = Array.isArray(raw) ? raw : [raw, raw];
          const key = String(pair[0]);
          const text = String(pair[1]);
          return (
            <TouchableOpacity key={key} style={[s.choice, value === key && s.choiceActive]} onPress={() => onChange(value === key ? "" : key)}>
              <Text style={[s.choiceText, value === key && s.choiceTextActive]}>{text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function Add({ label, onPress }: { label: string; onPress: () => void }) {
  return <TouchableOpacity style={s.add} onPress={onPress}><Ionicons name="add" size={17} color={theme.colors.ink} /><Text style={s.addText}>{label}</Text></TouchableOpacity>;
}

function Remove({ label, onPress }: { label: string; onPress: () => void }) {
  return <TouchableOpacity style={s.remove} onPress={onPress}><Ionicons name="trash-outline" size={16} color={theme.colors.danger} /><Text style={s.removeText}>{label}</Text></TouchableOpacity>;
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background },
  header: { minHeight: 62, backgroundColor: theme.colors.background, borderBottomWidth: 1, borderBottomColor: theme.colors.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  headerIcon: { width: 42, height: 42, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: theme.colors.ink, fontSize: 17, fontWeight: "800" },
  content: { padding: 16, paddingBottom: 46 },
  intro: { color: theme.colors.inkSoft, fontSize: 13, lineHeight: 20 },
  privacy: { marginTop: 12, padding: 13, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.selectedBorder, backgroundColor: theme.colors.brandSoft, flexDirection: "row", gap: 9 },
  privacyText: { flex: 1, color: theme.colors.inkSoft, fontSize: 11, lineHeight: 18 },
  profileBtn: { height: 48, marginTop: 12, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  profileText: { color: theme.colors.ink, fontWeight: "700" },
  section: { marginTop: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md, overflow: "hidden", ...theme.shadow.card },
  sectionHead: { padding: 14, borderBottomWidth: 2, borderBottomColor: theme.colors.brand },
  sectionTitle: { color: theme.colors.ink, fontSize: 15, fontWeight: "800" },
  sectionBody: { padding: 14 },
  hint: { color: theme.colors.inkSoft, fontSize: 10.5, lineHeight: 16, marginTop: 4 },
  sub: { backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.sm, padding: 11, marginTop: 10 },
  subTitle: { color: theme.colors.inkSoft, fontWeight: "800", fontSize: 11 },
  field: { marginTop: 11 },
  label: { color: theme.colors.inkSoft, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: { minHeight: 46, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.sm, paddingHorizontal: 11, color: theme.colors.ink },
  multiline: { minHeight: 88, paddingTop: 10, textAlignVertical: "top" },
  yesNo: { borderBottomWidth: 1, borderBottomColor: theme.colors.line, paddingVertical: 12 },
  yesNoLabel: { color: theme.colors.inkSoft, fontSize: 12, lineHeight: 18 },
  yesNoButtons: { flexDirection: "row", gap: 7, marginTop: 8 },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choice: { minHeight: 38, paddingHorizontal: 13, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center" },
  choiceActive: { backgroundColor: theme.colors.brand, borderColor: theme.colors.brand },
  choiceText: { color: theme.colors.inkSoft, fontSize: 11, fontWeight: "700" },
  choiceTextActive: { color: theme.colors.primaryForeground },
  add: { height: 43, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center", marginTop: 11 },
  addText: { color: theme.colors.ink, fontSize: 11, fontWeight: "700" },
  remove: { flexDirection: "row", gap: 5, alignItems: "center", marginTop: 10 },
  removeText: { color: theme.colors.danger, fontSize: 10.5, fontWeight: "700" },
  signatureWrap: { marginTop: 11 },
  signature: { height: 240, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.sm, overflow: "hidden", marginTop: 6 },
  warning: { marginTop: 14, padding: 13, borderWidth: 1, borderColor: theme.colors.selectedBorder, backgroundColor: theme.colors.brandSoft, borderRadius: theme.radius.md, flexDirection: "row", gap: 8 },
  warningTitle: { color: theme.colors.ink, fontWeight: "800", fontSize: 12 },
  warningText: { color: theme.colors.inkSoft, fontSize: 11, lineHeight: 17 },
  primary: { height: 55, marginTop: 16, borderRadius: theme.radius.md, backgroundColor: theme.colors.brand, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  primaryText: { color: theme.colors.primaryForeground, fontWeight: "800", fontSize: 14 },
  clear: { height: 48, alignItems: "center", justifyContent: "center" },
  clearText: { color: theme.colors.danger, fontWeight: "700" },
});
