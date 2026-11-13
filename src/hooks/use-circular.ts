import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./use-auth";
import {
  circularAPI,
  circularCache,
  invalidateCircular,
  isWithdrawn,
} from "../lib/circular/client";
import { CircularError } from "../lib/circular/transport";
import type {
  Batch,
  CircularJob,
  Filters,
  Page,
} from "../lib/circular/contract";
import { listPath } from "../lib/circular/contract";
const listeners = new Set<() => void>();
export function circularChanged() {
  invalidateCircular();
  for (const listener of listeners) listener();
}
export function useCircularQuery<T>(path: string | null) {
  const { userId, loading: authLoading } = useAuth();
  const [snapshot, setSnapshot] = useState<{
    owner: string | null;
    path: string | null;
    data?: T;
    error?: Error;
    loading: boolean;
  }>({ owner: null, path: null, loading: false });
  const version = useRef(0);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const load = useCallback(
    async (force = false) => {
      const call = ++version.current;
      if (!userId || !path) return;
      const cached = !force ? circularCache.get<T>(userId, path) : undefined;
      if (cached !== undefined) {
        if (alive.current)
          setSnapshot({ owner: userId, path, data: cached, loading: false });
        return;
      }
      setSnapshot((old) => ({
        owner: userId,
        path,
        data: old.owner === userId && old.path === path ? old.data : undefined,
        loading: true,
      }));
      try {
        const data = await circularAPI.request<T>(userId, path);
        if (alive.current && version.current === call) {
          circularCache.set(userId, path, data);
          setSnapshot({ owner: userId, path, data, loading: false });
        }
      } catch (error) {
        if (alive.current && version.current === call)
          setSnapshot((old) => ({
            ...old,
            error: error as Error,
            loading: false,
          }));
      }
    },
    [userId, path],
  );
  useFocusEffect(
    useCallback(() => {
      void load();
      const update = () => void load(true);
      listeners.add(update);
      return () => {
        version.current++;
        listeners.delete(update);
      };
    }, [load]),
  );
  const valid = snapshot.owner === userId && snapshot.path === path;
  return {
    data: valid ? snapshot.data : undefined,
    error: valid ? snapshot.error : undefined,
    loading:
      authLoading || (!!userId && !!path && (!valid || snapshot.loading)),
    refresh: () => load(true),
    userId,
    authLoading,
  };
}
export function useLatestCircular() {
  return useCircularQuery<{ batch: Batch | null }>("/circular-batches/latest");
}
export function useCircularFeed(filters: Filters, saved = false) {
  const path = saved ? "/circular-jobs/saved" : listPath(filters);
  const query = useCircularQuery<Page | { items: CircularJob[] }>(path);
  const [extra, setExtra] = useState<{
    path: string;
    owner: string;
    base: Page | { items: CircularJob[] } | undefined;
    items: CircularJob[];
    page: number;
    more: boolean;
    error?: Error;
  } | null>(null);
  const [paging, setPaging] = useState(false);
  const lock = useRef(false);
  const valid =
    extra?.path === path &&
    extra?.owner === query.userId &&
    extra?.base === query.data;
  const items = [...(query.data?.items || []), ...(valid ? extra.items : [])];
  const visibleItems = saved
    ? items.filter((item) => !isWithdrawn(query.userId, item.id))
    : items;
  const more =
    !saved &&
    (valid
      ? extra.more
      : !!(query.data && "has_more" in query.data && query.data.has_more));
  async function next() {
    if (!query.userId || !more || lock.current) return;
    lock.current = true;
    setPaging(true);
    const owner = query.userId;
    const initial = query.data;
    const page = (valid ? extra.page : 1) + 1;
    try {
      const result = await circularAPI.request<Page>(
        owner,
        listPath(filters, page),
      );
      setExtra({
        path,
        owner,
        base: initial,
        items: [...(valid ? extra.items : []), ...result.items],
        page,
        more: result.has_more,
      });
    } catch (error) {
      setExtra({
        path,
        owner,
        base: initial,
        items: valid ? extra.items : [],
        page: valid ? extra.page : 1,
        more: true,
        error: error as Error,
      });
    } finally {
      lock.current = false;
      setPaging(false);
    }
  }
  return {
    ...query,
    items: Array.from(
      new Map(visibleItems.map((item) => [item.id, item])).values(),
    ),
    more,
    paging,
    pageError: valid ? extra.error : undefined,
    next,
    refresh: async () => {
      setExtra(null);
      await query.refresh();
    },
  };
}
export function useCircularSave() {
  const { userId } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const lock = useRef(false);
  async function save(job: CircularJob) {
    if (!userId || lock.current) return;
    lock.current = true;
    setBusy(job.id);
    try {
      await circularAPI.request(
        userId,
        "/circular-jobs/" + encodeURIComponent(job.id) + "/save",
        job.saved ? "DELETE" : "POST",
      );
      circularChanged();
    } finally {
      lock.current = false;
      setBusy(null);
    }
  }
  return { save, busy };
}
const seenBatches = new Map<string, string | null>();
const seenListeners = new Set<() => void>();
export function useCircularBadge(markSeen = false) {
  const { data, userId } = useLatestCircular();
  const seen = useSyncExternalStore(
    (listener) => {
      seenListeners.add(listener);
      return () => {
        seenListeners.delete(listener);
      };
    },
    () => (userId ? seenBatches.get(userId) : undefined),
    () => undefined,
  );
  const latest = data?.batch?.id;
  useEffect(() => {
    let live = true;
    if (userId && !seenBatches.has(userId))
      void AsyncStorage.getItem("fj-circular-seen:" + userId)
        .then((id) => {
          if (live && !seenBatches.has(userId)) {
            seenBatches.set(userId, id);
            for (const update of seenListeners) update();
          }
        })
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);
  useFocusEffect(
    useCallback(() => {
      if (markSeen && userId && latest && seenBatches.get(userId) !== latest) {
        seenBatches.set(userId, latest);
        for (const update of seenListeners) update();
        void AsyncStorage.setItem("fj-circular-seen:" + userId, latest).catch(
          () => {},
        );
      }
    }, [markSeen, userId, latest]),
  );
  return !!latest && !!userId && seen !== undefined && seen !== latest;
}
export function retrySeconds(error?: Error) {
  return error instanceof CircularError
    ? Math.max(0, Math.ceil((error.retryAt - Date.now()) / 1000))
    : 0;
}
