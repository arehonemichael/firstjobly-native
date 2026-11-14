import type { Detail, Method } from "./contract";
function cacheable(value: unknown) {
  if (value && typeof value === "object") {
    if (
      "items" in value &&
      Array.isArray(value.items) &&
      value.items.length === 0
    )
      return false;
    if ("batch" in value && value.batch === null) return false;
  }
  return true;
}
export function createOwnerCache(now: () => number = Date.now) {
  const records = new Map<string, { value: unknown; expires: number }>();
  return {
    get<T>(owner: string, key: string): T | undefined {
      const row = records.get(owner + "|" + key);
      if (row && row.expires > now() && cacheable(row.value))
        return row.value as T;
      if (row && row.expires + 55 * 60000 <= now())
        records.delete(owner + "|" + key);
      return undefined;
    },
    // List-only stale fallback; never use this for expiring download/detail URLs.
    peek<T>(owner: string, key: string): T | undefined {
      const row = records.get(owner + "|" + key);
      if (row && row.expires + 55 * 60000 > now() && cacheable(row.value))
        return row.value as T;
      records.delete(owner + "|" + key);
      return undefined;
    },
    set(owner: string, key: string, value: unknown) {
      if (!cacheable(value)) {
        records.delete(owner + "|" + key);
        return;
      }
      records.delete(owner + "|" + key);
      records.set(owner + "|" + key, { value, expires: now() + 300000 });
      if (records.size > 100) records.delete(records.keys().next().value!);
    },
    clear() {
      records.clear();
    },
  };
}
export type Application = {
  key: string;
  owner: string;
  detail: Detail;
  method: Method;
  z83: string | null;
  cv: string | null;
  cvName: string | null;
};
export function createApplications(cleanup: (uri: string) => void) {
  const items = new Map<string, Application>();
  let serial = 0;
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    create(owner: string, detail: Detail, method: Method) {
      const key = Date.now().toString(36) + "-" + (++serial).toString(36);
      const item: Application = {
        key,
        owner,
        detail,
        method,
        z83: null,
        cv: null,
        cvName: null,
      };
      items.set(key, item);
      emit();
      return key;
    },
    get(owner: string | null, key: string | undefined) {
      const item = key ? items.get(key) : undefined;
      return item?.owner === owner ? item : undefined;
    },
    setFile(
      owner: string,
      key: string,
      kind: "z83" | "cv",
      uri: string,
      name?: string,
    ) {
      const item = this.get(owner, key);
      if (!item) {
        cleanup(uri);
        return false;
      }
      if (item[kind]) cleanup(item[kind]!);
      items.set(key, {
        ...item,
        [kind]: uri,
        ...(kind === "cv" ? { cvName: name || "CV.pdf" } : {}),
      });
      emit();
      return true;
    },
    remove(key: string) {
      const item = items.get(key);
      if (item) {
        if (item.z83) cleanup(item.z83);
        if (item.cv) cleanup(item.cv);
        items.delete(key);
        emit();
      }
    },
    clear() {
      for (const key of items.keys()) this.remove(key);
    },
  };
}
