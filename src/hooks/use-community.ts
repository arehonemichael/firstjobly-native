import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "./use-auth";
import { communityApi } from "../lib/community/api";
import {
  communityStore,
  COMMUNITY_TTL,
  MEDIA_REFRESH,
} from "../lib/community/store";
import type { Action } from "../lib/community/transport";

/** Cache/query identities include the owner and the complete filter/route key.
 * Async completions from old queries cannot populate a new screen/account. */
export function useCommunityQuery<T>(
  key: string,
  action: Action,
  data: Record<string, unknown>,
  enabled = true,
) {
  const { userId, loading: authLoading } = useAuth();
  const revision = useSyncExternalStore(
    communityStore.subscribe,
    communityStore.getRevision,
    communityStore.getRevision,
  );
  const queryKey = `${userId}:${action}:${key}`;
  const encoded = JSON.stringify(data);
  const args = useMemo<Record<string, unknown>>(
    () => JSON.parse(encoded),
    [encoded],
  );
  const tracker = useRef({ generation: 0, flight: false });
  const [request, setRequest] = useState({
    key: "",
    loading: false,
    more: false,
    error: null as Error | null,
  });
  const entry = userId ? communityStore.read<T>(userId, queryKey) : undefined;
  const reload = useCallback(
    async function run(cursor?: string, merge?: (old: T, page: T) => T) {
      if (!userId || !enabled || tracker.current.flight) return;
      const ticket = ++tracker.current.generation;
      const version = communityStore.version;
      let stale = false;
      tracker.current.flight = true;
      setRequest({
        key: queryKey,
        loading: !cursor,
        more: !!cursor,
        error: null,
      });
      try {
        const page = await communityApi<T>(
          userId,
          cursor && action === "get-post" ? "list-comments" : action,
          { ...args, ...(cursor ? { cursor } : {}) },
        );
        if (
          ticket !== tracker.current.generation ||
          userId !== communityStore.owner
        )
          return;
        if (version !== communityStore.version) {
          stale = true;
          return;
        }
        const previous = communityStore.read<T>(userId, queryKey);
        communityStore.write(
          userId,
          queryKey,
          cursor && previous && merge ? merge(previous.value, page) : page,
          cursor && previous
            ? previous.at || Date.now() - COMMUNITY_TTL
            : Date.now(),
        );
      } catch (error) {
        if (
          ticket === tracker.current.generation &&
          userId === communityStore.owner
        )
          setRequest({
            key: queryKey,
            loading: false,
            more: false,
            error:
              error instanceof Error
                ? error
                : new Error("Couldn't load Community."),
          });
      } finally {
        if (ticket === tracker.current.generation) {
          tracker.current.flight = false;
          setRequest((old) => ({ ...old, loading: false, more: false }));
          if (stale && userId === communityStore.owner) void run();
        }
      }
    },
    [userId, enabled, queryKey, action, tracker, args],
  );
  useEffect(() => {
    const state = tracker.current;
    state.generation++;
    state.flight = false;
    return () => {
      state.generation++;
      state.flight = false;
    };
  }, [queryKey, encoded, userId, enabled]);
  useFocusEffect(
    useCallback(() => {
      // A cache notification re-evaluates staleness for the focused screen.
      void revision;
      if (authLoading || !enabled || !userId) return;
      const current = communityStore.read<T>(userId, queryKey);
      if (
        !current ||
        (action === "viewer-state" && Date.now() - current.at > 1000) ||
        Date.now() - current.at > COMMUNITY_TTL
      )
        void reload();
      // Refresh before signed media expires; no persisted signed URLs.
      const timer = setInterval(() => {
        const value = communityStore.read<T>(userId, queryKey);
        if (
          AppState.currentState === "active" &&
          (!value || Date.now() - value.at >= MEDIA_REFRESH - 60000)
        )
          void reload();
      }, 60000);
      const resume = AppState.addEventListener("change", (state) => {
        const value = communityStore.read<T>(userId, queryKey);
        if (
          state === "active" &&
          (!value || Date.now() - value.at >= COMMUNITY_TTL)
        )
          void reload();
      });
      return () => {
        clearInterval(timer);
        resume.remove();
      };
    }, [userId, queryKey, reload, enabled, authLoading, revision, action]),
  );
  return {
    value: enabled ? entry?.value : undefined,
    loading:
      enabled &&
      ((!entry && request.key !== queryKey) ||
        (request.key === queryKey && request.loading)),
    more: request.key === queryKey && request.more,
    error: request.key === queryKey ? request.error : null,
    reload,
  };
}
