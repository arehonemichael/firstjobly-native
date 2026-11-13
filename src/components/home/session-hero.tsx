import { useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { ArrowRight } from "lucide-react-native";
import { AppText as Text, AppPressable as Pressable } from "../ui/primitives";
import { Colors, Fonts, Radius, Space } from "../../constants/theme";
import {
  HOME_HERO_IMAGE_IDS,
  type HomeHeroImageId,
} from "../../constants/home-hero";
import { useHomeHeroContent } from "../../hooks/use-home-hero-session";
import type { HomeHeroContent } from "../../lib/home-hero-session";

// Static requires keep the historical assets in Metro's native/offline bundle.
const images = {
  "hero-1": require("../../../assets/images/hero/hero-1.png"),
  "hero-2": require("../../../assets/images/hero/hero-2.png"),
  "hero-3": require("../../../assets/images/hero/hero-3.png"),
  "hero-4": require("../../../assets/images/hero/hero-4.png"),
  "hero-5": require("../../../assets/images/hero/hero-5.png"),
  "hero-6": require("../../../assets/images/hero/hero-6.png"),
  "hero-7": require("../../../assets/images/hero/hero-7.png"),
} satisfies Record<HomeHeroImageId, number>;

function HeroCard({ content }: { content: HomeHeroContent }) {
  const [imageState, setImageState] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  const source = images[content.imageId];
  return (
    <View nativeID="home-session-hero" style={styles.frame}>
      {source && imageState !== "failed" && (
        <Image
          testID="home-session-hero-image"
          accessible={false}
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={0}
          onLoad={() => setImageState("loaded")}
          onError={() => setImageState("failed")}
        />
      )}
      <LinearGradient
        pointerEvents="none"
        colors={[
          "rgba(6,26,48,0.50)",
          "rgba(6,26,48,0.72)",
          "rgba(6,26,48,0.94)",
        ]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.headline}>
          {content.headline}
        </Text>
        <Text testID="home-session-hero-message" style={styles.message}>
          {content.message}
        </Text>
        <Pressable
          accessibilityLabel="Search jobs"
          onPress={() => router.push("/jobs")}
          style={styles.action}
        >
          <Text style={styles.actionText}>Search jobs</Text>
          <ArrowRight
            size={18}
            strokeWidth={1.5}
            color={Colors.foreground}
            aria-hidden
          />
        </Pressable>
      </View>
      <View style={styles.footer}>
        <View style={styles.dots} accessible={false}>
          {HOME_HERO_IMAGE_IDS.map((id) => (
            <View
              key={id}
              style={[styles.dot, id === content.imageId && styles.activeDot]}
            />
          ))}
        </View>
        {imageState === "loading" && source ? (
          <ActivityIndicator
            accessibilityLabel="Loading career photo"
            size="small"
            color={Colors.surface}
          />
        ) : null}
      </View>
    </View>
  );
}

export function HomeSessionHero() {
  const selection = useHomeHeroContent();
  if (!selection) {
    return (
      <View style={[styles.frame, styles.loading]}>
        <ActivityIndicator
          accessibilityLabel="Loading career note"
          color={Colors.surface}
        />
      </View>
    );
  }
  return <HeroCard key={selection.revision} content={selection.content} />;
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: Colors.foreground,
    borderRadius: Radius.md,
    overflow: "hidden",
    marginBottom: Space.xl,
  },
  loading: { minHeight: 306, alignItems: "center", justifyContent: "center" },
  copy: {
    minHeight: 270,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  headline: {
    color: Colors.surface,
    fontFamily: Fonts.semibold,
    fontSize: 28,
    lineHeight: 36,
  },
  message: {
    color: Colors.surface,
    fontSize: 15,
    lineHeight: 24,
    marginTop: Space.md,
    maxWidth: 520,
  },
  action: {
    alignSelf: "flex-start",
    minHeight: 48,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionText: {
    color: Colors.foreground,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  footer: {
    minHeight: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  dots: { flexDirection: "row", gap: 6 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  activeDot: { width: 20, backgroundColor: Colors.surface },
});
