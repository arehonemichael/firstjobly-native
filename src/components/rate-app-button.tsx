import { useRef, useState } from "react";
import { Platform, View } from "react-native";
import { Star } from "lucide-react-native";
import { AppText as Text, AppPressable as Pressable } from "./ui/primitives";
import { Colors } from "../constants/theme";
import { cs } from "./circular/shared";
import { openReviewStore } from "../lib/reviews/runtime";
export function RateAppButton() {
  const [error, setError] = useState("");
  const locked = useRef(false);
  const open = async (store: "ios" | "android") => {
    if (locked.current) return;
    locked.current = true;
    setError("");
    try {
      await openReviewStore(store);
    } catch {
      setError("Could not open the store. Please try again.");
    } finally {
      locked.current = false;
    }
  };
  const stores: ("ios" | "android")[] =
    Platform.OS === "web"
      ? ["android", "ios"]
      : [Platform.OS === "ios" ? "ios" : "android"];
  return (
    <View style={{ gap: 10 }}>
      {stores.map((store) => (
        <Pressable
          key={store}
          accessibilityLabel={
            Platform.OS === "web"
              ? `Rate FirstJobly on ${store === "ios" ? "App Store" : "Google Play"}`
              : "Rate FirstJobly"
          }
          onPress={() => void open(store)}
          style={[
            cs.card,
            { flexDirection: "row", alignItems: "center", gap: 12 },
          ]}
        >
          <Star size={22} color={Colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={cs.heading}>
              {Platform.OS === "web"
                ? `Rate on ${store === "ios" ? "App Store" : "Google Play"}`
                : "Rate FirstJobly"}
            </Text>
            <Text style={cs.muted}>
              Share your experience on the{" "}
              {store === "ios" ? "App Store" : "Google Play"}.
            </Text>
          </View>
        </Pressable>
      ))}
      {!!error && (
        <Text accessibilityLiveRegion="polite" style={cs.body}>
          {error}
        </Text>
      )}
    </View>
  );
}
