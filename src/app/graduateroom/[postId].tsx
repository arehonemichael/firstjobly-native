import {
  AppText as Text,
  AppTextInput as TextInput,
  AppPressable as Pressable,
} from "../../components/ui/primitives";
import { Colors } from "../../constants/theme";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import {
  ArrowLeft,
  Bookmark,
  ChevronUp,
  MessageCircle,
  MoreHorizontal,
  Reply,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react-native";

import {
  COMMUNITY_REPORT_REASONS,
  CommunityComment,
  CommunityPost,
  POST_TYPE_LABELS,
  graduateRoomApi,
  relativeTime,
} from "../../lib/graduateroom";

type Detail = {
  post: CommunityPost;
  comments: CommunityComment[];
};

type ReportTarget =
  | { postId: string; commentId?: never }
  | { commentId: string; postId?: never };

function Author({
  author,
  createdAt,
}: {
  author: CommunityPost["author"];
  createdAt: string;
}) {
  return (
    <View style={s.authorRow}>
      <View style={s.avatar}>
        <Text style={s.avatarText}>
          {author.anonymous ? "A" : (author.name?.[0] ?? "F").toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.nameRow}>
          <Text style={s.name}>
            {author.anonymous
              ? "Anonymous member"
              : author.name || "FirstJobly member"}
          </Text>
          {author.verified ? (
            <ShieldCheck strokeWidth={1.5} size={18} color={Colors.primary} />
          ) : null}
        </View>
        <Text style={s.meta}>
          {author.anonymous
            ? relativeTime(createdAt)
            : [author.institution, relativeTime(createdAt)]
                .filter(Boolean)
                .join(" · ")}
        </Text>
      </View>
    </View>
  );
}

export default function GraduateRoomPostDetail() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");

  const load = useCallback(async () => {
    if (!postId) return;
    try {
      setError("");
      const result = await graduateRoomApi<Detail | null>("get-post", {
        postId,
      });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load discussion.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const threads = useMemo(() => {
    const comments = data?.comments ?? [];
    const roots = comments.filter((comment) => !comment.parentId);
    const byParent = new Map<string, CommunityComment[]>();
    for (const comment of comments) {
      if (!comment.parentId) continue;
      const group = byParent.get(comment.parentId) ?? [];
      group.push(comment);
      byParent.set(comment.parentId, group);
    }
    return roots.map((root) => ({
      root,
      replies: byParent.get(root.id) ?? [],
    }));
  }, [data?.comments]);

  async function mutate(action: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      await graduateRoomApi(action, payload);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendReply() {
    if (!postId || reply.trim().length < 2) return;
    setBusy(true);
    try {
      await graduateRoomApi("create-comment", {
        postId,
        parentId: replyTo,
        body: reply.trim(),
        isAnonymous: anonymous,
      });
      setReply("");
      setReplyTo(null);
      setAnonymous(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post reply.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReport() {
    if (!reportTarget || !reportReason) return;
    setBusy(true);
    try {
      await graduateRoomApi("report", {
        ...reportTarget,
        reason: reportReason,
        details: reportDetails.trim(),
      });
      setReportTarget(null);
      setReportReason("");
      setReportDetails("");
      Alert.alert("Report sent", "Thank you. A moderator can now review it.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send report.");
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(kind: "post" | "comment", id: string) {
    Alert.alert(
      kind === "post" ? "Delete discussion?" : "Delete reply?",
      "This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            void mutate(
              kind === "post" ? "delete-post" : "delete-comment",
              kind === "post" ? { postId: id } : { commentId: id },
            ).then(() => {
              if (kind === "post") router.back();
            }),
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={s.center} edges={["top", "bottom"]}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  if (!data?.post) {
    return (
      <SafeAreaView style={s.center} edges={["top", "bottom"]}>
        <Text style={s.notFound}>This discussion is no longer available.</Text>
        <Pressable style={s.primary} onPress={() => router.back()}>
          <Text style={s.primaryText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const post = data.post;

  return (
    <SafeAreaView style={s.page} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable style={s.icon44} onPress={() => router.back()}>
          <ArrowLeft strokeWidth={1.5} size={18} color={Colors.foreground} />
        </Pressable>
        <Text style={s.headerTitle}>Discussion</Text>
        <Pressable
          style={s.icon44}
          onPress={() => {
            if (post.author.isMine) {
              confirmDelete("post", post.id);
            } else {
              setReportTarget({ postId: post.id });
            }
          }}
        >
          {post.author.isMine ? (
            <Trash2 strokeWidth={1.5} size={18} color={Colors.error} />
          ) : (
            <MoreHorizontal strokeWidth={1.5} size={18} color={Colors.muted} />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.post}>
          <Author author={post.author} createdAt={post.createdAt} />
          <View style={s.typeBadge}>
            <Text style={s.typeText}>{POST_TYPE_LABELS[post.postType]}</Text>
          </View>
          <Text style={s.title}>{post.title}</Text>
          <Text style={s.body}>{post.body}</Text>

          <View style={s.actions}>
            <Pressable
              style={[s.action, post.viewerVoted && s.actionActive]}
              onPress={() => void mutate("toggle-vote", { postId: post.id })}
            >
              <ChevronUp
                strokeWidth={1.5}
                size={18}
                color={post.viewerVoted ? Colors.primaryPressed : Colors.muted}
              />
              <Text style={s.actionText}>{post.upvoteCount}</Text>
            </Pressable>
            <View style={s.action}>
              <MessageCircle strokeWidth={1.5} size={18} color={Colors.muted} />
              <Text style={s.actionText}>{post.commentCount}</Text>
            </View>
            <Pressable
              style={[s.action, post.viewerSaved && s.actionActive]}
              onPress={() => void mutate("toggle-save", { postId: post.id })}
            >
              <Bookmark
                strokeWidth={1.5}
                size={18}
                color={post.viewerSaved ? Colors.primaryPressed : Colors.muted}
              />
              <Text style={s.actionText}>
                {post.viewerSaved ? "Saved" : "Save"}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={s.sectionTitle}>Replies</Text>

        {threads.length ? (
          threads.map(({ root, replies }) => (
            <View key={root.id} style={s.thread}>
              <Author author={root.author} createdAt={root.createdAt} />
              <Text style={s.commentBody}>{root.body}</Text>
              <View style={s.commentActions}>
                <Pressable
                  style={s.commentAction}
                  onPress={() => setReplyTo(root.id)}
                >
                  <Reply strokeWidth={1.5} size={18} color={Colors.muted} />
                  <Text style={s.commentActionText}>Reply</Text>
                </Pressable>
                {root.author.isMine ? (
                  <Pressable
                    style={s.commentAction}
                    onPress={() => confirmDelete("comment", root.id)}
                  >
                    <Text style={s.deleteText}>Delete</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={s.commentAction}
                    onPress={() => setReportTarget({ commentId: root.id })}
                  >
                    <Text style={s.deleteText}>Report</Text>
                  </Pressable>
                )}
              </View>

              {replies.map((child) => (
                <View key={child.id} style={s.childReply}>
                  <Author author={child.author} createdAt={child.createdAt} />
                  <Text style={s.commentBody}>{child.body}</Text>
                  <View style={s.commentActions}>
                    {child.author.isMine ? (
                      <Pressable
                        style={s.commentAction}
                        onPress={() => confirmDelete("comment", child.id)}
                      >
                        <Text style={s.deleteText}>Delete</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={s.commentAction}
                        onPress={() => setReportTarget({ commentId: child.id })}
                      >
                        <Text style={s.deleteText}>Report</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ))
        ) : (
          <Text style={s.noReplies}>No replies yet. Be the first to help.</Text>
        )}

        <View style={s.replyBox}>
          {replyTo ? (
            <View style={s.replyingRow}>
              <Text style={s.replyingText}>Replying to a comment</Text>
              <Pressable onPress={() => setReplyTo(null)}>
                <X strokeWidth={1.5} size={18} color={Colors.muted} />
              </Pressable>
            </View>
          ) : null}
          <TextInput
            value={reply}
            onChangeText={setReply}
            maxLength={2000}
            multiline
            textAlignVertical="top"
            placeholder="Share what you know..."
            placeholderTextColor={Colors.mutedSubtle}
            style={s.replyInput}
          />
          <Pressable
            style={[s.anonToggle, anonymous && s.anonToggleActive]}
            onPress={() => setAnonymous((value) => !value)}
          >
            <Text
              style={[s.anonToggleText, anonymous && s.anonToggleTextActive]}
            >
              {anonymous ? "Replying anonymously" : "Reply anonymously"}
            </Text>
          </Pressable>
          <Pressable
            style={[s.primary, (reply.trim().length < 2 || busy) && s.disabled]}
            disabled={reply.trim().length < 2 || busy}
            onPress={() => void sendReply()}
          >
            {busy ? (
              <ActivityIndicator color={Colors.surface} />
            ) : (
              <Text style={s.primaryText}>Post reply</Text>
            )}
          </Pressable>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}
      </ScrollView>

      <Modal
        visible={!!reportTarget}
        transparent
        animationType="slide"
        onRequestClose={() => setReportTarget(null)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>Report content</Text>
              <Pressable style={s.icon44} onPress={() => setReportTarget(null)}>
                <X strokeWidth={1.5} size={18} color={Colors.foreground} />
              </Pressable>
            </View>
            {COMMUNITY_REPORT_REASONS.map((reason) => (
              <Pressable
                key={reason}
                style={[s.reason, reportReason === reason && s.reasonActive]}
                onPress={() => setReportReason(reason)}
              >
                <Text
                  style={[
                    s.reasonText,
                    reportReason === reason && s.reasonTextActive,
                  ]}
                >
                  {reason}
                </Text>
              </Pressable>
            ))}
            <TextInput
              value={reportDetails}
              onChangeText={setReportDetails}
              maxLength={500}
              multiline
              placeholder="Anything a moderator should know (optional)"
              placeholderTextColor={Colors.mutedSubtle}
              style={s.reportInput}
            />
            <Pressable
              style={[s.primary, (!reportReason || busy) && s.disabled]}
              disabled={!reportReason || busy}
              onPress={() => void submitReport()}
            >
              <Text style={s.primaryText}>Send report</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  icon44: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: Colors.foreground,
    fontSize: 16,
    fontWeight: "500",
  },
  content: { padding: 16, paddingBottom: 40 },
  post: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
  },
  authorRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  avatarText: { color: Colors.primaryPressed, fontSize: 13, fontWeight: "500" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  name: { color: Colors.foreground, fontSize: 12, fontWeight: "500" },
  meta: { color: Colors.mutedSubtle, fontSize: 12, marginTop: 2 },
  typeBadge: {
    alignSelf: "flex-start",
    marginTop: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.primarySoft,
  },
  typeText: { color: Colors.primaryPressed, fontSize: 12, fontWeight: "500" },
  title: {
    color: Colors.foreground,
    fontSize: 20,
    lineHeight: 28,
    marginTop: 12,
    fontWeight: "500",
  },
  body: { color: Colors.muted, fontSize: 14, lineHeight: 24, marginTop: 8 },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  action: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 7,
  },
  actionActive: { backgroundColor: Colors.primarySoft },
  actionText: { color: Colors.muted, fontSize: 12, fontWeight: "500" },
  sectionTitle: {
    color: Colors.foreground,
    fontSize: 18,
    fontWeight: "500",
    marginTop: 24,
    marginBottom: 12,
  },
  thread: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  commentBody: {
    color: Colors.foreground,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  commentActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  commentAction: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  commentActionText: { color: Colors.muted, fontSize: 12, fontWeight: "500" },
  deleteText: { color: Colors.error, fontSize: 12, fontWeight: "500" },
  childReply: {
    marginLeft: 28,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  noReplies: { color: Colors.muted, fontSize: 12, marginBottom: 16 },
  replyBox: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  replyingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  replyingText: {
    color: Colors.primaryPressed,
    fontSize: 12,
    fontWeight: "500",
  },
  replyInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: 8,
    padding: 12,
    color: Colors.foreground,
    fontSize: 13,
  },
  anonToggle: {
    alignSelf: "flex-start",
    minHeight: 40,
    justifyContent: "center",
    marginTop: 8,
    paddingHorizontal: 12,
    borderRadius: 7,
  },
  anonToggleActive: { backgroundColor: Colors.primarySoft },
  anonToggleText: { color: Colors.muted, fontSize: 12, fontWeight: "500" },
  anonToggleTextActive: { color: Colors.primaryPressed },
  primary: {
    minHeight: 48,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginTop: 12,
  },
  primaryText: { color: Colors.surface, fontSize: 13, fontWeight: "500" },
  disabled: { opacity: 0.45 },
  error: { color: Colors.error, fontSize: 12, marginTop: 12 },
  notFound: { color: Colors.muted, fontSize: 13, textAlign: "center" },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(6,26,48,0.28)",
  },
  sheet: {
    backgroundColor: Colors.surface,
    padding: 16,
    paddingBottom: 28,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetTitle: { color: Colors.foreground, fontSize: 18, fontWeight: "500" },
  reason: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 7,
  },
  reasonActive: { backgroundColor: Colors.primarySoft },
  reasonText: { color: Colors.muted, fontSize: 12 },
  reasonTextActive: { color: Colors.primaryPressed, fontWeight: "500" },
  reportInput: {
    minHeight: 80,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: 8,
    padding: 12,
    color: Colors.foreground,
  },
});
