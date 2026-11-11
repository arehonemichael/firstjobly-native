import { useEffect, useState } from "react";
import { Image } from "expo-image";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowRight, Bookmark, BookmarkCheck, BriefcaseBusiness, ClipboardList, GraduationCap, MapPin, Search, User, MessageCircle, Sparkles } from "lucide-react-native";
import { AppText as Text, AppPressable as Pressable } from "../../components/ui/primitives";
import { EmptyState, InlineErrorState, SkeletonJobCard } from "../../components/ui/app-ui";
import { IdentityImage } from "../../components/ui/identity-image";
import { JobMetadata } from "../../components/ui/job-metadata";
import { Colors, Fonts, Layout, Radius, Space } from "../../constants/theme";
import { useAuth } from "../../hooks/use-auth";
import { useHomeSummary } from "../../hooks/use-home-summary";
import { useSavedJobs } from "../../hooks/use-saved-jobs";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { useEarlyJobInterstitial } from "../../ads/useJobInterstitial";
import { getJobs } from "../../lib/job-api";
import { categoryLabel } from "../../lib/job-filters";
import type { Job } from "../../lib/jobs";

const categories = [
  { label: "Learnerships", category: "learnership", icon: GraduationCap },
  { label: "Internships", category: "internship", icon: BriefcaseBusiness },
  { label: "Graduate roles", category: "graduate_programme", icon: GraduationCap },
  { label: "Government", category: "government", icon: BriefcaseBusiness },
];

export default function HomeScreen() {
  const { user, userId, loading: authLoading } = useAuth();
  const { summary, loading: summaryLoading, retry } = useHomeSummary(userId);
  const { savedIds, loading: savedLoading, error: savedError, canSave, toggleSave, refreshSaved } = useSavedJobs();
  const { openJobWithEarlyInterstitial } = useEarlyJobInterstitial();
  const bottom = useScreenBottomPadding(true);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const firstName = String(summary?.profile?.first_name || user?.user_metadata?.full_name || user?.user_metadata?.name || "").trim().split(/\s+/)[0];
  const photo = typeof user?.user_metadata?.avatar_url === "string" ? user.user_metadata.avatar_url : null;
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const draft = summary?.applications?.find((item) => item.is_draft && item.jobs);
  const completion = summary?.completion;
  const province = summary?.profile?.preferred_province;

  useEffect(() => {
    let active = true;
    getJobs(0).then((data) => { if (active) setJobs(data.slice(0, 6)); })
      .catch(() => { if (active) setError("We couldn’t load opportunities. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  function reload() { setError(null); setLoading(true); setRevision((value) => value + 1); }
  function openJob(job: Job) { void openJobWithEarlyInterstitial(() => router.push({ pathname: "/jobs/[id]", params: { id: job.id } })); }
  async function save(job: Job) {
    if (!canSave) { router.push({ pathname: "/auth", params: { returnTo: "/" } }); return; }
    setSaving(job.id); setSaveError(null);
    try {
      const result = await toggleSave(job.id);
      if (!result.ok) setSaveError("Your saved jobs couldn’t be updated. Please try again.");
    } finally { setSaving(null); }
  }

  function jobCard(job: Job, featured: boolean) {
    const saved = savedIds.includes(job.id);
    return <View key={job.id} style={[styles.jobCard, featured && styles.featuredCard]}>
      <View style={[styles.cardTop, featured && styles.featuredTop]}>
        <View style={styles.companyRow}>
          <IdentityImage uri={job.company_logo_url} name={job.company_name} size={36} />
          <View style={styles.grow} />
          {job.is_urgent && <Text style={styles.urgent}>Urgent opportunity</Text>}
        </View>
        <Text style={styles.caption}>{job.company_name}{job.job_type ? ` · ${job.job_type.replace(/_/g, " ")}` : ""}</Text>
        <Text accessibilityRole="header" style={[styles.jobTitle, featured && styles.featuredTitle]}>{job.title}</Text>
      </View>
      <View style={styles.cardBottom}>
        <View style={styles.companyRow}>
          <View style={styles.grow}>
            {!!(job.city || job.province) && <View style={styles.location}><MapPin aria-hidden size={13} color={Colors.muted} /><Text style={styles.meta}>{[job.city, job.province].filter(Boolean).join(", ")}</Text></View>}
            <JobMetadata job={job} showJobType={false} />
          </View>
          <Pressable accessibilityLabel={savedError ? "Saved status unavailable" : `${saved ? "Unsave" : "Save"} ${job.title}`} accessibilityState={{ selected: saved, busy: saving === job.id || savedLoading }} aria-pressed={savedError ? undefined : saved} disabled={savedLoading || saving !== null || !!savedError} onPress={() => void save(job)} style={({ pressed, hovered }) => [styles.save, saved && styles.saved, (pressed || hovered) && styles.feedback]}>
            {saving === job.id || savedLoading ? <ActivityIndicator size="small" color={Colors.primaryPressed} /> : saved ? <BookmarkCheck aria-hidden size={19} color={Colors.primaryPressed} /> : <Bookmark aria-hidden size={19} color={Colors.muted} />}
          </Pressable>
        </View>
        <View style={styles.jobFooter}>
          <Text style={styles.categoryChip}>{categoryLabel(job.category)}</Text>
          <Pressable accessibilityLabel={`View ${job.title}`} onPress={() => openJob(job)} style={({ pressed, hovered }) => [styles.detailLink, (pressed || hovered) && styles.feedback]}>
            <Text style={styles.roleLink}>View role</Text><ArrowRight aria-hidden size={16} color={Colors.primaryPressed} />
          </Pressable>
        </View>
      </View>
    </View>;
  }

  return <SafeAreaView style={styles.page} edges={["top"]}>
    <ScrollView nativeID="home-scroll" contentContainerStyle={[styles.content, { paddingBottom: bottom + Space.lg }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.brand}><Image accessible={false} source={require("../../../assets/images/icon.png")} style={styles.brandIcon} contentFit="contain" /><Text accessibilityLabel="FirstJobly" style={styles.wordmark}>firstjobly</Text></View>
        <View style={styles.headerActions}>
          <Pressable accessibilityLabel="Search jobs or companies" onPress={() => router.push("/jobs")} style={styles.headerButton}><Search aria-hidden size={19} color={Colors.foreground} /></Pressable>
          <Pressable accessibilityLabel="Open Graduate Room" onPress={() => router.push("/graduateroom")} style={styles.headerButton}><MessageCircle aria-hidden size={20} color={Colors.foreground} /></Pressable>
        </View>
      </View>
      <View style={styles.intro}>
        <View style={styles.greetingRow}>
          <View style={styles.grow}>
            <Text style={styles.eyebrow}>{now.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}</Text>
            <Text accessibilityRole="header" style={styles.greeting}>{firstName ? <>{greeting},{"\n"}<Text style={styles.greetingName}>{firstName}.</Text></> : <>Your next chapter{"\n"}<Text style={styles.greetingName}>starts here.</Text></>}</Text>
          </View>
          <Pressable accessibilityLabel="Open profile" onPress={() => router.push("/profile")} style={styles.account}><IdentityImage uri={photo} name={firstName} size={48} portrait /></Pressable>
        </View>
        <Text style={styles.supporting}>{province ? `A fresh look at opportunities in ${province}.` : "A good next step is closer than you think."}</Text>
      </View>
      {authLoading || (userId && summaryLoading && !summary) ? <View accessibilityLabel="Loading your overview"><SkeletonJobCard /></View> : !userId ? <Pressable onPress={() => router.push("/auth")} style={({ pressed }) => [styles.progressCard, pressed && styles.feedback]}>
        <View style={styles.row}><View style={styles.progressIcon}><User aria-hidden size={18} color={Colors.primaryPressed} /></View><View style={styles.grow}><Text style={styles.progressTitle}>Your next move starts here</Text><Text style={styles.panelCopy}>Sign in to save jobs and track applications.</Text></View><View style={styles.progressArrow}><ArrowRight aria-hidden size={17} color={Colors.primaryPressed} /></View></View>
      </Pressable> : <>
        {summary?.failed && <InlineErrorState message="Some of your overview couldn’t load." onRetry={retry} />}
        {draft?.jobs ? <Pressable accessibilityLabel={`Continue application for ${draft.jobs.title}`} onPress={() => router.push({ pathname: "/jobs/[id]", params: { id: draft.jobs!.id } })} style={({ pressed }) => [styles.progressCard, pressed && styles.feedback]}>
          <View style={styles.row}><View style={styles.progressIcon}><ClipboardList aria-hidden size={18} color={Colors.primaryPressed} /></View><View style={styles.grow}><Text style={styles.progressTitle}>{draft.jobs.title}</Text><Text style={styles.panelCopy}>{draft.jobs.company_name} · Draft application</Text></View><View style={styles.progressArrow}><ArrowRight aria-hidden size={17} color={Colors.primaryPressed} /></View></View><Text style={[styles.link, { marginTop: 10 }]}>Continue application</Text>
        </Pressable> : completion !== null && completion !== undefined && completion < 100 ? <Pressable accessibilityLabel={`Profile ${completion}% complete. Complete your profile`} onPress={() => router.push("/profile")} style={({ pressed }) => [styles.progressCard, pressed && styles.feedback]}>
          <View style={styles.row}><View style={styles.progressIcon}><Sparkles aria-hidden size={18} color={Colors.primaryPressed} /></View><View style={styles.grow}><Text style={styles.progressTitle}>{completion === 0 ? "Let’s start with you" : "Your search is taking shape"}</Text><Text style={styles.panelCopy}>Add your details for Easy Apply.</Text></View><View style={styles.progressArrow}><ArrowRight aria-hidden size={17} color={Colors.primaryPressed} /></View></View>
          <View style={styles.progressFooter}>
            <View accessibilityRole="progressbar" accessibilityLabel="Profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion} accessibilityValue={{ min: 0, max: 100, now: completion }} style={styles.segments}>
              {[0, 1, 2, 3].map((part) => <View key={part} style={styles.segment}><View style={[styles.fill, { width: `${Math.max(0, Math.min(1, completion / 25 - part)) * 100}%` }]} /></View>)}
            </View><Text style={styles.progressNumber}>{completion}%</Text>
          </View>
        </Pressable> : null}
      </>}
      <View style={styles.sectionHeader}><View style={styles.grow}><Text style={styles.eyebrow}>EXPLORE YOUR NEXT STEP</Text><Text accessibilityRole="header" style={styles.sectionTitle}>Latest opportunities</Text></View><Pressable accessibilityLabel="Browse all jobs" onPress={() => router.push("/jobs")} style={styles.browse}><Text style={styles.roleLink}>See all</Text><ArrowRight aria-hidden size={15} color={Colors.primaryPressed} /></Pressable></View>
      {!!savedError && userId && <InlineErrorState message="Saved jobs are unavailable." onRetry={() => void refreshSaved()} />}
      {!!saveError && <InlineErrorState message={saveError} onRetry={() => setSaveError(null)} />}
      {loading ? <View style={styles.jobList}><SkeletonJobCard /><SkeletonJobCard /></View> : error ? <InlineErrorState message={error} onRetry={reload} /> : !jobs.length ? <EmptyState title="No opportunities yet" message="Check back soon, or explore job search." actionLabel="Search jobs" onAction={() => router.push("/jobs")} /> : <View style={styles.jobList}>{jobs.map((job, index) => jobCard(job, index === 0))}</View>}
      {!!userId && <View style={styles.quickLinks}>
        <Pressable onPress={() => router.push("/saved")} style={styles.quickLink}><Bookmark aria-hidden size={17} color={Colors.primaryPressed} /><Text style={styles.link}>{summary?.savedCount ? `${summary.savedCount} saved jobs` : "Saved jobs"}</Text></Pressable>
        <Pressable onPress={() => router.push("/applications")} style={styles.quickLink}><ClipboardList aria-hidden size={17} color={Colors.primaryPressed} /><Text style={styles.link}>Applications</Text></Pressable>
      </View>}
      <View style={styles.exploreHeader}><Text accessibilityRole="header" style={styles.sectionTitle}>Find your starting point</Text><Text style={styles.supporting}>Explore a path that interests you.</Text></View>
      <View style={styles.categories}>{categories.map(({ label, category, icon: Glyph }) => <Pressable key={category} onPress={() => router.push({ pathname: "/jobs", params: { category } })} style={({ pressed, hovered }) => [styles.category, (pressed || hovered) && styles.feedback]}><Glyph aria-hidden size={19} color={Colors.primaryPressed} /><Text style={[styles.link, styles.grow]}>{label}</Text><ArrowRight aria-hidden size={16} color={Colors.muted} /></Pressable>)}</View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 22, width: "100%", maxWidth: Layout.reading, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: Space.lg, paddingBottom: Space.xl },
  brand: { flexDirection: "row", gap: Space.sm, alignItems: "center" },
  brandIcon: { width: 30, height: 30, borderRadius: 9 },
  wordmark: { fontFamily: Fonts.bold, fontSize: 15, letterSpacing: -0.6, color: Colors.foreground },
  headerActions: { flexDirection: "row", gap: 2 },
  headerButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: Radius.pill, backgroundColor: Colors.surface },
  account: { minWidth: 52, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: Radius.pill, backgroundColor: Colors.primarySoft, borderWidth: 2, borderColor: Colors.surface, marginTop: Space.xs },
  intro: { paddingBottom: Space.xl, paddingTop: Space.xs },
  greetingRow: { flexDirection: "row", gap: Space.sm, alignItems: "flex-start" },
  eyebrow: { fontSize: 9, lineHeight: 15, letterSpacing: 1.4, textTransform: "uppercase", fontFamily: Fonts.semibold, color: Colors.muted, flexShrink: 1 },
  greeting: { fontFamily: Fonts.editorial, fontSize: 32, lineHeight: 36, letterSpacing: -1.6, marginTop: Space.sm, color: Colors.foreground },
  greetingName: { fontFamily: Fonts.editorialItalic },
  supporting: { fontSize: 12, lineHeight: 19, color: Colors.muted, marginTop: Space.md },
  progressCard: { padding: Space.lg, borderRadius: Radius.md, backgroundColor: Colors.primarySoft, borderWidth: 1, borderColor: Colors.primaryBorder },
  progressIcon: { width: 30, height: 30, borderRadius: Radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surface },
  progressTitle: { fontFamily: Fonts.semibold, fontSize: 11, lineHeight: 17, color: Colors.foreground },
  panelCopy: { fontSize: 10, lineHeight: 16, marginTop: 2, color: Colors.muted },
  progressArrow: { width: 30, height: 30, borderRadius: Radius.pill, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center" },
  progressFooter: { flexDirection: "row", alignItems: "center", gap: Space.sm, marginTop: Space.md },
  segments: { flex: 1, flexDirection: "row", gap: 5 },
  segment: { flex: 1, height: 4, borderRadius: Radius.pill, backgroundColor: Colors.primaryBorder, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: Colors.primaryPressed, borderRadius: Radius.pill },
  progressNumber: { fontFamily: Fonts.medium, fontSize: 10, color: Colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  grow: { flex: 1, minWidth: 0 },
  link: { color: Colors.primaryPressed, fontFamily: Fonts.semibold, fontSize: 12, lineHeight: 18 },
  quickLinks: { flexDirection: "row", flexWrap: "wrap", columnGap: Space.xl, marginTop: Space.sm },
  quickLink: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: Space.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: Space.sm, marginTop: Space.xl, marginBottom: Space.md },
  sectionTitle: { fontFamily: Fonts.editorial, fontSize: 23, lineHeight: 30, letterSpacing: -0.9, marginTop: 3 },
  browse: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: Space.xs },
  roleLink: { color: Colors.primaryPressed, fontFamily: Fonts.medium, fontSize: 13, lineHeight: 20 },
  jobList: { gap: Space.lg },
  jobCard: { borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  featuredCard: { borderColor: Colors.primaryBorder },
  cardTop: { padding: Space.lg, backgroundColor: Colors.secondary },
  featuredTop: { backgroundColor: Colors.primarySoft },
  cardBottom: { paddingHorizontal: Space.lg, paddingTop: Space.sm, paddingBottom: Space.sm, backgroundColor: Colors.surface },
  companyRow: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  caption: { fontSize: 10, lineHeight: 16, color: Colors.muted, marginTop: Space.sm },
  save: { width: 44, height: 44, borderRadius: Radius.pill, backgroundColor: Colors.secondary, alignItems: "center", justifyContent: "center" },
  saved: { backgroundColor: Colors.primarySoft },
  jobTitle: { fontFamily: Fonts.semibold, fontSize: 17, lineHeight: 24, marginTop: 3, color: Colors.foreground },
  featuredTitle: { fontSize: 19, lineHeight: 26, letterSpacing: -0.5 },
  location: { flexDirection: "row", gap: Space.xs, alignItems: "flex-start" },
  meta: { fontSize: 11, lineHeight: 17, color: Colors.muted, flex: 1 },
  jobFooter: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: Space.sm, marginTop: Space.xs },
  categoryChip: { fontSize: 10, lineHeight: 16, color: Colors.muted, backgroundColor: Colors.secondary, borderRadius: Radius.pill, paddingHorizontal: Space.sm, paddingVertical: 4 },
  urgent: { fontSize: 10, color: Colors.primaryPressed, paddingVertical: 4, paddingHorizontal: Space.sm, backgroundColor: Colors.surface, borderRadius: Radius.pill },
  detailLink: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: Space.sm },
  feedback: { opacity: 0.72 },
  exploreHeader: { marginTop: Space.xxl, marginBottom: Space.md },
  categories: { gap: Space.xs },
  category: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: Space.md, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: Space.sm },
});
