import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../hooks/use-auth";
import { supabase } from "../../lib/supabase";

export default function ProfileScreen() {
  const {
    user,
    loading,
    isAuthenticated,
  } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#E31C5F" />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={styles.page} edges={["top"]}>
        <View style={styles.loggedOut}>
          <View style={styles.avatar}>
            <Ionicons
              name="person-outline"
              size={34}
              color="#E31C5F"
            />
          </View>

          <Text style={styles.title}>Your FirstJobly account</Text>

          <Text style={styles.description}>
            Sign in to save jobs, track applications and manage your profile.
          </Text>

          <TouchableOpacity
            style={styles.primary}
            onPress={() => router.push("/auth")}
          >
            <Text style={styles.primaryText}>Sign in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondary}
            onPress={() => router.push("/auth")}
          >
            <Text style={styles.secondaryText}>
              Create free account
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  async function signOut() {
    Alert.alert(
      "Sign out",
      "Do you want to sign out of FirstJobly?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            await supabase.auth.signOut();
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <View style={styles.content}>
        <Text style={styles.heading}>Profile</Text>

        <View style={styles.accountCard}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarLetter}>
              {(user.email?.[0] ?? "U").toUpperCase()}
            </Text>
          </View>

          <View style={styles.accountInfo}>
            <Text style={styles.accountTitle}>
              FirstJobly account
            </Text>

            <Text style={styles.email} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
        </View>

        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons
              name="person-circle-outline"
              size={22}
              color="#0B1F30"
            />

            <Text style={styles.menuText}>Personal details</Text>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#98A2B3"
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons
              name="notifications-outline"
              size={22}
              color="#0B1F30"
            />

            <Text style={styles.menuText}>Notifications</Text>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#98A2B3"
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <Ionicons
              name="settings-outline"
              size={22}
              color="#0B1F30"
            />

            <Text style={styles.menuText}>Settings</Text>

            <Ionicons
              name="chevron-forward"
              size={18}
              color="#98A2B3"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.signOut}
          onPress={() => void signOut()}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color="#E31C5F"
          />

          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  loggedOut: {
    flex: 1,
    padding: 28,
    justifyContent: "center",
    alignItems: "center",
  },

  avatar: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "#FFF0F5",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    marginTop: 22,
    color: "#0B1F30",
    fontSize: 23,
    fontWeight: "800",
  },

  description: {
    maxWidth: 310,
    marginTop: 8,
    color: "#667085",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  primary: {
    width: "100%",
    height: 53,
    marginTop: 28,
    borderRadius: 10,
    backgroundColor: "#E31C5F",
    alignItems: "center",
    justifyContent: "center",
  },

  primaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },

  secondary: {
    width: "100%",
    height: 53,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryText: {
    color: "#0B1F30",
    fontWeight: "700",
  },

  content: {
    padding: 20,
  },

  heading: {
    color: "#0B1F30",
    fontSize: 24,
    fontWeight: "800",
  },

  accountCard: {
    marginTop: 18,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  avatarSmall: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFF0F5",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarLetter: {
    color: "#E31C5F",
    fontSize: 19,
    fontWeight: "800",
  },

  accountInfo: {
    flex: 1,
    marginLeft: 12,
  },

  accountTitle: {
    color: "#101828",
    fontWeight: "700",
  },

  email: {
    color: "#667085",
    fontSize: 12,
    marginTop: 3,
  },

  menu: {
    marginTop: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    borderRadius: 12,
    overflow: "hidden",
  },

  menuItem: {
    minHeight: 58,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EAECF0",
  },

  menuText: {
    flex: 1,
    marginLeft: 12,
    color: "#344054",
    fontWeight: "600",
  },

  signOut: {
    marginTop: 20,
    height: 52,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EAECF0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  signOutText: {
    color: "#E31C5F",
    fontWeight: "700",
  },
});
