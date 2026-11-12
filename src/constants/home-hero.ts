/** Original Home content from 6408b9b / 71027f3. Photos and copy were
 * independently randomized there; no fixed photo-to-headline mapping existed. */
export const HOME_HERO_IMAGE_IDS = [
  "hero-1",
  "hero-2",
  "hero-3",
  "hero-4",
  "hero-5",
  "hero-6",
  "hero-7",
] as const;
export type HomeHeroImageId = (typeof HOME_HERO_IMAGE_IDS)[number];

export const HOME_HERO_HEADLINES = [
  "Build experience that opens doors",
  "Skills can shape your next move",
  "Start where opportunity grows",
  "Your next chapter starts with one opportunity",
] as const;
