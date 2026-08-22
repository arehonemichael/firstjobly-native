import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_BAR_VISUAL_HEIGHT = 56;
const CONTENT_GUTTER = 16;

export function useScreenBottomPadding(isTabScreen: boolean) {
  const insets = useSafeAreaInsets();

  if (isTabScreen) {
    return TAB_BAR_VISUAL_HEIGHT + Math.max(insets.bottom, 6) + CONTENT_GUTTER;
  }

  return Math.max(insets.bottom, 12) + CONTENT_GUTTER;
}
