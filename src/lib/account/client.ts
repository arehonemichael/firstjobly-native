import { savedZ83 } from "../z83/saved";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabase";
import { withAuthMutation } from "../auth-mutation";
import { draftStorage } from "../community/draft-storage";
import { invalidateRecommendations } from "../recommendations/api";
import { clearGeneratedFiles, markGeneratedOwnerDeleted } from "./owned-files";
import { weeklyReminders } from "../reminders/runtime";
import { createDeletionCodeSender } from "./email-code";
import { createAccountDeletion } from "./deletion";
import { cleanupDeletedAccount } from "./cleanup";
const currentDeletionSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  return error ? null : data.session;
};
const deletionTransport = createAccountDeletion(currentDeletionSession);
const codeSender = createDeletionCodeSender(currentDeletionSession);
export const accountDeletion = {
  sendCode: codeSender.send,
  async deleteWithEmailCode(owner: string, email: string, code: string) {
    const result = await deletionTransport.delete(
      owner,
      email,
      undefined,
      undefined,
      code,
    );
    markGeneratedOwnerDeleted(result.owner);
    return result;
  },
  async delete(...args: Parameters<typeof deletionTransport.delete>) {
    const result = await deletionTransport.delete(...args);
    markGeneratedOwnerDeleted(result.owner);
    return result;
  },
};
export const finishAccountDeletion = (owner: string, stopReminders: boolean) =>
  withAuthMutation(() =>
    cleanupDeletedAccount(owner, stopReminders, {
      async currentOwner() {
        const { data } = await supabase.auth.getSession();
        return data.session?.user.id ?? null;
      },
      async clearOwned(id) {
        let secureCleanupFailed = false;
        try {
          await savedZ83.clear(id);
        } catch {
          secureCleanupFailed = true;
        }
        // The key includes the owner; never remove another user's rows/drafts.
        await draftStorage.remove(`fj-community-draft:${id}`);
        const keys = (await AsyncStorage.getAllKeys()).filter(
          (key) =>
            (key.startsWith("firstjobly:recommendations:") &&
              key.endsWith(`:${id}`)) ||
            key === `fj-circular-seen:${id}` ||
            key === `firstjobly.cv.draft.v1:${id}` ||
            key === `firstjobly.cv.template.v1:${id}`,
        );
        if (keys.length) await AsyncStorage.multiRemove(keys);
        await clearGeneratedFiles(id);
        invalidateRecommendations();
        if (secureCleanupFailed)
          throw Error(
            "Could not clear remembered Z83 details. Retry local cleanup.",
          );
      },
      async clearDeviceDrafts() {
        await AsyncStorage.multiRemove([
          "firstjobly.cv.draft.v1",
          "firstjobly.cv.template.v1",
          "firstjobly.z83.base.native.v1",
        ]);
      },
      async signOut() {
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) throw Error("Could not clear the local session");
      },
      async disableReminders() {
        await weeklyReminders.setEnabled(false);
        if (weeklyReminders.getSnapshot().error)
          throw Error("Could not disable device reminders");
      },
    }),
  );
