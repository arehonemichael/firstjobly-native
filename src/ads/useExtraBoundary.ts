import { useCallback, useLayoutEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { registerExtraBoundary, type ExtraSource } from "./extra-boundary";
/** Focus-scoped guards include child controls such as the circular PDF card. */
export function useExtraBoundary(source: ExtraSource | null, ready: boolean) {
  const latest = useRef(false);
  const registration = useRef<ReturnType<typeof registerExtraBoundary> | null>(
    null,
  );
  useLayoutEffect(() => {
    latest.current = ready;
  }, [ready]);
  useFocusEffect(
    useCallback(() => {
      const entry = registerExtraBoundary(source, () => latest.current);
      registration.current = entry;
      return () => {
        entry.dispose();
        registration.current = null;
      };
    }, [source]),
  );
  return useCallback(() => registration.current?.scroll(), []);
}
