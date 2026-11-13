import { BrandWordmark } from "../components/brand-wordmark";
import { Colors, Fonts, Radius, Space } from "../constants/theme";
import {
  AppText as Text,
  AppTextInput as TextInput,
  AppTouchableOpacity as TouchableOpacity,
} from "../components/ui/primitives";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Icon as Ionicons } from "../components/ui/icon";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { authDestination } from "../lib/auth-destination";
import { SafeAreaView } from "react-native-safe-area-context";

import { supabase } from "./../lib/supabase";

import { useScreenBottomPadding } from "../hooks/use-screen-bottom-padding";

type Mode = "signin" | "signup" | "forgot";

export default function AuthScreen() {
  const { width } = useWindowDimensions();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const destination = authDestination(returnTo) as Href;
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

      router.replace(destination);
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
        "Your password must contain at least 8 characters.",
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
        router.replace(destination);
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
        ],
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

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: "https://firstjobly.co.za/reset-password",
      });

      if (error) {
        Alert.alert("Could not send reset link", error.message);
        return;
      }

      Alert.alert(
        "Reset link sent",
        `Check ${cleanEmail} for the password reset link.`,
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
          contentContainerStyle={[
            styles.content,
            { paddingBottom: bottomContentPadding },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color={Colors.foreground} />
          </TouchableOpacity>

          <View style={styles.brand}>
            <BrandWordmark
              availableWidth={Math.min(width - Space.xl * 2, 432)}
              preferredSize={32}
            />

            <Text style={styles.subtitle}>
              {mode === "signup"
                ? "Create a free account to save jobs and track applications."
                : mode === "forgot"
                  ? "Enter your email and we'll send you a reset link."
                  : "Sign in to continue your job search"}
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
              placeholderTextColor={Colors.mutedSubtle}
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
                    placeholderTextColor={Colors.mutedSubtle}
                    style={styles.passwordInput}
                  />

                  <TouchableOpacity
                    style={styles.eye}
                    onPress={() => setShowPassword((v) => !v)}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color={Colors.muted}
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
                  placeholderTextColor={Colors.mutedSubtle}
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
                <ActivityIndicator color={Colors.surface} />
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
                By creating an account you agree to FirstJobly’s Terms &
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
    backgroundColor: Colors.background,
  },

  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    paddingHorizontal: Space.xl,
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
    marginTop: 46,
  },

  subtitle: {
    maxWidth: 330,
    marginTop: 12,
    color: Colors.muted,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },

  form: {
    marginTop: 40,
  },

  label: {
    color: Colors.navy,
    fontFamily: Fonts.medium,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
    marginTop: 16,
  },

  input: {
    minHeight: 52,
    paddingVertical: Space.md,
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: Radius.sm,
    paddingHorizontal: 16,
    color: Colors.foreground,
    fontSize: 15,
    backgroundColor: Colors.surface,
  },

  passwordWrap: {
    backgroundColor: Colors.surface,
    minHeight: 52,
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: Radius.sm,
    flexDirection: "row",
    alignItems: "center",
  },

  passwordInput: {
    flex: 1,
    minHeight: 50,
    paddingVertical: Space.md,
    paddingHorizontal: 16,
    color: Colors.foreground,
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
    paddingVertical: 16,
  },

  primary: {
    minHeight: 54,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    marginTop: 20,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  disabled: {
    opacity: 0.65,
  },

  primaryText: {
    maxWidth: "100%",
    textAlign: "center",
    color: Colors.primaryForeground,
    fontFamily: Fonts.semibold,
    fontWeight: "500",
    fontSize: 15,
  },

  switchRow: {
    marginTop: 28,
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },

  switchButton: {
    alignItems: "center",
    paddingVertical: 20,
  },

  switchText: {
    color: Colors.muted,
    fontSize: 13,
  },

  link: {
    color: Colors.primary,
    fontWeight: "500",
    fontSize: 13,
  },

  legal: {
    marginTop: 24,
    color: Colors.mutedSubtle,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 20,
  },
});
