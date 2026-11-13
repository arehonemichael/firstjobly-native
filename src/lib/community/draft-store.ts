import type { Draft } from "./contract";
export type DraftStorage = {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
};
/** Serialise cleanup with autosaves: a queued write can never resurrect a draft
 * after sign-out. Owner checks also reject late reads from the previous account. */
export function createDraftStore(storage: DraftStorage) {
  let owner: string | null | undefined;
  let queue = Promise.resolve();
  const key = (id: string) => `fj-community-draft:${id}`;
  function enqueue(task: () => Promise<void>) {
    const result = queue.then(task);
    queue = result.catch(() => {});
    return result;
  }
  return {
    setOwner(id: string | null) {
      if (id === owner) return queue;
      const previous = owner;
      owner = id;
      if (previous !== undefined || id === null)
        return enqueue(() => storage.clear());
      return queue;
    },
    async load(id: string): Promise<Draft | null> {
      await queue;
      if (id !== owner) return null;
      const value = await storage.read(key(id));
      if (id !== owner || !value) return null;
      try {
        return JSON.parse(value);
      } catch {
        return null;
      }
    },
    save(id: string, draft: Draft) {
      return enqueue(async () => {
        if (owner === id) await storage.write(key(id), JSON.stringify(draft));
      });
    },
    remove(id: string) {
      return enqueue(() => storage.remove(key(id)));
    },
  };
}
