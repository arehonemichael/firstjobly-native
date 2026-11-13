import { supabase } from "../supabase";
import { createCircularTransport } from "./transport";
import { createOwnerCache, createApplications } from "./state";
import { deleteTemporary } from "./io";
const debugCircular =
  typeof __DEV__ !== "undefined" &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_CIRCULAR_DEBUG === "true";
export const circularAPI = createCircularTransport(
  supabase.auth,
  fetch,
  Date.now,
  debugCircular
    ? (entry) => console.info("[FirstJobly circular]", JSON.stringify(entry))
    : undefined,
);
export const circularCache = createOwnerCache();
export const applications = createApplications((uri) => {
  void deleteTemporary(uri);
});
let owner: string | null = null;
supabase.auth.onAuthStateChange((_event, session) => {
  const next = session?.user.id ?? null;
  if (next !== owner) {
    circularAPI.invalidateReads();
    circularCache.clear();
    applications.clear();
    owner = next;
  }
});
export function invalidateCircular() {
  circularAPI.invalidateReads();
  circularCache.clear();
}
const withdrawn = new Map<string, Set<string>>();
export function rememberWithdrawn(owner: string, id: string) {
  let ids = withdrawn.get(owner);
  if (!ids) {
    ids = new Set();
    withdrawn.set(owner, ids);
  }
  ids.add(id);
  circularCache.clear();
}
export function isWithdrawn(owner: string | null, id: string) {
  return !!owner && !!withdrawn.get(owner)?.has(id);
}
supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") withdrawn.clear();
});
