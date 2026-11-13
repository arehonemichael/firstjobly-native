import { useEffect, useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  Switch,
  View,
  type TextInput as NativeTextInput,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import {
  AppText as Text,
  AppTextInput as TextInput,
} from "../../components/ui/primitives";
import { Colors } from "../../constants/theme";
import { useCommunityQuery } from "../../hooks/use-community";
import {
  ANONYMOUS_HELP,
  PII_MESSAGE,
  authorName,
  hasPersonalInfo,
  statusMessage,
  threadComments,
  validateText,
  type Comment,
  type Discussion,
  type Viewer,
} from "../../lib/community/contract";
import { communityApi } from "../../lib/community/api";
import { communityStore, lockedMutation } from "../../lib/community/store";
import {
  Button,
  CommunityGate,
  CommunityScreen,
  ErrorBox,
  Notice,
  s,
} from "../../components/community/shared";
import { AuthorLine, PostCard } from "../../components/community/post-card";
import { ReportDialog, useConfirm } from "../../components/community/dialogs";

export default function CommunityDiscussion() {
  const { postId, pii } = useLocalSearchParams<{
    postId: string;
    pii?: string;
  }>();
  return (
    <CommunityScreen>
      <Stack.Screen options={{ title: "Community", headerShown: false }} />
      <CommunityGate>
        {(viewer, owner) => (
          <DiscussionBody
            key={`${owner}:${postId}`}
            id={postId}
            viewer={viewer}
            owner={owner}
            initialWarning={pii === "true"}
          />
        )}
      </CommunityGate>
    </CommunityScreen>
  );
}
function DiscussionBody({
  id,
  viewer,
  owner,
  initialWarning,
}: {
  id: string;
  viewer: Viewer;
  owner: string;
  initialWarning: boolean;
}) {
  const query = useCommunityQuery<Discussion>(id, "get-post", { postId: id });
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<Error | null>(null);
  const [message, setMessage] = useState(initialWarning ? PII_MESSAGE : "");
  const [report, setReport] = useState<Comment | null>(null);
  const [edit, setEdit] = useState<Comment | null>(null);
  const [editBody, setEditBody] = useState("");
  const { confirm, dialog } = useConfirm();
  const scroll = useRef<ScrollView>(null);
  const input = useRef<NativeTextInput>(null);
  const [composerY, setComposerY] = useState(0);
  const post = query.value?.post;
  useEffect(() => {
    if (post && post.id !== id)
      router.replace({
        pathname: "/community/[postId]",
        params: { postId: post.id },
      });
  }, [post, id]);
  async function reply() {
    if (!post || busyRef.current) return;
    const problem = validateText(body, false, viewer.newAccount);
    if (problem) {
      setError(new Error(problem));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await communityApi<{ id: string; piiWarning: boolean }>(
        owner,
        "create-comment",
        {
          postId: post.id,
          ...(replyTo ? { parentId: replyTo.id } : {}),
          body: body.trim(),
          isAnonymous: anonymous,
        },
      );
      setBody("");
      setReplyTo(null);
      setAnonymous(false);
      setMessage(
        result.piiWarning
          ? `Reply submitted. ${PII_MESSAGE}`
          : "Reply submitted. Its visibility is shown below.",
      );
      communityStore.invalidate();
      await query.reload();
    } catch (e) {
      setError(e as Error);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function remove(comment: Comment) {
    if (!(await confirm("Delete this reply?"))) return;
    try {
      await lockedMutation(`${owner}:delete-reply:${comment.id}`, () =>
        communityApi(owner, "delete-comment", { commentId: comment.id }),
      );
      setMessage("Reply deleted");
      communityStore.invalidate();
      await query.reload();
    } catch (e) {
      setError(e as Error);
    }
  }
  async function saveEdit() {
    if (!edit || busyRef.current) return;
    const problem = validateText(editBody, false, viewer.newAccount);
    if (problem) {
      setError(new Error(problem));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      await communityApi(owner, "edit-comment", {
        commentId: edit.id,
        body: editBody.trim(),
      });
      setEdit(null);
      communityStore.invalidate();
      await query.reload();
    } catch (e) {
      setError(e as Error);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function more() {
    if (!query.value?.nextCursor || query.more || query.loading) return;
    void query.reload(query.value.nextCursor, (previous, next) => ({
      ...previous,
      comments: [
        ...new Map(
          [...previous.comments, ...next.comments].map((comment) => [
            comment.id,
            comment,
          ]),
        ).values(),
      ],
      nextCursor: next.nextCursor,
    }));
  }
  return (
    <>
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Button
          label="Back to Community"
          onPress={() => router.dismissTo("/community")}
        />
        <ErrorBox error={query.error} retry={() => void query.reload()} />
        {!post && query.loading && <Notice>Loading discussion…</Notice>}
        {!!message && <Notice>{message}</Notice>}
        {post && (
          <PostCard
            post={post}
            viewer={viewer}
            owner={owner}
            full
            onReplies={() =>
              scroll.current?.scrollTo({ y: composerY, animated: false })
            }
            renew={() => void query.reload()}
          />
        )}
        {post && (
          <>
            <View
              onLayout={(e) => setComposerY(e.nativeEvent.layout.y)}
              style={{ gap: 12 }}
            >
              <Text style={s.heading}>Replies</Text>
              {viewer.canWrite && post.status === "visible" && (
                <View style={s.card}>
                  {replyTo && (
                    <View style={{ gap: 8 }}>
                      <Notice>
                        Replying to {authorName(replyTo.author)}:{" "}
                        {replyTo.body.slice(0, 90)}
                      </Notice>
                      <Button
                        label="Cancel reply to member"
                        onPress={() => setReplyTo(null)}
                      />
                    </View>
                  )}
                  <TextInput
                    ref={input}
                    accessibilityLabel="Add a helpful reply"
                    placeholder="Add a helpful reply"
                    multiline
                    maxLength={2000}
                    value={body}
                    onChangeText={setBody}
                    onFocus={() => {
                      scroll.current?.scrollTo({
                        y: composerY,
                        animated: false,
                      });
                    }}
                    style={[
                      s.field,
                      { minHeight: 110, textAlignVertical: "top" },
                    ]}
                  />
                  <Text style={s.muted}>{body.length}/2000</Text>
                  {hasPersonalInfo(body) && <Notice>{PII_MESSAGE}</Notice>}
                  {!!body && !!validateText(body, false, viewer.newAccount) && (
                    <Text style={s.muted}>
                      {validateText(body, false, viewer.newAccount)}
                    </Text>
                  )}
                  <View style={s.row}>
                    <Switch
                      accessibilityLabel="Reply anonymously"
                      value={anonymous}
                      onValueChange={setAnonymous}
                      trackColor={{
                        true: Colors.primary,
                        false: Colors.border,
                      }}
                    />
                    <Text style={s.body}>Reply anonymously</Text>
                  </View>
                  <Text style={s.muted}>{ANONYMOUS_HELP}</Text>
                  <ErrorBox error={error} />
                  <Button
                    primary
                    label={busy ? "Submitting reply…" : "Reply"}
                    disabled={
                      busy || !!validateText(body, false, viewer.newAccount)
                    }
                    onPress={() => void reply()}
                  />
                </View>
              )}
            </View>
            {!query.value?.comments.length && (
              <Text style={s.muted}>No replies yet.</Text>
            )}
            {threadComments(query.value?.comments || []).map(
              ({ comment, depth }) => (
                <View
                  key={comment.id}
                  style={[s.card, { marginLeft: depth * 12 }]}
                  testID={`community-reply-${comment.id}`}
                >
                  <AuthorLine
                    author={comment.author}
                    date={comment.createdAt}
                    edited={comment.edited}
                  />
                  {!!statusMessage(comment.status, true) && (
                    <Notice>{statusMessage(comment.status, true)}</Notice>
                  )}
                  {!!comment.body && <Text style={s.body}>{comment.body}</Text>}
                  <View style={s.row}>
                    {viewer.canWrite &&
                      post.status === "visible" &&
                      comment.status === "visible" &&
                      depth < 2 && (
                        <Button
                          label={`Reply to ${authorName(comment.author)}`}
                          onPress={() => {
                            setReplyTo(comment);
                            scroll.current?.scrollTo({
                              y: composerY,
                              animated: false,
                            });
                            input.current?.focus();
                          }}
                        />
                      )}
                    {!comment.author.isMine && (
                      <Button
                        label="Report reply"
                        onPress={() => setReport(comment)}
                      />
                    )}
                    {viewer.canWrite && comment.author.isMine && (
                      <>
                        <Button
                          label="Delete reply"
                          onPress={() => void remove(comment)}
                        />
                        {comment.status === "visible" && (
                          <Button
                            label="Edit reply"
                            onPress={() => {
                              setEdit(comment);
                              setEditBody(comment.body);
                              setError(null);
                            }}
                          />
                        )}
                      </>
                    )}
                  </View>
                </View>
              ),
            )}
            {!!query.value?.nextCursor && (
              <Button
                label={query.more ? "Loading replies…" : "Load more replies"}
                disabled={query.more}
                onPress={more}
              />
            )}
          </>
        )}
      </ScrollView>
      {!edit && dialog}
      {report && (
        <ReportDialog
          owner={owner}
          target={{ commentId: report.id }}
          close={(message) => {
            setReport(null);
            if (message) setMessage(message);
          }}
        />
      )}
      <Modal
        visible={!!edit}
        onRequestClose={async () => {
          if (
            !busy &&
            (editBody === edit?.body ||
              (await confirm("Discard unsaved reply changes?")))
          )
            setEdit(null);
        }}
        animationType="slide"
      >
        <CommunityScreen>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.content}
          >
            <Text style={s.title}>Edit reply</Text>
            <TextInput
              accessibilityLabel="Edit reply details"
              multiline
              maxLength={2000}
              value={editBody}
              onChangeText={setEditBody}
              style={[s.field, { minHeight: 160 }]}
            />
            <Text style={s.muted}>{editBody.length}/2000</Text>
            {hasPersonalInfo(editBody) && <Notice>{PII_MESSAGE}</Notice>}
            <ErrorBox error={error} />
            <Button
              primary
              label="Save reply changes"
              disabled={
                busy || !!validateText(editBody, false, viewer.newAccount)
              }
              onPress={() => void saveEdit()}
            />
            <Button
              label="Cancel editing"
              disabled={busy}
              onPress={async () => {
                if (
                  editBody === edit?.body ||
                  (await confirm("Discard unsaved reply changes?"))
                )
                  setEdit(null);
              }}
            />
          </ScrollView>
        </CommunityScreen>
        {!!edit && dialog}
      </Modal>
    </>
  );
}
