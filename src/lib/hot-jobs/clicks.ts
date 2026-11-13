import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabase";
import { createApplyClickRecorder } from "./click-service";
const key = "fj-apply-device-id:v1";
export const recordApplyClick = createApplyClickRecorder({
  readId: () => AsyncStorage.getItem(key),
  saveId: (id) => AsyncStorage.setItem(key, id),
  owner: async () => {
    const result = await supabase.auth.getSession();
    if (result.error) throw result.error;
    return result.data.session?.user.id || null;
  },
  newId: () =>
    globalThis.crypto?.randomUUID?.() ||
    `fj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`,
  async insert(row) {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 8000);
    try {
      await supabase
        .from("apply_clicks")
        .insert(row)
        .abortSignal(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  },
});
