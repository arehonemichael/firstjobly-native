import { AppText as Text } from "../ui/primitives";
import { Colors, Fonts } from "../../constants/theme";
import { StyleSheet, View } from "react-native";
import { Megaphone } from "lucide-react-native";

export function SponsoredSlot() {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Megaphone size={18} color={Colors.primary} strokeWidth={1.5} />
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
    borderRadius: 8,
    padding: 16,
    minHeight: 76,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  copy: {
    flex: 1,
  },
  label: {
    color: Colors.primaryPressed,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 12,
    marginBottom: 3,
  },
  text: {
    color: Colors.muted,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 20,
  },
});
