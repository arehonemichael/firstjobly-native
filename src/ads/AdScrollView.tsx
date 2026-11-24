import { signalStartupGesture } from "../lib/user-interaction";
import {
  FlatList,
  ScrollView,
  type FlatListProps,
  type ScrollViewProps,
} from "react-native";
import { signalAdViewportChange } from "./viewport-events";
/** Preserve existing navigation/extra-ad scroll callbacks while updating inline visibility. */
export function AdScrollView({
  onScroll,
  onLayout,
  onScrollBeginDrag,
  scrollEventThrottle = 100,
  ...props
}: ScrollViewProps) {
  return (
    <ScrollView
      {...props}
      scrollEventThrottle={scrollEventThrottle}
      onScrollBeginDrag={(event) => {
        signalStartupGesture();
        onScrollBeginDrag?.(event);
      }}
      onScroll={(event) => {
        signalAdViewportChange();
        onScroll?.(event);
      }}
      onLayout={(event) => {
        signalAdViewportChange();
        onLayout?.(event);
      }}
    />
  );
}
export function AdFlatList<T>({
  onScroll,
  onLayout,
  onScrollBeginDrag,
  scrollEventThrottle = 100,
  ...props
}: FlatListProps<T>) {
  return (
    <FlatList
      {...props}
      scrollEventThrottle={scrollEventThrottle}
      onScrollBeginDrag={(event) => {
        signalStartupGesture();
        onScrollBeginDrag?.(event);
      }}
      onScroll={(event) => {
        signalAdViewportChange();
        onScroll?.(event);
      }}
      onLayout={(event) => {
        signalAdViewportChange();
        onLayout?.(event);
      }}
    />
  );
}
