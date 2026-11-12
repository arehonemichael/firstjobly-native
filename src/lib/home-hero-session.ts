import {
  HOME_HERO_HEADLINES,
  HOME_HERO_IMAGE_IDS,
  type HomeHeroImageId,
} from "../constants/home-hero";
import { JOB_MARKET_FACTS } from "../constants/job-market-facts";

export type HomeHeroContent = Readonly<{
  imageId: HomeHeroImageId;
  headline: string;
  message: string;
}>;
export type HomeHeroSnapshot = Readonly<{
  content: HomeHeroContent;
  revision: number;
}> | null;

/** Select the whole group once. Never reroll one part during image loading. */
export function chooseHomeHeroContent(random = Math.random): HomeHeroContent {
  const index = (length: number) =>
    Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
  return Object.freeze({
    imageId: HOME_HERO_IMAGE_IDS[index(HOME_HERO_IMAGE_IDS.length)],
    headline: HOME_HERO_HEADLINES[index(HOME_HERO_HEADLINES.length)],
    message: JOB_MARKET_FACTS[index(JOB_MARKET_FACTS.length)].text,
  });
}

/** Memory-only app session: no account/device persistence, timers or focus resets.
 * Auth hydration establishes the first owner; sign-out/account changes start a
 * new session. Token refreshes and repeated owner notifications do not reroll. */
export function createHomeHeroSessionStore(choose = chooseHomeHeroContent) {
  let snapshot: HomeHeroSnapshot = null;
  let owner: string | null;
  let revision = 0;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    updateUser(userId: string | null) {
      if (snapshot && owner === userId) return;
      owner = userId;
      snapshot = Object.freeze({
        content: Object.freeze({ ...choose() }),
        revision: ++revision,
      });
      listeners.forEach((listener) => listener());
    },
  };
}

// Shared above route mounts. Cold JS launches get a fresh store and selection.
export const homeHeroSession = createHomeHeroSessionStore();
