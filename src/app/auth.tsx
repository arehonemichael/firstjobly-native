import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "./../lib/supabase";

import { useScreenBottomPadding } from "../hooks/use-screen-bottom-padding";

type Mode = "signin" | "signup" | "forgot";

export default function AuthScreen() {
  const bottomContentPadding = useScreenBottomPadding(false);
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const cleanEmail = email.trim().toLowerCase();

  function validateEmail() {
    return /^\S+@\S+\.\S+$/.test(cleanEmail);
  }

  async function signIn() {
    if (!validateEmail()) {
      Alert.alert("Check your email", "Enter a valid email address.");
      return;
    }

    if (!password) {
      Alert.alert("Password required", "Enter your password.");
      return;
    }

    try {
      setBusy(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        Alert.alert("Could not sign in", error.message);
        return;
      }

      router.replace("/profile");
    } finally {
      setBusy(false);
    }
  }

  async function signUp() {
    if (!validateEmail()) {
      Alert.alert("Check your email", "Enter a valid email address.");
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        "Password too short",
        "Your password must contain at least 8 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Passwords do not match", "Check both passwords.");
      return;
    }

    try {
      setBusy(true);

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });

      if (error) {
        Alert.alert("Could not create account", error.message);
        return;
      }

      if (data.session) {
        router.replace("/profile");
        return;
      }

      Alert.alert(
        "Check your email",
        `We sent a confirmation link to ${cleanEmail}. Confirm your account, then return to FirstJobly and sign in.`,
        [
          {
            text: "OK",
            onPress: () => {
              setMode("signin");
              setPassword("");
              setConfirmPassword("");
            },
          },
        ]
      );
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (!validateEmail()) {
      Alert.alert("Check your email", "Enter a valid email address.");
      return;
    }

    try {
      setBusy(true);

      const { error } = await supabase.auth.resetPasswordForEmail(
        cleanEmail,
        {
          redirectTo: "https://firstjobly.co.za/reset-password",
        }
      );

      if (error) {
        Alert.alert("Could not send reset link", error.message);
        return;
      }

      Alert.alert(
        "Reset link sent",
        `Check ${cleanEmail} for the password reset link.`
      );

      setMode("signin");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (mode === "signin") return signIn();
    if (mode === "signup") return signUp();
    return forgotPassword();
  }

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.back}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={23} color="#061A30" />
          </TouchableOpacity>

          <View style={styles.brand}>
            <Text style={styles.wordmark}>
              First<Text style={styles.pink}>Jobly</Text>
            </Text>

            <Text style={styles.subtitle}>
              {mode === "signup"
                ? "Create a free account to save jobs and track applications."
                : mode === "forgot"
                  ? "Enter your email and we'll send you a reset link."
                  : "Welcome back. Sign in to keep applying."}
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              placeholder="you@example.com"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />

            {mode !== "forgot" && (
              <>
                <Text style={styles.label}>Password</Text>

                <View style={styles.passwordWrap}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    placeholder={
                      mode === "signup"
                        ? "At least 8 characters"
                        : "Your password"
                    }
                    placeholderTextColor="#94A3B8"
                    style={styles.passwordInput}
                  />

                  <TouchableOpacity
                    style={styles.eye}
                    onPress={() => setShowPassword((v) => !v)}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={21}
                      color="#556274"
                    />
                  </TouchableOpacity>
                </View>
              </>
            )}

            {mode === "signup" && (
              <>
                <Text style={styles.label}>Confirm password</Text>

                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  placeholder="Repeat your password"
                  placeholderTextColor="#94A3B8"
                  style={styles.input}
                />
              </>
            )}

            {mode === "signin" && (
              <TouchableOpacity
                style={styles.forgot}
                onPress={() => setMode("forgot")}
              >
                <Text style={styles.link}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.primary, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void submit()}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryText}>
                  {mode === "signup"
                    ? "Create free account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Sign in"}
                </Text>
              )}
            </TouchableOpacity>

            {mode === "forgot" ? (
              <TouchableOpacity
                style={styles.switchButton}
                onPress={() => setMode("signin")}
              >
                <Text style={styles.link}>Back to sign in</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.switchRow}>
                <Text style={styles.switchText}>
                  {mode === "signup"
                    ? "Already have an account?"
                    : "New to FirstJobly?"}
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    setMode(mode === "signup" ? "signin" : "signup")
                  }
                >
                  <Text style={styles.link}>
                    {mode === "signup" ? "Sign in" : "Create account"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {mode === "signup" && (
              <Text style={styles.legal}>
                By creating an account you agree to FirstJobly's Terms &
                Conditions and Privacy Policy.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },

  page: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  back: {
    width: 44,
    height: 44,
    justifyContent: "center",
    marginTop: 4,
  },

  brand: {
    alignItems: "center",
    marginTop: 35,
  },

  wordmark: {
    color: "#061A30",
    fontSize: 32,
    fontWeight: "800",
  },

  pink: {
    color: "#E1225F",
  },

  subtitle: {
    maxWidth: 330,
    marginTop: 12,
    color: "#556274",
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },

  form: {
    marginTop: 38,
  },

  label: {
    color: "#556274",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 7,
    marginTop: 16,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    borderRadius: 10,
    paddingHorizontal: 14,
    color: "#061A30",
    fontSize: 15,
    backgroundColor: "#FFFFFF",
  },

  passwordWrap: {
    height: 52,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  passwordInput: {
    flex: 1,
    paddingHorizontal: 14,
    color: "#061A30",
    fontSize: 15,
  },

  eye: {
    width: 48,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
  },

  forgot: {
    alignSelf: "flex-end",
    paddingVertical: 14,
  },

  primary: {
    height: 54,
    marginTop: 20,
    borderRadius: 10,
    backgroundColor: "#E1225F",
    alignItems: "center",
    justifyContent: "center",
  },

  disabled: {
    opacity: 0.65,
  },

  primaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },

  switchRow: {
    marginTop: 26,
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
  },

  switchButton: {
    alignItems: "center",
    paddingVertical: 20,
  },

  switchText: {
    color: "#556274",
    fontSize: 13,
  },

  link: {
    color: "#E1225F",
    fontWeight: "700",
    fontSize: 13,
  },

  legal: {
    marginTop: 25,
    color: "#94A3B8",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 17,
  },
});


