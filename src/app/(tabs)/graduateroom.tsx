import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  Bookmark,
  ChevronUp,
  Filter,
  GraduationCap,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react-native";

import { useAuth } from "../../hooks/use-auth";
import { InstitutionPicker } from "../../components/graduateroom/institution-picker";
import { useScreenBottomPadding } from "../../hooks/use-screen-bottom-padding";
import { theme } from "../../constants/theme";
import {
  CommunityPost,
  POST_TYPES,
  POST_TYPE_LABELS,
  PostScope,
  graduateRoomApi,
  relativeTime,
  type VerificationState,
} from "../../lib/graduateroom";

const TYPE_ACCENTS: Record<string, { bg: string; fg: string }> = {
  question: { bg: theme.colors.brandSoft, fg: theme.colors.brand },
  cv_review: { bg: theme.colors.brandSoft, fg: theme.colors.brand },
  interview_experience: { bg: theme.colors.successSoft, fg: theme.colors.success },
  referral_request: { bg: theme.colors.warningSoft, fg: theme.colors.warning },
  company_review: { bg: theme.colors.surfaceMuted, fg: theme.colors.inkSoft },
  success_story: { bg: theme.colors.successSoft, fg: theme.colors.success },
};

const AVATAR_PALETTE = [
  theme.colors.brand,
  theme.colors.inkSoft,
  theme.colors.success,
  theme.colors.warning,
  theme.colors.danger,
] as const;

function avatarColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

const scopes: { value: PostScope; label: string }[] = [
  { value: "all", label: "All posts" },
  { value: "saved", label: "Saved" },
  { value: "mine", label: "My posts" },
];

function FeedSkeleton() {
  return (
    <View style={s.skeletonWrap}>
      {[0, 1, 2].map((key) => (
        <View key={key} style={s.skeletonCard}>
          <View style={s.skeletonLineShort} />
          <View style={s.skeletonTitle} />
          <View style={s.skeletonLine} />
          <View style={s.skeletonLine} />
        </View>
      ))}
    </View>
  );
}

function PostCard({
  post,
  onVote,
  onSave,
}: {
  post: CommunityPost;
  onVote: (id: string) => void;
  onSave: (id: string) => void;
}) {
  const accent = TYPE_ACCENTS[post.postType] ?? TYPE_ACCENTS.question;
  const displayName = post.author.anonymous
    ? "Anonymous member"
    : post.author.name || "FirstJobly member";
  const initial = post.author.anonymous
    ? "A"
    : (post.author.name?.[0] ?? "F").toUpperCase();
  const avatarBg = post.author.anonymous
    ? theme.colors.inkSoft
    : avatarColor(displayName);

  return (
    <Pressable
      style={({ pressed }) => [s.postCard, pressed && s.pressed]}
      onPress={() =>
        router.push({
          pathname: "/graduateroom/[postId]",
          params: { postId: post.id },
        })
      }
    >
      <View style={s.authorRow}>
        <View style={[s.avatar, { backgroundColor: avatarBg }]}>
          <Text style={s.avatarText}>{initial}</Text>
        </View>

        <View style={s.authorCopy}>
          <View style={s.authorNameRow}>
            <Text style={s.authorName} numberOfLines={1}>{displayName}</Text>
            {post.author.verified ? (
              <ShieldCheck size={13} color={theme.colors.brand} />
            ) : null}
          </View>
          <Text style={s.authorMeta} numberOfLines={1}>
            {post.author.anonymous
              ? relativeTime(post.createdAt)
              : [post.author.institution, relativeTime(post.createdAt)]
                  .filter(Boolean)
                  .join(" · ")}
          </Text>
        </View>

        <View style={[s.typeBadge, { backgroundColor: accent.bg }]}>
          <Text style={[s.typeText, { color: accent.fg }]} numberOfLines={1}>
            {POST_TYPE_LABELS[post.postType]}
          </Text>
        </View>
      </View>

      <Text style={s.postTitle}>{post.title}</Text>
      <Text style={s.postBody} numberOfLines={4}>{post.body}</Text>

      <View style={s.actionRow}>
        <Pressable
          style={({ pressed }) => [s.action, post.viewerVoted && s.actionActive, pressed && s.pressed]}
          onPress={(event) => {
            event.stopPropagation();
            onVote(post.id);
          }}
        >
          <ChevronUp size={17} color={post.viewerVoted ? theme.colors.brand : theme.colors.inkSoft} />
          <Text style={[s.actionText, post.viewerVoted && s.actionTextActive]}>{post.upvoteCount}</Text>
        </Pressable>

        <View style={s.action}>
          <MessageCircle size={16} color={theme.colors.inkSoft} />
          <Text style={s.actionText}>{post.commentCount}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [s.action, post.viewerSaved && s.actionActive, pressed && s.pressed]}
          onPress={(event) => {
            event.stopPropagation();
            onSave(post.id);
          }}
        >
          <Bookmark
            size={16}
            color={post.viewerSaved ? theme.colors.brand : theme.colors.inkSoft}
            fill={post.viewerSaved ? theme.colors.brandSoft : "transparent"}
          />
          <Text style={[s.actionText, post.viewerSaved && s.actionTextActive]}>
            {post.viewerSaved ? "Saved" : "Save"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function GraduateRoom() {
  const { userId, loading: authLoading, isAuthenticated } = useAuth();
  const bottom = useScreenBottomPadding(true);
  const [verification, setVerification] = useState<VerificationState | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [scope, setScope] = useState<PostScope>("all");
  const [postType, setPostType] = useState("");
  const [institution, setInstitution] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [loadingState, setLoadingState] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [error, setError] = useState("");

  const verified = verification?.status === "verified";

  const loadVerification = useCallback(async () => {
    if (!userId) return;
    try {
      setError("");
      const state = await graduateRoomApi<VerificationState>("verification-state");
      setVerification(state);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load GraduateRoom.");
    } finally {
      setLoadingState(false);
    }
  }, [userId]);

  const filters = useMemo(
    () => ({
      scope,
      postType,
      institution: institution.trim(),
      search: search.trim(),
    }),
    [institution, postType, scope, search],
  );

  const activeFilterCount = (postType ? 1 : 0) + (institution ? 1 : 0);

  const loadPosts = useCallback(
    async (refresh = false) => {
      if (!verified) return;
      refresh ? setRefreshing(true) : setLoadingPosts(true);
      try {
        setError("");
        const next = await graduateRoomApi<CommunityPost[]>("list-posts", filters);
        setPosts(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load posts.");
      } finally {
        setLoadingPosts(false);
        setRefreshing(false);
      }
    },
    [filters, verified],
  );

  useEffect(() => {
    if (!authLoading && isAuthenticated) void loadVerification();
    if (!authLoading && !isAuthenticated) setLoadingState(false);
  }, [authLoading, isAuthenticated, loadVerification]);

  useEffect(() => {
    if (verified) void loadPosts();
  }, [loadPosts, verified]);

  useFocusEffect(
    useCallback(() => {
      if (verified) void loadPosts(true);
    }, [loadPosts, verified]),
  );

  async function toggle(action: "toggle-vote" | "toggle-save", postId: string) {
    try {
      await graduateRoomApi(action, { postId });
      await loadPosts(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That action failed.");
    }
  }

  if (authLoading || loadingState) {
    return (
      <SafeAreaView style={s.page} edges={["top"]}>
        <FeedSkeleton />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={s.centerPage} edges={["top", "bottom"]}>
        <View style={s.gateCard}>
          <View style={s.gateIcon}><GraduationCap size={26} color={theme.colors.brand} /></View>
          <Text style={s.gateTitle}>GraduateRoom</Text>
          <Text style={s.gateText}>Sign in to join the verified student and graduate community.</Text>
          <Pressable style={s.primary} onPress={() => router.push("/auth")}>
            <Text style={s.primaryText}>Sign in</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!verified) {
    const status = verification?.status ?? "none";
    return (
      <SafeAreaView style={s.centerPage} edges={["top", "bottom"]}>
        <View style={s.gateCard}>
          <View style={s.gateIcon}><ShieldCheck size={26} color={theme.colors.brand} /></View>
          <Text style={s.gateTitle}>Verify to join GraduateRoom</Text>
          <Text style={s.gateText}>
            {status === "pending"
              ? "Your verification is being reviewed. You can check its status here."
              : status === "revoked"
                ? "Your GraduateRoom access has been revoked."
                : status === "rejected"
                  ? verification?.reviewNote || "Your previous verification was not approved. You can submit again."
                  : "GraduateRoom is for verified South African students and graduates."}
          </Text>
          <Pressable style={s.primary} onPress={() => router.push("/graduateroom/verify")}>
            <Text style={s.primaryText}>{status === "pending" ? "View verification" : "Verify now"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.page} edges={["top"]}>
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onVote={(id) => void toggle("toggle-vote", id)}
            onSave={(id) => void toggle("toggle-save", id)}
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadPosts(true)}
            tintColor={theme.colors.brand}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottom + 24 }}
        ListHeaderComponent={
          <>
            <View style={s.header}>
              <View style={s.headerCopy}>
                <Text style={s.title}>GraduateRoom</Text>
                <Text style={s.subtitle}>
                  {posts.length > 0
                    ? `${posts.length} ${posts.length === 1 ? "discussion" : "discussions"} · verified students & grads`
                    : "Verified students and graduates helping each other"}
                </Text>
              </View>
              <Pressable style={({ pressed }) => [s.newButton, pressed && s.pressed]} onPress={() => router.push("/graduateroom/new")}>
                <Plus size={17} color={theme.colors.primaryForeground} />
                <Text style={s.newButtonText}>Post</Text>
              </Pressable>
            </View>

            <View style={s.searchRow}>
              <View style={s.searchBox}>
                <Search size={17} color={theme.colors.inkSoft} />
                <TextInput
                  value={searchDraft}
                  onChangeText={setSearchDraft}
                  onSubmitEditing={() => setSearch(searchDraft)}
                  placeholder="Search discussions"
                  placeholderTextColor={theme.colors.textMuted}
                  style={s.searchInput}
                  returnKeyType="search"
                />
                {searchDraft ? (
                  <Pressable hitSlop={8} onPress={() => { setSearchDraft(""); setSearch(""); }}>
                    <X size={16} color={theme.colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              <Pressable
                style={({ pressed }) => [s.filterButton, activeFilterCount > 0 && s.filterButtonActive, pressed && s.pressed]}
                onPress={() => setFilterOpen(true)}
              >
                <Filter size={17} color={activeFilterCount > 0 ? theme.colors.brand : theme.colors.inkSoft} />
                {activeFilterCount > 0 ? (
                  <View style={s.filterCount}><Text style={s.filterCountText}>{activeFilterCount}</Text></View>
                ) : null}
              </Pressable>
            </View>

            <View style={s.segmented}>
              {scopes.map((item) => {
                const active = scope === item.value;
                return (
                  <Pressable key={item.value} style={[s.segment, active && s.segmentActive]} onPress={() => setScope(item.value)}>
                    <Text style={[s.segmentText, active && s.segmentTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={s.error}>{error}</Text> : null}
            {loadingPosts && !refreshing ? <FeedSkeleton /> : null}
          </>
        }
        ListEmptyComponent={
          loadingPosts ? null : (
            <View style={s.empty}>
              <View style={s.emptyIcon}><MessageCircle size={26} color={theme.colors.brand} /></View>
              <Text style={s.emptyTitle}>No discussions found</Text>
              <Text style={s.emptyText}>Ask a question, request CV feedback or share your experience.</Text>
              <Pressable style={s.primary} onPress={() => router.push("/graduateroom/new")}>
                <Text style={s.primaryText}>Start a discussion</Text>
              </Pressable>
            </View>
          )
        }
      />

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Filter discussions</Text>
              <Pressable style={s.icon44} onPress={() => setFilterOpen(false)}>
                <X size={20} color={theme.colors.ink} />
              </Pressable>
            </View>

            <Text style={s.label}>Discussion type</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              <Pressable style={[s.option, !postType && s.optionActive]} onPress={() => setPostType("")}>
                <Text style={[s.optionText, !postType && s.optionTextActive]}>All types</Text>
              </Pressable>
              {POST_TYPES.map((type) => {
                const accent = TYPE_ACCENTS[type.value] ?? TYPE_ACCENTS.question;
                const active = postType === type.value;
                return (
                  <Pressable key={type.value} style={[s.option, active && s.optionActive]} onPress={() => setPostType(type.value)}>
                    <View style={[s.optionDot, { backgroundColor: accent.fg }]} />
                    <Text style={[s.optionText, active && s.optionTextActive]}>{type.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={s.label}>Institution</Text>
            <InstitutionPicker value={institution} onChange={setInstitution} optional />

            <View style={s.sheetActions}>
              <Pressable style={s.secondary} onPress={() => { setPostType(""); setInstitution(""); }}>
                <Text style={s.secondaryText}>Reset</Text>
              </Pressable>
              <Pressable style={s.primarySmall} onPress={() => setFilterOpen(false)}>
                <Text style={s.primaryText}>Show posts</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  centerPage: { flex: 1, backgroundColor: theme.colors.background, alignItems: "center", justifyContent: "center", padding: 16 },
  gateCard: {
    width: "100%",
    maxWidth: 420,
    padding: 24,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    ...theme.shadow.card,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 16, paddingBottom: 14 },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { color: theme.colors.ink, fontSize: 25, lineHeight: 31, fontWeight: "800", letterSpacing: -0.35 },
  subtitle: { color: theme.colors.inkSoft, fontSize: 12, lineHeight: 18, marginTop: 2, fontWeight: "500" },
  newButton: {
    minHeight: 42,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.brand,
  },
  newButtonText: { color: theme.colors.primaryForeground, fontSize: 13, fontWeight: "700" },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  searchBox: {
    flex: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 13,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.sm,
  },
  searchInput: { flex: 1, color: theme.colors.ink, fontSize: 14, fontWeight: "500" },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonActive: { backgroundColor: theme.colors.brandSoft, borderColor: theme.colors.brand },
  filterCount: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 3,
    backgroundColor: theme.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  filterCountText: { color: theme.colors.primaryForeground, fontSize: 9, fontWeight: "800" },
  segmented: { flexDirection: "row", backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.sm, padding: 3, marginBottom: 14 },
  segment: { flex: 1, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.sm },
  segmentActive: { backgroundColor: theme.colors.surface, ...theme.shadow.card },
  segmentText: { color: theme.colors.inkSoft, fontSize: 12, fontWeight: "600" },
  segmentTextActive: { color: theme.colors.ink },
  postCard: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.md,
    padding: 14,
    marginBottom: 10,
    ...theme.shadow.card,
  },
  authorRow: { flexDirection: "row", alignItems: "center" },
  avatar: { width: 36, height: 36, borderRadius: theme.radius.pill, alignItems: "center", justifyContent: "center" },
  avatarText: { color: theme.colors.primaryForeground, fontSize: 13, fontWeight: "700" },
  authorCopy: { flex: 1, minWidth: 0, marginLeft: 10, marginRight: 8 },
  authorNameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  authorName: { color: theme.colors.ink, fontSize: 12.5, fontWeight: "700" },
  authorMeta: { color: theme.colors.textMuted, fontSize: 10, marginTop: 2, fontWeight: "500" },
  typeBadge: { maxWidth: 110, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7 },
  typeText: { fontSize: 9.5, fontWeight: "700" },
  postTitle: { color: theme.colors.ink, fontSize: 15.5, lineHeight: 21, marginTop: 12, fontWeight: "700" },
  postBody: { color: theme.colors.inkSoft, fontSize: 13, lineHeight: 19.5, marginTop: 5, fontWeight: "400" },
  actionRow: { flexDirection: "row", gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.colors.line },
  action: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, borderRadius: 7 },
  actionActive: { backgroundColor: theme.colors.brandSoft },
  actionText: { color: theme.colors.inkSoft, fontSize: 11, fontWeight: "600" },
  actionTextActive: { color: theme.colors.brand },
  gateIcon: { width: 52, height: 52, borderRadius: theme.radius.md, backgroundColor: theme.colors.brandSoft, alignItems: "center", justifyContent: "center" },
  gateTitle: { color: theme.colors.ink, fontSize: 21, textAlign: "center", marginTop: 16, fontWeight: "800" },
  gateText: { color: theme.colors.inkSoft, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 7, maxWidth: 330, fontWeight: "500" },
  primary: { minHeight: 48, paddingHorizontal: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, marginTop: 18 },
  primarySmall: { minHeight: 46, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.brand, borderRadius: theme.radius.md },
  primaryText: { color: theme.colors.primaryForeground, fontSize: 13, fontWeight: "700" },
  secondary: { minHeight: 46, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, borderRadius: theme.radius.md },
  secondaryText: { color: theme.colors.ink, fontSize: 13, fontWeight: "700" },
  error: { color: theme.colors.danger, fontSize: 12, lineHeight: 18, marginBottom: 10, fontWeight: "500" },
  empty: { alignItems: "center", paddingVertical: 56, paddingHorizontal: 24 },
  emptyIcon: { width: 56, height: 56, borderRadius: theme.radius.md, backgroundColor: theme.colors.brandSoft, alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: theme.colors.ink, fontSize: 16, marginTop: 14, fontWeight: "700" },
  emptyText: { color: theme.colors.inkSoft, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 5 },
  pressed: { opacity: 0.72 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(23,33,43,0.28)" },
  sheet: { backgroundColor: theme.colors.surface, padding: 16, paddingBottom: 28, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sheetTitle: { color: theme.colors.ink, fontSize: 18, fontWeight: "700" },
  icon44: { width: 44, height: 44, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surfaceMuted, alignItems: "center", justifyContent: "center" },
  label: { color: theme.colors.ink, fontSize: 12, marginTop: 12, marginBottom: 6, fontWeight: "700" },
  option: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, borderRadius: theme.radius.sm },
  optionActive: { backgroundColor: theme.colors.brandSoft },
  optionDot: { width: 8, height: 8, borderRadius: theme.radius.pill },
  optionText: { color: theme.colors.inkSoft, fontSize: 13 },
  optionTextActive: { color: theme.colors.brand, fontWeight: "700" },
  sheetActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 18 },
  skeletonWrap: { paddingVertical: 8, paddingHorizontal: 16 },
  skeletonCard: { height: 164, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line, padding: 14, marginBottom: 10 },
  skeletonLineShort: { width: "35%", height: 10, backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.sm },
  skeletonTitle: { width: "78%", height: 17, backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.sm, marginTop: 22 },
  skeletonLine: { width: "94%", height: 11, backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.sm, marginTop: 10 },
});
