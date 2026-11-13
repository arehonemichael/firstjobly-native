import { useState } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Bookmark, MessageCircle, ThumbsUp } from "lucide-react-native";
import { AppText as Text, AppPressable as Pressable } from "../ui/primitives";
import { Colors, Fonts } from "../../constants/theme";
import {
  authorName,
  initials,
  sastDate,
  statusMessage,
  TOPICS,
  type Author,
  type Post,
  type Viewer,
} from "../../lib/community/contract";
import {
  mutationLocks,
  communityStore,
  lockedMutation,
} from "../../lib/community/store";
import { communityApi } from "../../lib/community/api";
import { togglePost } from "../../lib/community/mutations";
import { CommunityMedia } from "./media";
import { ReportDialog, useConfirm } from "./dialogs";
import { Button, ErrorBox, Notice, s } from "./shared";
export function AuthorLine({
  author,
  date,
  edited,
}: {
  author: Author;
  date: string;
  edited: boolean;
}) {
  const name = authorName(author);
  const hue = Number.isFinite(author.avatarHue)
    ? ((author.avatarHue % 360) + 360) % 360
    : 0;
  return (
    <View style={[s.row, { alignItems: "flex-start" }]}>
      <LinearGradient
        colors={[`hsl(${hue},72%,58%)`, `hsl(${(hue + 42) % 360},70%,44%)`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text
          accessibilityLabel={`${name} initials`}
          style={{ color: "white", fontFamily: Fonts.semibold, fontSize: 14 }}
        >
          {initials(name)}
        </Text>
      </LinearGradient>
      <View style={{ flex: 1, minWidth: 100 }}>
        <View style={s.row}>
          <Text style={[s.body, { fontFamily: Fonts.semibold }]}>{name}</Text>
          {author.anonymous && <Text style={s.chip}>Anonymous</Text>}
          {author.isMine && <Text style={s.chip}>You</Text>}
        </View>
        <Text style={s.muted}>
          {sastDate(date)}
          {edited ? " · edited" : ""}
        </Text>
      </View>
    </View>
  );
}
export function PostCard({
  post,
  viewer,
  owner,
  full = false,
  renew,
  onReplies,
}: {
  post: Post;
  viewer: Viewer;
  owner: string;
  full?: boolean;
  renew(): void;
  onReplies?(): void;
}) {
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState("");
  const [report, setReport] = useState(false);
  const { confirm, dialog } = useConfirm();
  const canFollow =
    viewer.canWrite &&
    !post.author.anonymous &&
    !post.author.isMine &&
    !!post.author.id;
  const open = () =>
    router.push({
      pathname: "/community/[postId]",
      params: { postId: post.id },
    });
  async function toggle(kind: "vote" | "save" | "follow") {
    setError(null);
    setMessage("");
    try {
      setMessage((await togglePost(owner, post, kind)) || "");
    } catch (e) {
      setError(e as Error);
    }
  }
  async function remove() {
    if (!(await confirm("Delete this discussion?"))) return;
    try {
      await lockedMutation(`${owner}:delete:${post.id}`, () =>
        communityApi(owner, "delete-post", { postId: post.id }),
      );
      communityStore.invalidate();
      setMessage("Discussion deleted");
    } catch (e) {
      setError(e as Error);
    }
  }
  return (
    <View style={s.card} testID={`community-post-${post.id}`}>
      <AuthorLine
        author={post.author}
        date={post.createdAt}
        edited={post.edited}
      />
      <View style={s.row}>
        {post.pinned && <Text style={s.chip}>Pinned</Text>}
        <Text style={s.chip}>{TOPICS[post.topic] || "General"}</Text>
        {post.sharedFromGraduateRoom && (
          <Text style={s.chip}>Shared from GraduateRoom</Text>
        )}
        {canFollow && (
          <Button
            label={post.author.viewerFollows ? "Unfollow" : "Follow"}
            disabled={mutationLocks.has(`${owner}:follow:${post.author.id}`)}
            onPress={() => void toggle("follow")}
          />
        )}
      </View>
      {!!statusMessage(post.status) && (
        <Notice>{statusMessage(post.status)}</Notice>
      )}
      {full ? (
        <Text style={s.heading} accessibilityRole="header">
          {post.title}
        </Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open discussion: ${post.title}`}
          onPress={open}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={s.heading}>{post.title}</Text>
        </Pressable>
      )}
      <Text style={s.body} numberOfLines={full ? undefined : 3}>
        {post.body}
      </Text>
      <CommunityMedia media={post.media || []} renew={renew} />
      <View style={s.row}>
        {viewer.canWrite && post.status === "visible" ? (
          <Button
            label={`Helpful · ${post.upvoteCount}`}
            selected={post.viewerVoted}
            disabled={mutationLocks.has(`${owner}:vote:${post.id}`)}
            onPress={() => void toggle("vote")}
          />
        ) : (
          <View style={s.row}>
            <ThumbsUp size={16} color={Colors.muted} />
            <Text style={s.muted}>{post.upvoteCount} Helpful</Text>
          </View>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${post.commentCount} replies`}
          onPress={onReplies || open}
          style={[s.row, { minHeight: 44, paddingHorizontal: 8 }]}
        >
          <MessageCircle size={16} color={Colors.muted} />
          <Text style={s.muted}>{post.commentCount} replies</Text>
        </Pressable>
        {viewer.canWrite && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              post.viewerSaved ? "Unsave discussion" : "Save discussion"
            }
            accessibilityState={{
              selected: post.viewerSaved,
              disabled: mutationLocks.has(`${owner}:save:${post.id}`),
            }}
            disabled={mutationLocks.has(`${owner}:save:${post.id}`)}
            onPress={() => void toggle("save")}
            style={[s.button, post.viewerSaved && s.selected, s.row]}
          >
            <Bookmark
              size={16}
              color={Colors.primaryPressed}
              fill={post.viewerSaved ? Colors.primarySoft : "none"}
            />
            <Text style={s.buttonText}>
              {post.viewerSaved ? "Saved" : "Save"}
            </Text>
          </Pressable>
        )}
        {!post.author.isMine && (
          <Button label="Report discussion" onPress={() => setReport(true)} />
        )}
        {viewer.canWrite && post.author.isMine && (
          <>
            <Button
              label="Delete discussion"
              disabled={mutationLocks.has(`${owner}:delete:${post.id}`)}
              onPress={() => void remove()}
            />
            {post.status === "visible" && (
              <Button
                label="Edit discussion"
                onPress={() =>
                  router.push({
                    pathname: "/community/new",
                    params: { edit: post.id },
                  })
                }
              />
            )}
          </>
        )}
      </View>
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={s.muted}>
          {message}
        </Text>
      )}
      <ErrorBox error={error} />
      {dialog}
      {report && (
        <ReportDialog
          owner={owner}
          target={{ postId: post.id }}
          close={(message) => {
            setReport(false);
            if (message) setMessage(message);
          }}
        />
      )}
    </View>
  );
}
