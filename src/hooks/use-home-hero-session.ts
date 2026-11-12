import { useEffect, useSyncExternalStore } from "react";
import { homeHeroSession } from "../lib/home-hero-session";

/** Mount at the root so account changes are observed even away from Home. */
export function useHomeHeroSession(
  userId: string | null,
  authLoading: boolean,
) {
  useEffect(() => {
    if (!authLoading) homeHeroSession.updateUser(userId);
  }, [userId, authLoading]);
}

const serverSnapshot = () => null;
export function useHomeHeroContent() {
  return useSyncExternalStore(
    homeHeroSession.subscribe,
    homeHeroSession.getSnapshot,
    serverSnapshot,
  );
}
