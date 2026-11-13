type Click = { job_id: string; anonymous_id: string; user_id?: string };
export function createApplyClickRecorder(
  ports: {
    readId(): Promise<string | null>;
    saveId(id: string): Promise<unknown>;
    owner(): Promise<string | null>;
    insert(click: Click): PromiseLike<unknown>;
    newId(): string;
  },
  now = Date.now,
) {
  let device: Promise<string> | null = null;
  const recent = new Map<string, number>();
  const pending = new Set<string>();
  function deviceId() {
    if (!device)
      device = (async () => {
        const saved = await ports.readId();
        if (saved && saved.trim().length >= 16 && saved.length <= 128)
          return saved;
        const next = ports.newId();
        await ports.saveId(next);
        return next;
      })().catch((error) => {
        device = null;
        throw error;
      });
    return device;
  }
  return async function record(jobId: string) {
    try {
      const owner = await ports.owner(),
        key = `${owner || "anon"}:${jobId}`;
      if (pending.has(key) || now() - (recent.get(key) ?? -Infinity) < 60000)
        return;
      pending.add(key);
      try {
        const anonymous_id = await deviceId();
        recent.set(key, now());
        while (recent.size > 100) recent.delete(recent.keys().next().value!);
        // No automatic replay: an uncertain insert may already have reached the server.
        await ports.insert({
          job_id: jobId,
          anonymous_id,
          ...(owner ? { user_id: owner } : {}),
        });
      } finally {
        pending.delete(key);
      }
    } catch {
      /* Optional activity never blocks Apply or changes application state. */
    }
  };
}
