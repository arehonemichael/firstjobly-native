import { StyleSheet, Text, View } from "react-native";
import { Megaphone } from "lucide-react-native";

export function SponsoredSlot() {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Megaphone size={17} color="#E1225F" strokeWidth={2} />
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EBF0",
    borderRadius: 8,
    padding: 14,
    minHeight: 76,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: "#FDEEF3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  copy: {
    flex: 1,
  },
  label: {
    color: "#B0164A",
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
    fontSize: 11,
    marginBottom: 3,
  },
  text: {
    color: "#556274",
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 18,
  },
});
