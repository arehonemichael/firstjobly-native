import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AppState } from "react-native";
import {
  getRecommendations,
  getCachedRecommendations,
  latestFallback,
  RecommendationError,
  sendRecommendationFeedback,
  subscribeRecommendations,
} from "../lib/recommendations/api";
import type {
  DismissReason,
  FeedFilters,
  FeedPage,
  RankedJob,
} from "../lib/recommendations/contracts";

type State = {
  owner: string | null;
  filterKey: string;
  page: FeedPage | null;
  loading: boolean;
  error: string | null;
  fallback: boolean;
  dismissed: RankedJob | null;
};
export function useRecommendations(
  userId: string | null,
  authLoading: boolean,
  filters: FeedFilters = {},
) {
  const filterKey = JSON.stringify(filters),
    generation = useRef(0);
  const initialPage = authLoading
    ? null
    : getCachedRecommendations(userId, filters);
  const [state, setState] = useState<State>({
    owner: userId,
    filterKey,
    page: initialPage,
    loading: !initialPage,
    error: null,
    fallback: false,
    dismissed: null,
  });
  const refresh = useCallback(async () => {
    if (authLoading) return;
    const ticket = ++generation.current;
    const cached = getCachedRecommendations(userId, JSON.parse(filterKey));
    setState((s) => ({
      owner: userId,
      filterKey,
      page:
        cached ??
        (s.owner === userId && s.filterKey === filterKey ? s.page : null),
      loading: !cached,
      error: null,
      fallback: false,
      dismissed: s.owner === userId ? s.dismissed : null,
    }));
    try {
      const page = await getRecommendations(JSON.parse(filterKey));
      if (ticket === generation.current)
        setState((s) => ({
          ...s,
          owner: userId,
          filterKey,
          page,
          loading: false,
          error: null,
          fallback: false,
        }));
    } catch {
      let page: FeedPage | null = null;
      try {
        page = await latestFallback(JSON.parse(filterKey), userId);
      } catch {}
      if (ticket === generation.current)
        setState((s) => ({
          ...s,
          owner: userId,
          filterKey,
          page,
          loading: false,
          error: page
            ? "Personalization is unavailable. Showing latest opportunities."
            : "Recommendations are unavailable. Retry or browse job search.",
          fallback: true,
        }));
    }
  }, [userId, authLoading, filterKey]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const unsubscribe = subscribeRecommendations(() => void refresh());
      const app = AppState.addEventListener("change", (value) => {
        if (value === "active") void refresh();
      });
      return () => {
        generation.current++;
        unsubscribe();
        app.remove();
      };
    }, [refresh]),
  );
  const current =
    state.owner === userId && state.filterKey === filterKey ? state : null;
  const loadMore = useCallback(async () => {
    if (!current?.page?.nextCursor || current.loading) return;
    const ticket = ++generation.current,
      cursor = current.page.nextCursor;
    setState((s) => ({ ...s, loading: true }));
    try {
      const page = await getRecommendations(JSON.parse(filterKey), cursor);
      if (ticket === generation.current)
        setState((s) => ({
          ...s,
          page: {
            ...page,
            items: [
              ...(s.page?.items ?? []),
              ...page.items.filter(
                (row) =>
                  !s.page?.items.some((old) => old.job.id === row.job.id),
              ),
            ],
          },
          loading: false,
        }));
    } catch (error) {
      if (
        error instanceof RecommendationError &&
        error.code === "REFRESH_REQUIRED"
      ) {
        void refresh();
        return;
      }
      if (ticket === generation.current)
        setState((s) => ({
          ...s,
          loading: false,
          error: "Could not load more opportunities. Please retry.",
        }));
    }
  }, [current, filterKey, refresh]);
  const feedback = async (
    row: RankedJob,
    kind: "dismissed" | "more_like_this",
    reason?: DismissReason,
  ) => {
    await sendRecommendationFeedback(row.job.id, kind, reason);
    if (kind === "dismissed")
      setState((s) =>
        s.owner === userId
          ? {
              ...s,
              dismissed: row,
              page: s.page
                ? {
                    ...s.page,
                    items: s.page.items.filter((r) => r.job.id !== row.job.id),
                  }
                : null,
            }
          : s,
      );
  };
  const undo = async () => {
    if (current?.dismissed) {
      await sendRecommendationFeedback(current.dismissed.job.id, "undo");
      setState((s) => ({ ...s, dismissed: null }));
    }
  };
  return {
    page:
      current?.page ??
      (authLoading ? null : getCachedRecommendations(userId, filters)),
    loading: current?.loading ?? !initialPage,
    error: current?.error ?? null,
    fallback: current?.fallback ?? false,
    dismissed: current?.dismissed ?? null,
    refresh,
    loadMore,
    feedback,
    undo,
  };
}
