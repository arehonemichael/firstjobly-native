import { supabase } from "../supabase";
import { createDraftStore } from "./draft-store";
import { draftStorage } from "./draft-storage";
import { TOPICS, type Post, type Draft } from "./contract";
export const drafts = createDraftStore(draftStorage);
export const COMMUNITY_TTL = 5 * 60 * 1000;
export const MEDIA_REFRESH = 45 * 60 * 1000;
type Entry = { value: unknown; at: number; stale?: boolean };
const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();
let owner: string | null | undefined;
let revision = 0;
let dataVersion = 0;
function emit() {
  revision++;
  listeners.forEach((fn) => fn());
}
export const communityStore = {
  get version() {
    return dataVersion;
  },
  get owner() {
    return owner;
  },
  getRevision: () => revision,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  setOwner(id: string | null) {
    if (owner === id) return;
    owner = id;
    dataVersion++;
    cache.clear();
    mutationLocks.clear();
    emit();
    void drafts.setOwner(id).catch(() => {
      /* No private data is read until owner checks pass. */
    });
  },
  read<T>(id: string, key: string): { value: T; at: number } | undefined {
    if (owner !== id) return;
    const entry = cache.get(key);
    // Never return signed URLs older than the provider's one-hour lifetime.
    if (entry && Date.now() - entry.at >= MEDIA_REFRESH) cache.delete(key);
    if (entry && Date.now() - entry.at < MEDIA_REFRESH)
      return { ...entry, at: entry.stale ? 0 : entry.at } as {
        value: T;
        at: number;
      };
  },
  write<T>(id: string, key: string, value: T, at = Date.now()) {
    if (id === owner) {
      cache.delete(key);
      cache.set(key, { value, at });
      for (const [oldKey, old] of cache)
        if (Date.now() - old.at >= MEDIA_REFRESH) cache.delete(oldKey);
      while (cache.size > 40) cache.delete(cache.keys().next().value!);
      emit();
    }
  },
  invalidate() {
    dataVersion++;
    for (const entry of cache.values()) entry.stale = true;
    emit();
  },
  patchPosts(id: string, patch: (post: Post) => Post) {
    if (id !== owner) return;
    dataVersion++;
    for (const [key, entry] of cache) {
      const value = entry.value as {
        post?: Post;
        posts?: Post[];
        pinned?: Post[];
      };
      if (value.post || value.posts)
        cache.set(key, {
          ...entry,
          value: {
            ...value,
            ...(value.post ? { post: patch(value.post) } : {}),
            ...(value.posts ? { posts: value.posts.map(patch) } : {}),
            ...(value.pinned ? { pinned: value.pinned.map(patch) } : {}),
          },
        });
    }
    emit();
  },
};
export const mutationLocks = new Set<string>();
export async function lockedMutation<T>(
  key: string,
  task: () => Promise<T>,
): Promise<T | undefined> {
  if (mutationLocks.has(key)) return;
  mutationLocks.add(key);
  emit();
  try {
    return await task();
  } finally {
    mutationLocks.delete(key);
    emit();
  }
}
export function validDraft(value: Draft | null): Draft | null {
  if (
    !value ||
    typeof value.title !== "string" ||
    typeof value.body !== "string" ||
    !Array.isArray(value.photos)
  )
    return null;
  return {
    title: value.title.slice(0, 140),
    body: value.body.slice(0, 5000),
    topic: Object.hasOwn(TOPICS, value.topic) ? value.topic : "general",
    isAnonymous: value.isAnonymous === true,
    photos: value.photos
      .filter(
        (photo) =>
          photo &&
          typeof photo.data === "string" &&
          /^data:image\/(?:jpeg|png);base64,/.test(photo.data) &&
          photo.width > 0 &&
          photo.height > 0 &&
          photo.width <= 4000 &&
          photo.height <= 4000,
      )
      .slice(0, 4),
  };
}
// Independent of screen lifetime so explicit sign-out also clears unmounted drafts.
supabase.auth.onAuthStateChange((_event, session) =>
  communityStore.setOwner(session?.user.id ?? null),
);
