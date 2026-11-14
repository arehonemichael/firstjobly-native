import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { supabase } from "../supabase";
import { createSecureZ83 } from "./secure-store";
import { reusableZ83 } from "./reusable";
const supported = () => {
  if (Platform.OS === "web")
    throw Error("Remembering personal Z83 details requires the installed app.");
};
const store = createSecureZ83({
  get: async (key) => {
    supported();
    return SecureStore.getItemAsync(key);
  },
  set: async (key, value) => {
    supported();
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  remove: async (key) => {
    supported();
    await SecureStore.deleteItemAsync(key);
  },
  owner: async () =>
    (await supabase.auth.getSession()).data.session?.user.id ?? null,
});
export const savedZ83 = {
  read: async (owner: string) => {
    const value = await store.read(owner);
    return value ? reusableZ83(value) : null;
  },
  save: (owner: string, value: unknown, consent: boolean) =>
    store.save(owner, reusableZ83(value), consent),
  clear: (owner: string) =>
    Platform.OS === "web" ? Promise.resolve() : store.clear(owner),
};
