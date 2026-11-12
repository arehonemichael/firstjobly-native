import { useState } from "react";
import { PixelRatio, StyleSheet, View } from "react-native";
import { User } from "lucide-react-native";
import { Image } from "expo-image";
import { AppText as Text } from "./primitives";
import { Colors, Fonts, Radius } from "../../constants/theme";

type Props = {
  uri?: string | null;
  name: string;
  size?: number;
  portrait?: boolean;
};
/** A new company/source starts a fresh image state; failed sources never retry in a loop. */
export function IdentityImage(props: Props) {
  return (
    <IdentityContent key={`${props.uri ?? ""}:${props.name}`} {...props} />
  );
}
function IdentityContent({ uri, name, size = 44, portrait = false }: Props) {
  const [failed, setFailed] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [intrinsic, setIntrinsic] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const valid = !!uri && /^https?:\/\//i.test(uri) && !failed;
  const padding = portrait ? 0 : Math.max(4, Math.round(size * 0.14)),
    inner = size - padding * 2;
  const ratio = intrinsic
    ? Math.min(1, inner / intrinsic.width, inner / intrinsic.height)
    : 1;
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter((w) => !/^(pty|ltd|limited|inc|co|\(pty\))\.?$/i.test(w))
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join("")
      .toUpperCase() || "?";
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID={portrait ? "portrait-image" : "company-logo"}
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: portrait ? size / 2 : Radius.sm,
        },
        portrait && styles.portrait,
      ]}
    >
      {!loaded &&
        (portrait && !name.trim() ? (
          <User strokeWidth={1.5} size={18} color={Colors.muted} />
        ) : (
          <Text
            style={[
              styles.initial,
              { fontSize: Math.min(18, size * 0.38) },
              portrait && styles.portraitInitial,
            ]}
          >
            {initials}
          </Text>
        ))}
      {valid && (
        <View
          style={[
            StyleSheet.absoluteFill,
            { alignItems: "center", justifyContent: "center", padding },
          ]}
        >
          <Image
            key={uri}
            source={{ uri }}
            recyclingKey={`${uri}:${name}`}
            accessible={false}
            contentFit={portrait ? "cover" : "contain"}
            cachePolicy="memory-disk"
            transition={0}
            style={
              portrait
                ? { width: size, height: size }
                : {
                    width: intrinsic ? intrinsic.width * ratio : inner,
                    height: intrinsic ? intrinsic.height * ratio : inner,
                  }
            }
            onLoad={(event) => {
              if (
                !portrait &&
                event.source.width > 0 &&
                event.source.height > 0
              )
                setIntrinsic({
                  width: event.source.width / PixelRatio.get(),
                  height: event.source.height / PixelRatio.get(),
                });
              setLoaded(true);
            }}
            onError={() => {
              setFailed(true);
              setLoaded(false);
            }}
          />
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  frame: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  portrait: { backgroundColor: Colors.primarySoft, borderWidth: 0 },
  initial: { fontFamily: Fonts.medium, color: Colors.muted },
  portraitInitial: { color: Colors.primaryPressed },
});
