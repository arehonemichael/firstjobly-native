import { Directory, File, Paths } from "expo-file-system";
import type { DraftStorage } from "./draft-store";
const directory = () => new Directory(Paths.document, "community-drafts");
const file = (key: string) =>
  new File(directory(), `${encodeURIComponent(key)}.json`);
// Photos remain local draft data, not expiring signed server URLs. Native files
// avoid AsyncStorage's small per-entry limits for four full-size photo payloads.
export const draftStorage: DraftStorage = {
  async read(key) {
    const source = file(key);
    return source.exists ? await source.text() : null;
  },
  async write(key, value) {
    directory().create({ intermediates: true, idempotent: true });
    file(key).write(value);
  },
  async remove(key) {
    const source = file(key);
    if (source.exists) await source.delete();
  },
  async clear() {
    const folder = directory();
    if (folder.exists) await folder.delete();
  },
};
