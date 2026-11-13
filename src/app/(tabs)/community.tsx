import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { UsersRound } from "lucide-react-native";
import {
  AppText as Text,
  AppTextInput as TextInput,
} from "../../components/ui/primitives";
import { Colors } from "../../constants/theme";
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
  const [scope, setScope] = useState<Scope>("all");
  const [topic, setTopic] = useState<Topic | "">("");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
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
  const empty =
    scope === "foryou"
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
        <View style={{ gap: 16, marginBottom: 16 }}>
          <View style={s.row}>
            <UsersRound size={26} color={Colors.primary} />
            <Text accessibilityRole="header" style={s.title}>
              Community
            </Text>
          </View>
          <Text style={s.body}>
            Ask questions, share advice and help other job seekers across South
            Africa.
          </Text>
          {viewer.canWrite && (
            <Button
              primary
              label="New post"
              onPress={() => router.push("/community/new")}
            />
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {Object.entries(SCOPES).map(([value, label]) => (
              <Button
                key={value}
                label={label}
                selected={scope === value}
                onPress={() => setScope(value as Scope)}
              />
            ))}
          </ScrollView>
          <TextInput
            accessibilityLabel="Search discussions"
            placeholder="Search discussions"
            value={draft}
            onChangeText={setDraft}
            maxLength={120}
            style={s.field}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            <Button
              label="All topics"
              selected={!topic}
              onPress={() => setTopic("")}
            />
            {Object.entries(TOPICS).map(([value, label]) => (
              <Button
                key={value}
                label={label}
                selected={topic === value}
                onPress={() => setTopic(value as Topic)}
              />
            ))}
          </ScrollView>
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
            {viewer.canWrite && (
              <Button
                label="Start a discussion"
                onPress={() => router.push("/community/new")}
              />
            )}
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
