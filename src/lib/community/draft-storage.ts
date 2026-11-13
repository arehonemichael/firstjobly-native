import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DraftStorage } from "./draft-store";
export const draftStorage: DraftStorage = {
  read: (key) => AsyncStorage.getItem(key),
  write: (key, value) => AsyncStorage.setItem(key, value),
  remove: (key) => AsyncStorage.removeItem(key),
  async clear() {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
      key.startsWith("fj-community-draft:"),
    );
    if (keys.length) await AsyncStorage.multiRemove(keys);
  },
};
