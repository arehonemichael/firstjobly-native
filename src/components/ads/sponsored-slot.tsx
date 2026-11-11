import { AppText as Text } from "../ui/primitives";
import { Colors, Fonts, Radius } from "../../constants/theme";
import { StyleSheet, View } from "react-native";
import { Megaphone } from "lucide-react-native";

export function SponsoredSlot() {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Megaphone size={17} color={Colors.primary} strokeWidth={2} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.label}>Sponsored</Text>
        <Text style={styles.text}>
          Reserved for selected opportunities and partner content.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: 14,
    minHeight: 76,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  copy: {
    flex: 1,
  },
  label: {
    color: Colors.primaryPressed,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    fontSize: 11,
    marginBottom: 3,
  },
  text: {
    color: Colors.muted,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 18,
  },
});
