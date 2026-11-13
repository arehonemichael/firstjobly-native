import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { UsersRound } from "lucide-react-native";
import {
  AppText as Text,
  AppTextInput as TextInput,
} from "../../components/ui/primitives";
import { Colors } from "../../constants/theme";
import { communityStore } from "../../lib/community/store";
import { useCommunityQuery } from "../../hooks/use-community";
import {
  SCOPES,
  TOPICS,
  type Feed,
  type Post,
  type Scope,
  type Topic,
  type Viewer,
} from "../../lib/community/contract";
import {
  Button,
  CommunityGate,
  CommunityScreen,
  ErrorBox,
  s,
} from "../../components/community/shared";
import { PostCard } from "../../components/community/post-card";
export default function Community() {
  return (
    <CommunityScreen>
      <CommunityGate>
        {(viewer, owner) => (
          <CommunityFeed key={owner} viewer={viewer} owner={owner} />
        )}
      </CommunityGate>
    </CommunityScreen>
  );
}
function CommunityFeed({ viewer, owner }: { viewer: Viewer; owner: string }) {
  const [initialView] = useState(() => communityStore.readFeedView(owner));
  const list = useRef<FlatList<Post>>(null);
  const offset = useRef(initialView?.offset || 0);
  const focused = useRef(false);
  const restoring = useRef(true);
  const restore = useCallback(() => {
    if (focused.current && restoring.current) {
      list.current?.scrollToOffset({ offset: offset.current, animated: false });
      if (offset.current === 0) restoring.current = false;
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      offset.current = communityStore.readFeedView(owner)?.offset || 0;
      restoring.current = true;
      const frame = requestAnimationFrame(restore);
      return () => {
        focused.current = false;
        cancelAnimationFrame(frame);
      };
    }, [owner, restore]),
  );
  const [showViews, setShowViews] = useState(false);
  const [showTopics, setShowTopics] = useState(false);
  const [scope, setScope] = useState<Scope>(initialView?.scope || "all");
  const [topic, setTopic] = useState<Topic | "">(initialView?.topic || "");
  const [draft, setDraft] = useState(initialView?.draft || "");
  const [search, setSearch] = useState(initialView?.draft.trim() || "");
  useEffect(() => {
    const timer = setTimeout(() => setSearch(draft.trim()), 300);
    return () => clearTimeout(timer);
  }, [draft]);
  const filters = useMemo(
    () => ({
      scope,
      ...(topic ? { topic } : {}),
      ...(search ? { search } : {}),
      limit: scope === "top" ? 50 : 15,
    }),
    [scope, topic, search],
  );
  const filterKey = JSON.stringify(filters);
  const previousFilters = useRef(filterKey);
  useEffect(() => {
    if (previousFilters.current !== filterKey) {
      offset.current = 0;
      restoring.current = true;
      previousFilters.current = filterKey;
      restore();
    }
    communityStore.saveFeedView(owner, {
      scope,
      topic,
      draft,
      offset: offset.current,
    });
  }, [filterKey, scope, topic, draft, owner, restore]);
  const query = useCommunityQuery<Feed>(
    JSON.stringify(filters),
    "list-posts",
    filters,
  );
  const pinnedIds = new Set(query.value?.pinned?.map((post) => post.id));
  const posts: Post[] = [
    ...(query.value?.pinned || []),
    ...(query.value?.posts.filter((post) => !pinnedIds.has(post.id)) || []),
  ];
  const filtered = !!topic || !!search;
  const empty = filtered
    ? "No discussions match your filters."
    : scope === "foryou"
      ? "Follow members to see their discussions here."
      : scope === "saved"
        ? "Nothing saved yet."
        : scope === "mine"
          ? "You haven't posted yet."
          : "No discussions yet.";
  function more() {
    if (!query.value?.nextCursor || query.more || query.loading) return;
    void query.reload(query.value.nextCursor, (previous, page) => ({
      ...previous,
      posts: [
        ...new Map(
          [...previous.posts, ...page.posts].map((post) => [post.id, post]),
        ).values(),
      ],
      nextCursor: page.nextCursor,
    }));
  }
  return (
    <FlatList
      testID="community-feed"
      ref={list}
      onContentSizeChange={restore}
      onLayout={restore}
      onScrollBeginDrag={() => {
        restoring.current = false;
      }}
      onScroll={(event) => {
        if (!focused.current) return;
        const next = event.nativeEvent.contentOffset.y;
        // Hidden/reattached scroll views may emit zero before restoration.
        if (restoring.current && Math.abs(next - offset.current) > 2) return;
        restoring.current = false;
        offset.current = next;
        communityStore.saveFeedView(owner, {
          scope,
          topic,
          draft,
          offset: offset.current,
        });
      }}
      scrollEventThrottle={16}
      style={{ flex: 1 }}
      contentContainerStyle={s.content}
      data={posts}
      keyExtractor={(post) => post.id}
      keyboardShouldPersistTaps="handled"
      refreshing={!!query.value && query.loading}
      onRefresh={() => void query.reload()}
      onEndReached={() => {
        if (!query.error) more();
      }}
      onEndReachedThreshold={0.35}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 16 }}>
          <View style={s.row}>
            <UsersRound size={22} color={Colors.primary} />
            <Text accessibilityRole="header" style={s.title}>
              Community
            </Text>
          </View>
          <Text style={s.body}>Ask questions. Share advice.</Text>
          {viewer.canWrite && (
            <Button
              primary
              label="Ask or share"
              onPress={() => router.push("/community/new")}
            />
          )}
          <View style={s.row}>
            {(["all", "top"] as const).map((value) => (
              <Button
                key={value}
                quiet
                label={SCOPES[value]}
                selected={scope === value}
                onPress={() => {
                  setScope(value);
                  setShowViews(false);
                }}
              />
            ))}
            <Button
              label={
                scope !== "all" && scope !== "top"
                  ? SCOPES[scope]
                  : "More feeds"
              }
              selected={scope !== "all" && scope !== "top"}
              onPress={() => setShowViews(!showViews)}
            />
          </View>
          {showViews && (
            <View style={s.row}>
              {(["foryou", "saved", "mine"] as const).map((value) => (
                <Button
                  key={value}
                  quiet
                  label={SCOPES[value]}
                  selected={scope === value}
                  onPress={() => {
                    setScope(value);
                    setShowViews(false);
                  }}
                />
              ))}
            </View>
          )}
          <TextInput
            accessibilityLabel="Search discussions"
            placeholder="Search discussions"
            value={draft}
            onChangeText={setDraft}
            maxLength={120}
            style={s.field}
          />
          <View style={s.row}>
            <Button
              label={
                showTopics
                  ? "Hide topics"
                  : topic
                    ? `Topic: ${TOPICS[topic]}`
                    : "Filter by topic"
              }
              selected={!!topic}
              onPress={() => setShowTopics(!showTopics)}
            />
            {(filtered || !!draft) && (
              <Button
                quiet
                label="Reset filters"
                onPress={() => {
                  setTopic("");
                  setDraft("");
                  setSearch("");
                }}
              />
            )}
          </View>
          {showTopics && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              <Button
                quiet
                label="All topics"
                selected={!topic}
                onPress={() => setTopic("")}
              />
              {Object.entries(TOPICS).map(([value, label]) => (
                <Button
                  key={value}
                  quiet
                  label={label}
                  selected={topic === value}
                  onPress={() => setTopic(value as Topic)}
                />
              ))}
            </ScrollView>
          )}
          <ErrorBox error={query.error} retry={() => void query.reload()} />
          {query.loading && !query.value && (
            <View accessibilityLabel="Loading discussions" style={{ gap: 12 }}>
              {[0, 1, 2].map((key) => (
                <View key={key} style={[s.card, { height: 160, opacity: 0.6 }]}>
                  <View
                    style={{
                      width: "55%",
                      height: 18,
                      backgroundColor: Colors.border,
                    }}
                  />
                  <View
                    style={{
                      width: "90%",
                      height: 12,
                      backgroundColor: Colors.secondary,
                    }}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <PostCard
          post={item}
          viewer={viewer}
          owner={owner}
          renew={() => void query.reload()}
        />
      )}
      ListEmptyComponent={
        !query.loading && !query.error ? (
          <View style={s.card}>
            <Text style={s.heading}>{empty}</Text>
            <Text style={s.muted}>
              {filtered
                ? "Try a different search or reset your filters above."
                : viewer.canWrite
                  ? "Use Ask or share above to start a conversation."
                  : "Discussions will appear here when members post."}
            </Text>
          </View>
        ) : null
      }
      ListFooterComponent={
        query.more ? (
          <ActivityIndicator
            accessibilityLabel="Loading more discussions"
            color={Colors.primary}
          />
        ) : query.value?.nextCursor ? (
          <Button label="Load more discussions" onPress={more} />
        ) : null
      }
    />
  );
}
