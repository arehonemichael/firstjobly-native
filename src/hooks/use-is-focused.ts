import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

export function useIsFocused() {
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);

      return () => {
        setFocused(false);
      };
    }, []),
  );

  return focused;
}
