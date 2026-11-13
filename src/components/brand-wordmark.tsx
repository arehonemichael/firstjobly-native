import { brandWordmarkSize } from "../lib/brand-layout";
import { StyleSheet, useWindowDimensions } from "react-native";
import { AppText as Text } from "./ui/primitives";
import { BrandColors, Fonts } from "../constants/theme";
/** A single inline text run keeps both colour spans on the same baseline. The
 * viewport budget leaves room for glyph ink beyond the final y's advance. */
export function BrandWordmark({
  availableWidth,
  preferredSize = 22,
}: {
  availableWidth: number;
  preferredSize?: number;
}) {
  const { fontScale } = useWindowDimensions();
  const size = brandWordmarkSize(availableWidth, fontScale, preferredSize);
  return (
    <Text
      accessibilityLabel="FirstJobly"
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.85}
      testID="brand-wordmark"
      style={[
        styles.wordmark,
        { fontSize: size, lineHeight: Math.ceil(size * 1.5) },
      ]}
    >
      <Text testID="brand-first" style={{ color: BrandColors.first }}>
        First
      </Text>
      <Text testID="brand-jobly" style={{ color: BrandColors.jobly }}>
        Jobly
      </Text>
    </Text>
  );
}
const styles = StyleSheet.create({
  wordmark: {
    fontFamily: Fonts.bold,
    flexShrink: 0,
    letterSpacing: 0,
    paddingRight: 3,
    includeFontPadding: true,
    overflow: "visible",
  },
});
