import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { User } from "lucide-react-native";
import { Image } from "expo-image";
import { AppText as Text } from "./primitives";
import { Colors, Fonts, Radius } from "../../constants/theme";

/** Initials remain visible while loading and if a remote image is unavailable. */
export function IdentityImage({ uri, name, size = 44, portrait = false }: { uri?: string | null; name: string; size?: number; portrait?: boolean }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const valid = uri && /^https?:\/\//i.test(uri) && failedUri !== uri;
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.frame, { width: size, height: size, borderRadius: portrait ? size / 2 : Radius.sm }]}>
    {portrait && !name.trim() ? <User aria-hidden={true} size={22} color={Colors.muted} /> : <Text style={styles.initial}>{name.trim().charAt(0).toUpperCase() || "?"}</Text>}
    {valid && <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit={portrait ? "cover" : "contain"} cachePolicy="memory-disk" onError={() => setFailedUri(uri)} accessible={false} />}
  </View>;
}
const styles = StyleSheet.create({
  frame: { backgroundColor: Colors.secondary, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initial: { fontFamily: Fonts.semibold, fontSize: 18, color: Colors.muted },
});
