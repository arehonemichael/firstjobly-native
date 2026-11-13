type Snapshot = {
  owner: string | null;
  ids: string[];
  loading: boolean;
  error: string | null;
};
type Port = {
  read(owner: string): Promise<string[]>;
  write(owner: string, job: string, saved: boolean): Promise<void>;
};
/** One account in memory; never persist private saved associations. */
export function createSavedStore(port: Port, now = Date.now) {
  let state: Snapshot = { owner: null, ids: [], loading: false, error: null };
  let epoch = 0,
    freshAt: number | null = null;
  let pending: Promise<void> | null = null;
  const writes = new Set<string>(),
    listeners = new Set<() => void>();
  const publish = (patch: Partial<Snapshot>) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  function setOwner(owner: string | null) {
    if (owner === state.owner) return;
    epoch++;
    pending = null;
    freshAt = null;
    writes.clear();
    publish({ owner, ids: [], loading: !!owner, error: null });
  }
  async function load(owner: string, force = false) {
    if (state.owner !== owner) return;
    if (pending) return pending;
    if (writes.size) return;
    if (!force && freshAt !== null && now() - freshAt < 60000) return;
    const version = epoch;
    publish({ loading: true, error: null });
    const task = port
      .read(owner)
      .then((ids) => {
        if (epoch !== version || state.owner !== owner) return;
        freshAt = now();
        publish({ ids, loading: false });
      })
      .catch(() => {
        if (epoch === version && state.owner === owner)
          publish({ error: "Saved jobs are unavailable.", loading: false });
      })
      .finally(() => {
        if (pending === task) pending = null;
      });
    pending = task;
    return task;
  }
  async function toggle(owner: string, job: string) {
    if (
      state.owner !== owner ||
      writes.has(job) ||
      state.loading ||
      state.error
    )
      return { ok: false as const, reason: "error" as const };
    const version = epoch,
      saved = !state.ids.includes(job);
    writes.add(job);
    try {
      await port.write(owner, job, saved);
      if (version !== epoch || state.owner !== owner)
        return { ok: false as const, reason: "error" as const };
      // Reads are deferred while writes are pending; publish to every mounted consumer.
      freshAt = now();
      publish({
        ids: saved
          ? [...new Set([...state.ids, job])]
          : state.ids.filter((id) => id !== job),
      });
      return { ok: true as const, saved };
    } catch {
      return { ok: false as const, reason: "error" as const };
    } finally {
      if (version === epoch) writes.delete(job);
    }
  }
  return {
    setOwner,
    load,
    toggle,
    getSnapshot: () => state,
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
