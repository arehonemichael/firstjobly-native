export type CleanupPort = {
  currentOwner(): Promise<string | null>;
  clearOwned(owner: string): Promise<void>;
  clearDeviceDrafts(): Promise<void>;
  signOut(): Promise<void>;
  disableReminders(): Promise<void>;
};
/** Confirmed-success cleanup only. Keep trying independent cleanup stages, but
 * never clear shared drafts/preferences or sign out a newer account. */
export async function cleanupDeletedAccount(
  owner: string,
  stopReminders: boolean,
  port: CleanupPort,
) {
  const errors: unknown[] = [];
  const attempt = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      errors.push(error);
    }
  };
  await attempt(() => port.clearOwned(owner));
  let current = await port.currentOwner();
  if (current !== owner) {
    if (current === null && stopReminders) await attempt(port.disableReminders);
    if (errors.length)
      throw Error("Some account-owned local files could not be removed");
    return { newerAccount: current !== null, sharedCleaned: false };
  }
  await attempt(port.clearDeviceDrafts);
  current = await port.currentOwner();
  if (current === owner && stopReminders) await attempt(port.disableReminders);
  current = await port.currentOwner();
  if (current === owner) await attempt(port.signOut);
  if (errors.length) throw Error("Some local cleanup could not finish");
  return {
    newerAccount: current !== null && current !== owner,
    sharedCleaned: true,
  };
}
