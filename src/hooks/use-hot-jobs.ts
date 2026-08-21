import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getHotJobIds } from "../lib/apply-clicks";

export function useHotJobs() {
  const [hotJobIds, setHotJobIds] = useState<Set<string>>(() => new Set());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getHotJobIds().then((ids) => {
        if (active) setHotJobIds(ids);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return hotJobIds;
}
