import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useMotionPreference() {
  const [preference, setPreference] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    // A failed/slow accessibility API defaults to reduced motion.
    const deadline = setTimeout(() => {
      if (active) setPreference(true);
    }, 250);
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) {
          clearTimeout(deadline);
          setPreference(value);
        }
      })
      .catch(() => {
        if (active) {
          clearTimeout(deadline);
          setPreference(true);
        }
      });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (value) => {
        if (active) {
          clearTimeout(deadline);
          setPreference(value);
        }
      },
    );
    return () => {
      active = false;
      clearTimeout(deadline);
      subscription.remove();
    };
  }, []);
  return {
    reducedMotion: preference !== false,
    motionReady: preference !== null,
  };
}
export function useReducedMotion() {
  return useMotionPreference().reducedMotion;
}
