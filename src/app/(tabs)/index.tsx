import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowRight, Bookmark, BookmarkCheck, BriefcaseBusiness, ClipboardList, GraduationCap, MapPin, Search, User } from "lucide-react-native";
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
      <View style={styles.companyRow}>
        <IdentityImage uri={job.company_logo_url} name={job.company_name} size={featured ? 52 : 44} />
        <View style={styles.grow}><Text style={styles.company}>{job.company_name}</Text><Text style={styles.caption}>{categoryLabel(job.category)}</Text></View>
        <Pressable accessibilityLabel={savedError ? "Saved status unavailable" : `${saved ? "Unsave" : "Save"} ${job.title}`} accessibilityState={{ selected: saved, busy: saving === job.id || savedLoading }} aria-pressed={savedError ? undefined : saved} disabled={savedLoading || saving !== null || !!savedError} onPress={() => void save(job)} style={({ pressed, hovered }) => [styles.save, saved && styles.saved, (pressed || hovered) && styles.feedback]}>
          {saving === job.id || savedLoading ? <ActivityIndicator size="small" color={Colors.primaryPressed} /> : saved ? <BookmarkCheck aria-hidden size={21} color={Colors.primaryPressed} /> : <Bookmark aria-hidden size={21} color={Colors.foreground} />}
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={[styles.jobTitle, featured && styles.featuredTitle]}>{job.title}</Text>
      {!!(job.city || job.province) && <View style={styles.location}><MapPin aria-hidden size={15} color={Colors.muted} /><Text style={styles.meta}>{[job.city, job.province].filter(Boolean).join(", ")}</Text></View>}
      <JobMetadata job={job} />
      {featured && !!job.description && <Text numberOfLines={3} style={styles.description}>{job.description.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}</Text>}
      <View style={styles.jobFooter}>
        <Text style={styles.jobNote}>{job.is_urgent ? "Urgent opportunity" : job.apply_type === "easy_apply" ? "Easy Apply available" : "View application details"}</Text>
        <Pressable accessibilityLabel={`View ${job.title}`} onPress={() => openJob(job)} style={({ pressed, hovered }) => [featured ? styles.detailButton : styles.detailLink, (pressed || hovered) && styles.feedback]}>
          <Text style={featured ? styles.detailButtonText : styles.link}>View {featured ? "opportunity" : "details"}</Text><ArrowRight aria-hidden size={17} color={featured ? Colors.surface : Colors.primaryPressed} />
        </Pressable>
      </View>
    </View>;
  }

  return <SafeAreaView style={styles.page} edges={["top"]}>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottom + Space.lg }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text accessibilityLabel="FirstJobly" style={styles.wordmark}>First<Text style={{ color: Colors.foreground }}>Jobly</Text></Text>
        <Pressable accessibilityLabel="Open profile" onPress={() => router.push("/profile")} style={styles.account}><IdentityImage uri={photo} name={firstName} size={42} portrait /></Pressable>
      </View>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>{now.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long" })}</Text>
        <Text accessibilityRole="header" style={styles.greeting}>{firstName ? `${greeting},\n${firstName}.` : "Your next chapter\nstarts here."}</Text>
        <Text style={styles.supporting}>{province ? `A fresh look at opportunities in ${province}.` : "A little direction for your next big step."}</Text>
      </View>
      {authLoading || (userId && summaryLoading && !summary) ? <View accessibilityLabel="Loading your overview"><SkeletonJobCard /></View> : !userId ? <Pressable onPress={() => router.push("/auth")} style={({ pressed }) => [styles.progressCard, pressed && styles.feedback]}>
        <View style={styles.row}><User aria-hidden size={20} color={Colors.primaryPressed} /><Text style={styles.eyebrow}>MAKE YOURSELF AT HOME</Text><ArrowRight aria-hidden size={18} color={Colors.primaryPressed} /></View>
        <Text style={styles.progressTitle}>Your next move, in one place.</Text><Text style={styles.supporting}>Sign in to save opportunities and keep track of applications.</Text>
      </Pressable> : <>
        {summary?.failed && <InlineErrorState message="Some of your overview couldn’t load." onRetry={retry} />}
        {draft?.jobs ? <Pressable onPress={() => router.push({ pathname: "/jobs/[id]", params: { id: draft.jobs!.id } })} style={({ pressed }) => [styles.progressCard, pressed && styles.feedback]}>
          <Text style={styles.eyebrow}>PICK UP WHERE YOU LEFT OFF</Text><Text style={styles.progressTitle}>{draft.jobs.title}</Text><Text style={styles.supporting}>{draft.jobs.company_name} · Draft application</Text><View style={styles.actionRow}><Text style={styles.link}>Continue application</Text><ArrowRight aria-hidden size={18} color={Colors.primaryPressed} /></View>
        </Pressable> : completion !== null && completion !== undefined && completion < 100 ? <Pressable accessibilityLabel={`Profile ${completion}% complete. Complete your profile`} onPress={() => router.push("/profile")} style={({ pressed }) => [styles.progressCard, pressed && styles.feedback]}>
          <View style={styles.row}><Text style={[styles.eyebrow, styles.grow]}>YOUR NEXT STEP</Text><Text style={styles.progressNumber}>{completion}%</Text></View>
          <Text style={styles.progressTitle}>{completion === 0 ? "Let’s start with you." : "A little more you."}</Text><Text style={styles.supporting}>Add your details and documents for Easy Apply.</Text>
          <View accessibilityRole="progressbar" accessibilityLabel="Profile completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion} accessibilityValue={{ min: 0, max: 100, now: completion }} style={styles.track}><View style={[styles.fill, { width: `${completion}%` }]} /></View>
          <View style={styles.actionRow}><Text style={styles.link}>Complete your profile</Text><ArrowRight aria-hidden size={18} color={Colors.primaryPressed} /></View>
        </Pressable> : null}
        <View style={styles.quickLinks}>
          <Pressable onPress={() => router.push("/saved")} style={styles.quickLink}><Bookmark aria-hidden size={17} color={Colors.primaryPressed} /><Text style={styles.link}>{summary?.savedCount ? `${summary.savedCount} saved jobs` : "Saved jobs"}</Text></Pressable>
          <Pressable onPress={() => router.push("/applications")} style={styles.quickLink}><ClipboardList aria-hidden size={17} color={Colors.primaryPressed} /><Text style={styles.link}>Applications</Text></Pressable>
        </View>
      </>}
      <View style={styles.sectionHeader}><View style={styles.grow}><Text style={styles.eyebrow}>A PLACE TO BEGIN</Text><Text accessibilityRole="header" style={styles.sectionTitle}>Latest opportunities</Text></View><Pressable accessibilityLabel="Browse all jobs" onPress={() => router.push("/jobs")} style={styles.browse}><ArrowRight aria-hidden size={22} color={Colors.foreground} /></Pressable></View>
      <Pressable accessibilityLabel="Search jobs or companies" onPress={() => router.push("/jobs")} style={({ pressed, hovered }) => [styles.search, (pressed || hovered) && styles.feedback]}><Search aria-hidden size={19} color={Colors.muted} /><Text style={[styles.supporting, styles.grow, { marginTop: 0 }]}>Search jobs or companies</Text><ArrowRight aria-hidden size={17} color={Colors.muted} /></Pressable>
      {!!savedError && userId && <InlineErrorState message="Saved jobs are unavailable." onRetry={() => void refreshSaved()} />}
      {!!saveError && <InlineErrorState message={saveError} onRetry={() => setSaveError(null)} />}
      {loading ? <View style={styles.jobList}><SkeletonJobCard /><SkeletonJobCard /></View> : error ? <InlineErrorState message={error} onRetry={reload} /> : !jobs.length ? <EmptyState title="No opportunities yet" message="Check back soon, or explore job search." actionLabel="Search jobs" onAction={() => router.push("/jobs")} /> : <View style={styles.jobList}>{jobs.map((job, index) => jobCard(job, index === 0))}</View>}
      <View style={styles.exploreHeader}><Text accessibilityRole="header" style={styles.sectionTitle}>Find your starting point</Text><Text style={styles.supporting}>Explore a path that interests you.</Text></View>
      <View style={styles.categories}>{categories.map(({ label, category, icon: Glyph }) => <Pressable key={category} onPress={() => router.push({ pathname: "/jobs", params: { category } })} style={({ pressed, hovered }) => [styles.category, (pressed || hovered) && styles.feedback]}><Glyph aria-hidden size={19} color={Colors.primaryPressed} /><Text style={[styles.link, styles.grow]}>{label}</Text><ArrowRight aria-hidden size={16} color={Colors.muted} /></Pressable>)}</View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Space.xl, width: "100%", maxWidth: Layout.reading, alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: Space.sm, paddingBottom: Space.xl },
  wordmark: { fontFamily: Fonts.bold, fontSize: 23, letterSpacing: -0.8, color: Colors.primary },
  account: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: Radius.pill },
  intro: { paddingTop: Space.sm, paddingBottom: Space.xl },
  eyebrow: { fontSize: 10, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase", fontFamily: Fonts.semibold, color: Colors.muted, flexShrink: 1 },
  greeting: { fontFamily: Fonts.editorial, fontSize: 36, lineHeight: 45, letterSpacing: -1.2, marginTop: Space.md, color: Colors.foreground },
  supporting: { fontSize: 13, lineHeight: 21, color: Colors.muted, marginTop: Space.sm },
  progressCard: { padding: Space.lg, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  progressTitle: { fontFamily: Fonts.editorial, fontSize: 22, lineHeight: 30, marginTop: Space.sm },
  row: { flexDirection: "row", alignItems: "center", gap: Space.sm },
  grow: { flex: 1, minWidth: 0 },
  progressNumber: { fontFamily: Fonts.semibold, fontSize: 13, color: Colors.primaryPressed },
  track: { height: 4, backgroundColor: Colors.secondary, borderRadius: Radius.pill, marginTop: Space.lg, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: Colors.primary, borderRadius: Radius.pill },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: Space.lg, gap: Space.md },
  link: { color: Colors.primaryPressed, fontFamily: Fonts.semibold, fontSize: 12, lineHeight: 18 },
  quickLinks: { flexDirection: "row", flexWrap: "wrap", columnGap: Space.xl, marginTop: Space.sm },
  quickLink: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: Space.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: Space.md, marginTop: Space.xxl, marginBottom: Space.lg },
  sectionTitle: { fontFamily: Fonts.editorial, fontSize: 25, lineHeight: 33, letterSpacing: -0.6, marginTop: Space.xs },
  browse: { width: 44, height: 44, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, alignItems: "center", justifyContent: "center", backgroundColor: Colors.surface },
  search: { minHeight: 48, borderBottomWidth: 1, borderColor: Colors.input, flexDirection: "row", alignItems: "center", gap: Space.md, marginBottom: Space.lg, paddingHorizontal: Space.xs },
  jobList: { gap: Space.lg },
  jobCard: { borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, padding: Space.lg },
  featuredCard: { padding: Space.xl, backgroundColor: Colors.primarySoft, borderColor: Colors.primaryBorder },
  companyRow: { flexDirection: "row", alignItems: "center", gap: Space.md },
  company: { fontFamily: Fonts.semibold, fontSize: 13, lineHeight: 20 },
  caption: { fontSize: 11, lineHeight: 17, color: Colors.muted, marginTop: 2 },
  save: { width: 44, height: 44, borderRadius: Radius.pill, backgroundColor: Colors.surface, alignItems: "center", justifyContent: "center" },
  saved: { backgroundColor: Colors.primarySoft },
  jobTitle: { fontFamily: Fonts.semibold, fontSize: 17, lineHeight: 25, marginTop: Space.lg, color: Colors.foreground },
  featuredTitle: { fontFamily: Fonts.editorial, fontSize: 26, lineHeight: 35, letterSpacing: -0.6 },
  location: { flexDirection: "row", gap: Space.xs, alignItems: "flex-start", marginTop: Space.sm },
  meta: { fontSize: 12, lineHeight: 18, color: Colors.muted, flex: 1 },
  description: { fontSize: 13, lineHeight: 21, color: Colors.muted, marginTop: Space.lg },
  jobFooter: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: Space.md, marginTop: Space.lg, paddingTop: Space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  jobNote: { fontSize: 11, lineHeight: 17, color: Colors.muted, flexShrink: 1 },
  detailButton: { minHeight: 46, paddingHorizontal: Space.lg, paddingVertical: Space.sm, backgroundColor: Colors.foreground, flexDirection: "row", alignItems: "center", gap: Space.md, borderRadius: Radius.sm },
  detailButtonText: { color: Colors.surface, fontFamily: Fonts.semibold, fontSize: 12 },
  detailLink: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: Space.sm },
  feedback: { opacity: 0.72 },
  exploreHeader: { marginTop: Space.xxl, marginBottom: Space.md },
  categories: { gap: Space.xs },
  category: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: Space.md, borderBottomWidth: 1, borderBottomColor: Colors.border, paddingVertical: Space.sm },
});
