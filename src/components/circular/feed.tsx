import { traceCircularRender } from "../../lib/circular/client";
import { useExtraBoundary } from "../../ads/useExtraBoundary";
import { useEffect, useRef, useState } from "react";
import { FlatList, View, ScrollView } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import {
  AppText as Text,
  AppTextInput as TextInput,
  AppPressable as Pressable,
} from "../ui/primitives";
import { useCircularFeed, useCircularSave } from "../../hooks/use-circular";
import {
  provinces,
  qualifications,
  type Filters,
} from "../../lib/circular/contract";
import { CircularCard } from "./card";
import { LatestCircularCard } from "./latest-card";
import { Button, ErrorState, SignIn, Skeleton, cs } from "./shared";
export function CircularFeed({ saved = false }: { saved?: boolean }) {
  const { batch } = useLocalSearchParams<{ batch?: string }>();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [internships, setInternships] = useState(false);
  const [picker, setPicker] = useState<"province" | "qualification" | null>(
    null,
  );
  const [saveError, setSaveError] = useState<Error>();
  const saver = useCircularSave();
  useEffect(() => {
    const timer = setTimeout(
      () =>
        setFilters((old) => ({ ...old, search: search.trim() || undefined })),
      300,
    );
    return () => clearTimeout(timer);
  }, [search]);
  const query = useCircularFeed(
    { ...filters, ...(batch ? { batch_id: batch } : {}) },
    saved,
  );
  const { data, receivedAt, transformMs } = query;
  const itemCount = query.items.length;
  const painted = useRef<{ data: typeof data; count: number } | null>(null);
  useEffect(() => {
    if (
      !data ||
      (painted.current?.data === data && painted.current?.count === itemCount)
    )
      return;
    const frame = requestAnimationFrame(() => {
      painted.current = { data, count: itemCount };
      traceCircularRender({
        source: saved ? "saved" : "government-jobs",
        items: itemCount,
        transformMs,
        ...(receivedAt === undefined || itemCount !== data.items.length
          ? {}
          : { receivedToFrameMs: performance.now() - receivedAt }),
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [data, receivedAt, itemCount, transformMs, saved]);
  const hasFilters = !!(
    search.trim() ||
    filters.province ||
    filters.qualification ||
    filters.closing_soon ||
    batch ||
    internships
  );
  function clearFilters() {
    setSearch("");
    setFilters({});
    setInternships(false);
    setPicker(null);
    router.setParams({ batch: "" });
  }
  const items = internships
    ? query.items.filter((item) => item.job_type === "internship")
    : query.items;
  const extraScroll = useExtraBoundary(
    saved ? null : "circular-jobs",
    !saved &&
      !query.authLoading &&
      !!query.userId &&
      !!query.data &&
      !query.loading &&
      !query.error &&
      !query.pageError &&
      !query.paging &&
      !saver.busy &&
      !saveError &&
      !hasFilters &&
      !picker,
  );
  if (query.authLoading) return <Skeleton />;
  if (!query.userId)
    return <SignIn returnTo={saved ? "/saved" : "/circular-jobs"} />;
  const set = (
    key: "province" | "qualification",
    value: string | undefined,
  ) => {
    setFilters((old) => ({ ...old, [key]: value }));
    setPicker(null);
  };
  const chip = (label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      key={label}
      accessibilityState={{ selected }}
      style={[cs.chip, selected && cs.selected]}
      onPress={onPress}
    >
      <Text>{label}</Text>
    </Pressable>
  );
  return (
    <FlatList
      onScroll={extraScroll}
      scrollEventThrottle={100}
      testID="circular-feed"
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={cs.content}
      keyboardShouldPersistTaps="handled"
      refreshing={query.loading && !!query.data}
      onRefresh={() => void query.refresh()}
      onEndReached={() => void query.next()}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          {!saved && (
            <>
              <Text style={cs.muted}>
                Entry-level roles · no experience to 3 years
              </Text>
              <LatestCircularCard />
              <TextInput
                placeholder="Search government jobs"
                value={search}
                onChangeText={setSearch}
                maxLength={120}
                style={cs.input}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8 }}
              >
                {chip(filters.province || "Province", !!filters.province, () =>
                  setPicker(picker === "province" ? null : "province"),
                )}
                {chip("Closing soon", !!filters.closing_soon, () =>
                  setFilters((old) => ({
                    ...old,
                    closing_soon: old.closing_soon ? undefined : "1",
                  })),
                )}
                {chip(
                  qualifications.find((q) => q.value === filters.qualification)
                    ?.label || "Qualification",
                  !!filters.qualification,
                  () =>
                    setPicker(
                      picker === "qualification" ? null : "qualification",
                    ),
                )}
                {chip("Internships only", internships, () =>
                  setInternships((v) => !v),
                )}
              </ScrollView>
              {picker && (
                <View style={cs.card}>
                  {chip(
                    "All " +
                      (picker === "province" ? "provinces" : "qualifications"),
                    false,
                    () => set(picker, undefined),
                  )}
                  {(picker === "province"
                    ? provinces.map((value) => ({ value, label: value }))
                    : qualifications
                  ).map((item) =>
                    chip(item.label, filters[picker] === item.value, () =>
                      set(picker, item.value),
                    ),
                  )}
                </View>
              )}
              {hasFilters && (
                <Button
                  label="Clear filters"
                  secondary
                  onPress={clearFilters}
                />
              )}
              {!!batch && (
                <Text style={cs.muted}>
                  Showing the circular from your notification.
                </Text>
              )}
            </>
          )}
          {query.error && (
            <ErrorState error={query.error} retry={query.refresh} />
          )}
          {saveError && (
            <ErrorState
              error={saveError}
              retry={() => setSaveError(undefined)}
            />
          )}
        </View>
      }
      renderItem={({ item }) => (
        <View style={{ marginTop: 12 }}>
          <CircularCard
            job={item}
            busy={saver.busy === item.id}
            onSave={() => {
              setSaveError(undefined);
              void saver.save(item).catch(setSaveError);
            }}
          />
        </View>
      )}
      ListEmptyComponent={
        query.loading ? (
          <Skeleton />
        ) : !query.error ? (
          <View style={[cs.card, { marginTop: 16 }]}>
            <Text style={cs.heading}>
              {saved
                ? "No saved government jobs"
                : internships && query.more
                  ? "Keep looking"
                  : "No open government jobs right now"}
            </Text>
            <Text style={cs.muted}>
              {saved
                ? "Tap the heart on a government job to keep it here."
                : internships && query.more
                  ? "There are more jobs to check for internships. Load the next page."
                  : "New circulars come out every Friday."}
            </Text>
          </View>
        ) : null
      }
      ListFooterComponent={
        <View style={{ gap: 12, marginTop: 16 }}>
          {query.pageError && (
            <ErrorState
              error={query.pageError}
              retry={() => void query.next()}
            />
          )}
          {query.more && (
            <Button
              label={query.paging ? "Loading more jobs…" : "Load more jobs"}
              disabled={query.paging}
              secondary
              onPress={() => void query.next()}
            />
          )}
        </View>
      }
    />
  );
}
