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
import { theme } from "../constants/theme";

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
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
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
      Alert.alert("Password too short", "Your password must contain at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Passwords do not match", "Check both passwords.");
      return;
    }
    try {
      setBusy(true);
      const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
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
        [{ text: "OK", onPress: () => { setMode("signin"); setPassword(""); setConfirmPassword(""); } }],
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
      Alert.alert("Reset link sent", `Check ${cleanEmail} for the password reset link.`);
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
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomContentPadding }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.back} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={23} color={theme.colors.ink} />
          </TouchableOpacity>

          <View style={styles.brand}>
            <View style={styles.brandMark}><Ionicons name="briefcase-outline" size={28} color={theme.colors.brand} /></View>
            <Text style={styles.wordmark}><Text style={styles.firstWord}>First</Text><Text style={styles.joblyWord}>Jobly</Text></Text>
            <Text style={styles.subtitle}>
              {mode === "signup"
                ? "Create a free account to save jobs and track applications."
                : mode === "forgot"
                  ? "Enter your email and we'll send you a reset link."
                  : "Welcome back. Sign in to keep applying."}
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              placeholder="you@example.com"
              placeholderTextColor={theme.colors.textMuted}
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
                    placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                    placeholderTextColor={theme.colors.textMuted}
                    style={styles.passwordInput}
                  />
                  <TouchableOpacity style={styles.eye} onPress={() => setShowPassword((v) => !v)}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} color={theme.colors.inkSoft} />
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
                  placeholderTextColor={theme.colors.textMuted}
                  style={styles.input}
                />
              </>
            )}

            {mode === "signin" && (
              <TouchableOpacity style={styles.forgot} onPress={() => setMode("forgot")}>
                <Text style={styles.link}>Forgot password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={() => void submit()}>
              {busy ? (
                <ActivityIndicator color={theme.colors.primaryForeground} />
              ) : (
                <Text style={styles.primaryText}>
                  {mode === "signup" ? "Create free account" : mode === "forgot" ? "Send reset link" : "Sign in"}
                </Text>
              )}
            </TouchableOpacity>

            {mode === "forgot" ? (
              <TouchableOpacity style={styles.switchButton} onPress={() => setMode("signin")}>
                <Text style={styles.link}>Back to sign in</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.switchRow}>
                <Text style={styles.switchText}>{mode === "signup" ? "Already have an account?" : "New to FirstJobly?"}</Text>
                <TouchableOpacity onPress={() => setMode(mode === "signup" ? "signin" : "signup")}>
                  <Text style={styles.link}>{mode === "signup" ? "Sign in" : "Create account"}</Text>
                </TouchableOpacity>
              </View>
            )}

            {mode === "signup" && (
              <Text style={styles.legal}>By creating an account you agree to FirstJobly's Terms & Conditions and Privacy Policy.</Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 40 },
  back: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  brand: { alignItems: "center", marginTop: 28 },
  brandMark: { width: 62, height: 62, borderRadius: theme.radius.md, backgroundColor: theme.colors.brandSoft, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  wordmark: { fontSize: 32, lineHeight: 38, fontWeight: "800", letterSpacing: -0.6 },
  firstWord: { color: theme.colors.brandPink },
  joblyWord: { color: theme.colors.brandNavy },
  subtitle: { maxWidth: 330, marginTop: 10, color: theme.colors.inkSoft, textAlign: "center", fontSize: 14, lineHeight: 20 },
  formCard: {
    marginTop: 30,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.lg,
    padding: 18,
    ...theme.shadow.card,
  },
  label: { color: theme.colors.inkSoft, fontSize: 13, fontWeight: "700", marginBottom: 7, marginTop: 16 },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    color: theme.colors.ink,
    fontSize: 15,
    backgroundColor: theme.colors.surface,
  },
  passwordWrap: {
    height: 52,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
  },
  passwordInput: { flex: 1, paddingHorizontal: 14, color: theme.colors.ink, fontSize: 15 },
  eye: { width: 48, height: 50, alignItems: "center", justifyContent: "center" },
  forgot: { alignSelf: "flex-end", paddingVertical: 14 },
  primary: { height: 54, marginTop: 20, borderRadius: theme.radius.md, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.65 },
  primaryText: { color: theme.colors.primaryForeground, fontWeight: "800", fontSize: 15 },
  switchRow: { marginTop: 26, flexDirection: "row", justifyContent: "center", gap: 5 },
  switchButton: { alignItems: "center", paddingVertical: 20 },
  switchText: { color: theme.colors.inkSoft, fontSize: 13 },
  link: { color: theme.colors.brand, fontWeight: "700", fontSize: 13 },
  legal: { marginTop: 25, color: theme.colors.textMuted, textAlign: "center", fontSize: 11, lineHeight: 17 },
});
