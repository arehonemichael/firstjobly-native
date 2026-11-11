import { useSafeAreaInsets } from "react-native-safe-area-context";

const CONTENT_GUTTER = 16;

export function useScreenBottomPadding(isTabScreen: boolean) {
  const insets = useSafeAreaInsets();

  if (isTabScreen) {
    return CONTENT_GUTTER;
  }

  return Math.max(insets.bottom, 12) + CONTENT_GUTTER;
}
