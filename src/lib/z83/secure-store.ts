type Revision = { id: string; count: number };
type Manifest = { version: 1; active?: Revision; pending?: Revision };
type Port = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  owner(): Promise<string | null>;
};
/** All values, including the manifest, live in the OS secure store. Small UTF-8
 * chunks avoid historical iOS 2KB item limits. No plaintext fallback. */
export function createSecureZ83(port: Port) {
  let queue = Promise.resolve();
  const run = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = queue.then(fn);
    queue = next.then(
      () => {},
      () => {},
    );
    return next;
  };
  const base = (owner: string) => {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(owner)) throw Error("Invalid account");
    return `fj.z83.v2.${owner}`;
  };
  const owned = async (owner: string) => {
    if ((await port.owner()) !== owner)
      throw Error("Your account changed. Reopen the Z83 form.");
  };
  const item = (key: string, rev: Revision, index: number) =>
    `${key}.${rev.id}.${index}`;
  const clean = async (key: string, rev?: Revision) => {
    if (rev)
      for (let i = 0; i < rev.count; i++) await port.remove(item(key, rev, i));
  };
  const manifest = async (key: string): Promise<Manifest> => {
    const raw = await port.get(key);
    if (!raw) return { version: 1 };
    const value = JSON.parse(raw);
    if (value.version !== 1) throw Error("Saved Z83 details are unavailable.");
    for (const rev of [value.active, value.pending])
      if (
        rev &&
        (!["a", "b"].includes(rev.id) ||
          !Number.isInteger(rev.count) ||
          rev.count < 1 ||
          rev.count > 64)
      )
        throw Error("Saved Z83 details are unavailable.");
    return value;
  };
  return {
    read(owner: string) {
      return run(async () => {
        await owned(owner);
        const key = base(owner),
          old = await manifest(key);
        if (old.pending) {
          await clean(key, old.pending);
          await port.set(
            key,
            JSON.stringify({ version: 1, active: old.active }),
          );
        }
        if (!old.active) return null;
        let raw = "";
        for (let i = 0; i < old.active.count; i++) {
          const part = await port.get(item(key, old.active, i));
          if (part === null)
            throw Error(
              "Saved Z83 details are incomplete. Forget them and save again.",
            );
          raw += part;
        }
        await owned(owner);
        return JSON.parse(raw) as unknown;
      });
    },
    save(owner: string, value: unknown, consent: boolean) {
      return run(async () => {
        if (!consent) throw Error("Choose to remember these details first.");
        await owned(owner);
        const key = base(owner),
          old = await manifest(key);
        if (old.pending) await clean(key, old.pending);
        const raw = JSON.stringify(value),
          chunks: string[] = [];
        let part = "",
          size = 0;
        for (const char of raw) {
          const point = char.codePointAt(0)!;
          const bytes =
            point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4;
          if (size + bytes > 1200) {
            chunks.push(part);
            part = "";
            size = 0;
          }
          part += char;
          size += bytes;
        }
        if (part) chunks.push(part);
        if (chunks.length > 64)
          throw Error(
            "These details are too long to remember. They remain in this form only.",
          );
        const rev = {
          id: old.active?.id === "a" ? "b" : "a",
          count: chunks.length,
        };
        await port.set(
          key,
          JSON.stringify({ version: 1, active: old.active, pending: rev }),
        );
        try {
          for (let i = 0; i < chunks.length; i++)
            await port.set(item(key, rev, i), chunks[i]);
          await owned(owner);
          await port.set(
            key,
            JSON.stringify({ version: 1, active: rev, pending: old.active }),
          );
        } catch (e) {
          await clean(key, rev);
          await port.set(
            key,
            JSON.stringify({ version: 1, active: old.active }),
          );
          throw e;
        }
        await clean(key, old.active);
        await port.set(key, JSON.stringify({ version: 1, active: rev }));
      });
    },
    clear(owner: string) {
      return run(async () => {
        const key = base(owner);
        // Fixed double-buffer slots make even interrupted/corrupt records
        // removable without enumerating OS keychain entries.
        for (const id of ["a", "b"]) await clean(key, { id, count: 64 });
        await port.remove(key);
      });
    },
  };
}
