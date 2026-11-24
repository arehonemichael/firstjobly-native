import { fullscreenLock } from "./fullscreen-lock";
import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AppState, Dimensions, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { createAdVisibility } from "./visibility-controller";
import { subscribeAdViewportChanges } from "./viewport-events";

export function AdVisibility({
  children,
  reserveHeight,
}: {
  children: ReactNode;
  reserveHeight: number;
}) {
  const ref = useRef<View>(null);
  const [gate] = useState(createAdVisibility);
  const admitted = useSyncExternalStore(
    gate.subscribe,
    gate.getSnapshot,
    () => false,
  );
  const measure = useRef<() => void>(() => {});
  useFocusEffect(
    useCallback(() => {
      let alive = true,
        active = false,
        generation = 0;
      const check = () => {
        if (!alive || !active) return;
        const ticket = ++generation;
        ref.current?.measureInWindow((x, y, width, height) => {
          if (alive && active && ticket === generation)
            gate.measure({ x, y, width, height }, Dimensions.get("window"));
        });
      };
      const sync = () => {
        active = AppState.currentState === "active" && !fullscreenLock.isHeld();
        generation++;
        gate.setActive(active);
        if (active) check();
      };
      measure.current = check;
      const scroll = subscribeAdViewportChanges(check);
      const state = AppState.addEventListener("change", sync);
      const fullscreen = fullscreenLock.subscribe(sync);
      const size = Dimensions.addEventListener("change", check);
      sync();
      return () => {
        alive = false;
        generation++;
        measure.current = () => {};
        scroll();
        fullscreen();
        state.remove();
        size.remove();
        gate.setActive(false);
      };
    }, [gate]),
  );
  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={() => measure.current()}
      style={!admitted ? { minHeight: reserveHeight } : undefined}
    >
      {admitted ? children : null}
    </View>
  );
}
