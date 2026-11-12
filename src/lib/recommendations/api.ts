import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabase";
import { createRecommendationService } from "./service";
import type {
  ActivityKind,
  DismissReason,
  FeedFilters,
  Preferences,
} from "./contracts";
export { RecommendationError } from "./service";
const service = createRecommendationService(supabase, AsyncStorage);
type Listener = () => void;
const listeners = new Set<Listener>();
export function invalidateRecommendations() {
  service.invalidate();
  listeners.forEach((listener) => listener());
}
export function subscribeRecommendations(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export const getRecommendations = (
  filters: FeedFilters = {},
  cursor: string | null = null,
) => service.feed(filters, cursor);
export const getRecommendationPreferences = () => service.getPreferences();
export async function saveRecommendationPreferences(preferences: Preferences) {
  await service.savePreferences(preferences);
  invalidateRecommendations();
}
export async function resetRecommendationLearning() {
  await service.resetLearning();
  invalidateRecommendations();
}
export async function sendRecommendationFeedback(
  jobId: string,
  kind: "dismissed" | "more_like_this" | "undo",
  reason?: DismissReason,
) {
  await service.feedback(jobId, kind, reason);
  invalidateRecommendations();
}
export async function recordRecommendationActivity(
  jobId: string,
  kind: ActivityKind,
) {
  try {
    await service.activity(jobId, kind);
  } catch {
    /* Optional device learning must never block saves or applications. */
  } finally {
    invalidateRecommendations();
  }
}
export const latestFallback = (filters: FeedFilters, _userId: string | null) =>
  service.feed(filters, null, true);
