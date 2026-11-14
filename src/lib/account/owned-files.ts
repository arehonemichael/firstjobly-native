import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FS from "expo-file-system/legacy";
const deletedOwners = new Set<string>();
export function markGeneratedOwnerDeleted(owner: string) {
  deletedOwners.add(owner);
}
export function assertGeneratedOwnerActive(owner?: string | null) {
  if (owner && deletedOwners.has(owner))
    throw Error("This account was deleted. No new document was saved.");
}
const key = (owner: string) => `firstjobly:generated-files:${owner}`;
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(action: () => Promise<T>) => {
  const task = queue.then(action);
  queue = task.catch(() => {});
  return task;
};
const local = (uri: string) =>
  [FS.cacheDirectory, FS.documentDirectory].some(
    (base) =>
      base &&
      uri.startsWith(base) &&
      uri !== base &&
      /\.pdf$/i.test(uri) &&
      !uri.includes("..") &&
      !/%2e|%2f|%5c/i.test(uri),
  );
/** Track app-owned PDFs only. Exported Android content URIs/Files copies are
 * outside the app's ownership and must never be recursively removed. */
export function rememberGeneratedFile(owner: string | null, uri: string) {
  if (!owner || !local(uri)) return Promise.resolve();
  return serial(async () => {
    if (deletedOwners.has(owner)) {
      await FS.deleteAsync(uri, { idempotent: true });
      throw Error(
        "This account was deleted. The late generated document was removed.",
      );
    }
    const old = JSON.parse(
      (await AsyncStorage.getItem(key(owner))) || "[]",
    ) as string[];
    await AsyncStorage.setItem(
      key(owner),
      JSON.stringify([...new Set([...old, uri])]),
    );
  });
}
export function clearGeneratedFiles(owner: string) {
  return serial(async () => {
    const raw = JSON.parse(
      (await AsyncStorage.getItem(key(owner))) || "[]",
    ) as unknown;
    if (!Array.isArray(raw))
      throw Error("Could not read generated file ownership");
    for (const uri of raw)
      if (typeof uri === "string" && local(uri))
        await FS.deleteAsync(uri, { idempotent: true });
    if (FS.documentDirectory && /^[a-zA-Z0-9_-]{1,128}$/.test(owner))
      await FS.deleteAsync(
        `${FS.documentDirectory}firstjobly-generated/${owner}/`,
        { idempotent: true },
      );
    await AsyncStorage.removeItem(key(owner));
  });
}
