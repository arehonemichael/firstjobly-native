import { useEffect, useRef, useState } from "react";
import { Platform, ScrollView, Switch, View } from "react-native";
import { Image } from "expo-image";
import {
  router,
  Stack,
  useLocalSearchParams,
  useNavigation,
} from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import {
  AppText as Text,
  AppTextInput as TextInput,
} from "../../components/ui/primitives";
import { Colors } from "../../constants/theme";
import { useCommunityQuery } from "../../hooks/use-community";
import { communityApi } from "../../lib/community/api";
import { communityStore, drafts, validDraft } from "../../lib/community/store";
import {
  ANONYMOUS_HELP,
  EMPTY_DRAFT,
  PII_MESSAGE,
  TOPICS,
  hasPersonalInfo,
  validateText,
  type Discussion,
  type Draft,
  type Topic,
  type Viewer,
} from "../../lib/community/contract";
import { pickPhotos } from "../../lib/community/photos";
import {
  Button,
  CommunityGate,
  CommunityScreen,
  ErrorBox,
  Notice,
  s,
} from "../../components/community/shared";
import { useConfirm } from "../../components/community/dialogs";
export default function NewDiscussion() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  return (
    <CommunityScreen>
      <Stack.Screen
        options={{
          title: edit ? "Edit discussion" : "New discussion",
          headerShown: false,
        }}
      />
      <CommunityGate>
        {(viewer, owner) =>
          viewer.canWrite ? (
            <ComposerEntry
              key={`${owner}:${edit || "new"}`}
              viewer={viewer}
              owner={owner}
              editId={edit}
            />
          ) : (
            <View style={s.content}>
              <Notice>
                You can read discussions, but posting is currently unavailable.
              </Notice>
              <Button
                label="Back to Community"
                onPress={() => router.dismissTo("/community")}
              />
            </View>
          )
        }
      </CommunityGate>
    </CommunityScreen>
  );
}
function ComposerEntry({
  viewer,
  owner,
  editId,
}: {
  viewer: Viewer;
  owner: string;
  editId?: string;
}) {
  const query = useCommunityQuery<Discussion>(
    editId || "new",
    "get-post",
    { postId: editId },
    !!editId,
  );
  if (!editId) return <Composer viewer={viewer} owner={owner} />;
  if (query.error)
    return <ErrorBox error={query.error} retry={() => void query.reload()} />;
  const post = query.value?.post;
  if (!post) return <Notice>Loading your discussion…</Notice>;
  if (!post.author.isMine || post.status !== "visible")
    return (
      <View style={s.content}>
        <Notice>Only the author can edit a visible discussion.</Notice>
        <Button
          label="Back to Community"
          onPress={() => router.dismissTo("/community")}
        />
      </View>
    );
  return (
    <Composer
      viewer={viewer}
      owner={owner}
      editId={post.id}
      initialDraft={{
        title: post.title,
        body: post.body,
        topic: post.topic,
        isAnonymous: post.author.anonymous,
        photos: [],
      }}
    />
  );
}
function Composer({
  viewer,
  owner,
  editId,
  initialDraft,
}: {
  viewer: Viewer;
  owner: string;
  editId?: string;
  initialDraft?: Draft;
}) {
  const [draft, setDraft] = useState<Draft>(initialDraft || EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(!!editId);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [storageMessage, setStorageMessage] = useState("");
  const [restored, setRestored] = useState(false);
  const [published, setPublished] = useState(false);
  const [saveAndClose, setSaveAndClose] = useState(false);
  const [destination, setDestination] = useState<{
    id: string;
    pii: boolean;
  } | null>(null);
  useEffect(() => {
    if (saveAndClose && communityStore.owner === owner) {
      router.dismissTo("/community");
      return;
    }
    if (published && destination && communityStore.owner === owner)
      router.dismissTo({
        pathname: "/community/[postId]",
        params: {
          postId: destination.id,
          ...(destination.pii ? { pii: "true" } : {}),
        },
      });
  }, [published, destination, owner, saveAndClose]);
  const busyRef = useRef(false),
    pickingRef = useRef(false),
    finished = useRef(false);
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);
  const loaded = useRef(false);
  const discarded = useRef(false);
  const [initial] = useState<Draft>(initialDraft || EMPTY_DRAFT);
  const { confirm, dialog } = useConfirm();
  const navigation = useNavigation();
  const dirty =
    hydrated && !published && JSON.stringify(draft) !== JSON.stringify(initial);
  usePreventRemove(
    (dirty || busy) && !published && !saveAndClose,
    ({ data }) => {
      if (busyRef.current) return;
      void confirm("Discard unsaved discussion changes?").then(async (yes) => {
        if (!yes) return;
        discarded.current = true;
        if (!editId)
          await drafts
            .remove(owner)
            .catch(() =>
              setStorageMessage(
                "The saved draft could not be removed from this device.",
              ),
            );
        navigation.dispatch(data.action);
      });
    },
  );
  useEffect(() => {
    if (editId) return;
    let active = true;
    void drafts
      .load(owner)
      .then((value) => {
        if (!active) return;
        const saved = validDraft(value);
        if (saved) {
          setDraft(saved);
          setRestored(true);
        }
        loaded.current = true;
        setHydrated(true);
      })
      .catch(() => {
        if (active) {
          loaded.current = true;
          setHydrated(true);
          setStorageMessage(
            "Your saved draft couldn't be restored. Device storage may be unavailable.",
          );
        }
      });
    return () => {
      active = false;
      if (loaded.current && !finished.current && !discarded.current)
        void drafts.save(owner, latest.current).catch(() => {});
    };
  }, [owner, editId]);
  useEffect(() => {
    if (!hydrated || editId || published) return;
    const timer = setTimeout(() => {
      if (discarded.current || finished.current) return;
      void drafts
        .save(owner, draft)
        .then(() => setStorageMessage("Draft saved on this device."))
        .catch(() =>
          setStorageMessage(
            "Draft couldn't be saved on this device. Keep this screen open to preserve your text.",
          ),
        );
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, hydrated, owner, editId, published]);
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty || saveAndClose) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty, saveAndClose]);
  async function submit() {
    if (busyRef.current || finished.current) return;
    const problem = validateText(
      draft.body,
      true,
      viewer.newAccount,
      draft.title,
    );
    if (problem) {
      setError(new Error(problem));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      let id = editId,
        piiWarning = false;
      if (editId)
        await communityApi(owner, "edit-post", {
          postId: editId,
          title: draft.title.trim(),
          body: draft.body.trim(),
          topic: draft.topic,
        });
      else {
        const result = await communityApi<{ id: string; piiWarning: boolean }>(
          owner,
          "create-post",
          {
            title: draft.title.trim(),
            body: draft.body.trim(),
            topic: draft.topic,
            isAnonymous: draft.isAnonymous,
            ...(draft.photos.length
              ? { photos: draft.photos.map((photo) => ({ data: photo.data })) }
              : {}),
          },
        );
        id = result.id;
        piiWarning = result.piiWarning;
      }
      finished.current = true;
      setPublished(true);
      if (!editId)
        await drafts
          .remove(owner)
          .catch(() =>
            setStorageMessage(
              "Submitted, but the local draft couldn't be removed.",
            ),
          );
      communityStore.invalidate();
      setDestination({ id: id!, pii: piiWarning });
    } catch (e) {
      setError(e as Error);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function addPhotos() {
    if (pickingRef.current) return;
    pickingRef.current = true;
    setPicking(true);
    setError(null);
    try {
      const photos = await pickPhotos(4 - draft.photos.length);
      setDraft((current) => ({
        ...current,
        photos: [...current.photos, ...photos].slice(0, 4),
      }));
    } catch (e) {
      setError(e as Error);
    } finally {
      pickingRef.current = false;
      setPicking(false);
    }
  }
  if (!hydrated)
    return <Notice>Loading your {editId ? "discussion" : "draft"}…</Notice>;
  return (
    <>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Button
          label="Back to Community"
          disabled={busy}
          onPress={() => {
            if (navigation.canGoBack()) router.back();
            else router.dismissTo("/community");
          }}
        />
        <Text accessibilityRole="header" style={s.title}>
          {editId ? "Edit discussion" : "New discussion"}
        </Text>
        <Text style={s.body}>
          Be specific so people can help. Be kind and keep personal details
          private.
        </Text>
        {restored && <Notice>Your draft was restored on this device.</Notice>}
        <Text style={s.heading}>Topic</Text>
        <View style={s.row}>
          {Object.entries(TOPICS).map(([value, label]) => (
            <Button
              key={value}
              label={label}
              selected={draft.topic === value}
              disabled={busy}
              onPress={() =>
                setDraft((current) => ({ ...current, topic: value as Topic }))
              }
            />
          ))}
        </View>
        <Text style={s.heading}>Title</Text>
        <TextInput
          accessibilityLabel="Discussion title"
          placeholder="e.g. How do I follow up after an interview?"
          maxLength={140}
          value={draft.title}
          editable={!busy}
          onChangeText={(title) =>
            setDraft((current) => ({ ...current, title }))
          }
          style={s.field}
        />
        <Text style={s.muted}>{draft.title.length}/140</Text>
        <Text style={s.heading}>Details</Text>
        <TextInput
          accessibilityLabel="Discussion details"
          placeholder="Give a bit of background (at least 20 characters)."
          multiline
          maxLength={5000}
          value={draft.body}
          editable={!busy}
          onChangeText={(body) => setDraft((current) => ({ ...current, body }))}
          style={[s.field, { minHeight: 180, textAlignVertical: "top" }]}
        />
        <Text style={s.muted}>{draft.body.length}/5000</Text>
        {hasPersonalInfo(`${draft.title} ${draft.body}`) && (
          <Notice>{PII_MESSAGE}</Notice>
        )}
        {!!draft.body &&
          !!validateText(draft.body, true, viewer.newAccount, draft.title) && (
            <Text style={s.muted}>
              {validateText(draft.body, true, viewer.newAccount, draft.title)}
            </Text>
          )}
        {!editId && (
          <>
            <Text style={s.heading}>Photos · {draft.photos.length}/4</Text>
            <Text style={s.muted}>
              JPEG or PNG, max 5 MB each and 4000 pixels per side. Location and
              camera details are removed.
            </Text>
            <View style={s.row}>
              {draft.photos.map((photo, index) => (
                <View key={index} style={{ width: 132, gap: 4 }}>
                  <Image
                    source={{ uri: photo.data }}
                    style={{ width: 132, height: 100 }}
                    contentFit="cover"
                    cachePolicy="none"
                    accessibilityLabel={`Attached photo ${index + 1}`}
                  />
                  <Button
                    label={`Remove photo ${index + 1}`}
                    disabled={busy}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        photos: current.photos.filter((_, i) => i !== index),
                      }))
                    }
                  />
                </View>
              ))}
            </View>
            <Button
              label={picking ? "Reading photos…" : "Add photos"}
              disabled={picking || busy || draft.photos.length >= 4}
              onPress={() => void addPhotos()}
            />
            <View style={s.row}>
              <Switch
                value={draft.isAnonymous}
                onValueChange={(isAnonymous) =>
                  setDraft((current) => ({ ...current, isAnonymous }))
                }
                disabled={busy}
                accessibilityLabel="Post anonymously"
                trackColor={{ true: Colors.primary, false: Colors.border }}
              />
              <Text style={s.body}>Post anonymously</Text>
            </View>
            <Text style={s.muted}>{ANONYMOUS_HELP}</Text>
          </>
        )}
        {!!storageMessage && (
          <Text accessibilityLiveRegion="polite" style={s.muted}>
            {storageMessage}
          </Text>
        )}
        <ErrorBox error={error} />
        {!editId && (
          <Button
            label="Save draft and close"
            disabled={busy || picking || published}
            onPress={async () => {
              try {
                await drafts.save(owner, draft);
                setSaveAndClose(true);
              } catch {
                setStorageMessage(
                  "Draft couldn't be saved. Keep this screen open to preserve your text.",
                );
              }
            }}
          />
        )}
        <Button
          primary
          label={
            busy
              ? "Submitting discussion…"
              : editId
                ? "Save discussion changes"
                : "Publish discussion"
          }
          disabled={
            busy ||
            picking ||
            published ||
            !!validateText(draft.body, true, viewer.newAccount, draft.title)
          }
          onPress={() => void submit()}
        />
      </ScrollView>
      {dialog}
    </>
  );
}
