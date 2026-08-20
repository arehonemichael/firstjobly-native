import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton, Wordmark } from '@/components/ui';
import { theme } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'forgot';
export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const cleanEmail = email.trim().toLowerCase();
  const validEmail = () => /^\S+@\S+\.\S+$/.test(cleanEmail);
  const unavailable = () => !supabase;
  const submit = async () => {
    if (unavailable()) { Alert.alert('Account service unavailable', 'FirstJobly needs Supabase public environment variables before sign in is available.'); return; }
    if (!validEmail()) { Alert.alert('Check your email', 'Enter a valid email address.'); return; }
    if (mode !== 'forgot' && !password) { Alert.alert('Password required', 'Enter your password.'); return; }
    if (mode === 'signup' && password.length < 8) { Alert.alert('Password too short', 'Your password must contain at least 8 characters.'); return; }
    if (mode === 'signup' && password !== confirmPassword) { Alert.alert('Passwords do not match', 'Check both passwords.'); return; }
    try {
      setBusy(true);
      if (mode === 'signin') {
        const { error } = await supabase!.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) return Alert.alert('Could not sign in', error.message);
        router.replace('/profile');
      } else if (mode === 'signup') {
        const { data, error } = await supabase!.auth.signUp({ email: cleanEmail, password });
        if (error) return Alert.alert('Could not create account', error.message);
        if (data.session) { router.replace('/profile'); return; }
        Alert.alert('Check your email', `We sent a confirmation link to ${cleanEmail}.`, [{ text: 'OK', onPress: () => { setMode('signin'); setPassword(''); setConfirmPassword(''); } }]);
      } else {
        const { error } = await supabase!.auth.resetPasswordForEmail(cleanEmail, { redirectTo: 'https://firstjobly.co.za/reset-password' });
        if (error) return Alert.alert('Could not send reset link', error.message);
        Alert.alert('Reset link sent', `Check ${cleanEmail} for the password reset link.`);
        setMode('signin');
      }
    } finally { setBusy(false); }
  };
  const heading = mode === 'signup' ? 'Build your career home.' : mode === 'forgot' ? 'Reset with ease.' : 'Welcome back.';
  const body = mode === 'signup' ? 'Create a free account to save roles and keep your application journey organised.' : mode === 'forgot' ? 'Enter your email and we will send a secure reset link.' : 'Sign in to find your next step and keep your opportunities close.';
  return <SafeAreaView style={styles.page} edges={['top', 'bottom']}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={theme.colors.ink} /></Pressable>
    <View style={styles.brand}><Wordmark /><Text style={styles.kicker}>YOUR CAREER, WITH MOMENTUM</Text><Text style={styles.heading}>{heading}</Text><Text style={styles.body}>{body}</Text></View>
    <View style={styles.form}><Field label="Email address"><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="you@example.com" placeholderTextColor={theme.colors.textMuted} style={styles.input}/></Field>
      {mode !== 'forgot' ? <><Field label="Password"><View style={styles.passwordWrap}><TextInput value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoComplete={mode === 'signin' ? 'password' : 'new-password'} placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'} placeholderTextColor={theme.colors.textMuted} style={styles.password}/><Pressable onPress={() => setShowPassword((value) => !value)} style={styles.eye}><Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textMuted}/></Pressable></View></Field>
      {mode === 'signup' ? <Field label="Confirm password"><TextInput value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} autoCapitalize="none" placeholder="Repeat your password" placeholderTextColor={theme.colors.textMuted} style={styles.input}/></Field> : <Pressable onPress={() => setMode('forgot')} style={styles.forgot}><Text style={styles.link}>Forgot password?</Text></Pressable>}</> : null}
      <View style={styles.buttonWrap}>{busy ? <View style={styles.busy}><ActivityIndicator color="#FFFFFF" /></View> : <PrimaryButton label={mode === 'signup' ? 'Create free account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'} onPress={() => void submit()} />}</View>
      {mode === 'forgot' ? <Pressable onPress={() => setMode('signin')} style={styles.switch}><Text style={styles.link}>Back to sign in</Text></Pressable> : <View style={styles.switchRow}><Text style={styles.switchText}>{mode === 'signup' ? 'Already have an account?' : 'New to FirstJobly?'}</Text><Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}><Text style={styles.link}>{mode === 'signup' ? 'Sign in' : 'Create account'}</Text></Pressable></View>}
    </View>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View>; }
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background }, content: { flexGrow: 1, paddingHorizontal: theme.space.md, paddingBottom: theme.space.xl }, back: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line },
  brand: { marginTop: theme.space.xl }, kicker: { ...theme.type.eyebrow, color: theme.colors.brand, letterSpacing: 0.8, marginTop: theme.space.lg }, heading: { ...theme.type.display, color: theme.colors.ink, marginTop: theme.space.xs, letterSpacing: -0.7 }, body: { ...theme.type.body, color: theme.colors.textMuted, marginTop: theme.space.sm, maxWidth: 330 },
  form: { marginTop: theme.space.xl }, field: { marginBottom: theme.space.md }, label: { ...theme.type.label, color: theme.colors.ink, marginBottom: theme.space.xs }, input: { height: 54, borderRadius: theme.radius.md, paddingHorizontal: theme.space.md, ...theme.type.body, color: theme.colors.ink, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line },
  passwordWrap: { height: 54, borderRadius: theme.radius.md, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line }, password: { flex: 1, height: '100%', paddingHorizontal: theme.space.md, ...theme.type.body, color: theme.colors.ink }, eye: { height: 52, width: 48, alignItems: 'center', justifyContent: 'center' },
  forgot: { alignSelf: 'flex-end', marginTop: -theme.space.xs, marginBottom: theme.space.sm }, link: { ...theme.type.label, color: theme.colors.brand }, buttonWrap: { marginTop: theme.space.sm }, busy: { height: 52, backgroundColor: theme.colors.brand, borderRadius: theme.radius.md, justifyContent: 'center', alignItems: 'center' },
  switch: { alignItems: 'center', marginTop: theme.space.lg }, switchRow: { marginTop: theme.space.lg, flexDirection: 'row', justifyContent: 'center', gap: theme.space.xxs }, switchText: { ...theme.type.body, color: theme.colors.textMuted },
});