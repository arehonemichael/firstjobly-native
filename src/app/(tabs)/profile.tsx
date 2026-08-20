import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EmptyState, PrimaryButton, SecondaryButton, layout } from '@/components/ui';
import { theme } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

const settings = [
  { icon: 'person-outline', label: 'Personal details', detail: 'Keep your profile current' },
  { icon: 'notifications-outline', label: 'Notifications', detail: 'Role alerts and reminders' },
  { icon: 'settings-outline', label: 'Settings', detail: 'Preferences and privacy' },
] as const;

export default function ProfileScreen() {
  const { user, loading, isAuthenticated } = useAuth();
  const signOut = () => Alert.alert('Sign out?', 'You can come back whenever you are ready.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => { void supabase?.auth.signOut(); } }]);
  return <SafeAreaView style={layout.page} edges={['top']}><ScrollView contentContainerStyle={[layout.scroll, layout.pageTop]}>
    {loading ? <View style={styles.loading}><Text style={styles.loadingText}>Getting your profile ready…</Text></View> : !isAuthenticated ? <EmptyState icon="person-outline" title="Make this your career home" body="Sign in to build your profile, save roles and make every opportunity count." action={<View style={styles.ctas}><PrimaryButton label="Sign in" onPress={() => router.push('/auth')} /><SecondaryButton label="Create an account" onPress={() => router.push('/auth')} /></View>} /> : <>
      <Text style={styles.screenTitle}>Profile</Text>
      <View style={styles.identity}><View style={styles.initial}><Text style={styles.initialText}>{user?.email?.charAt(0).toUpperCase() ?? 'F'}</Text></View><View style={{ flex: 1 }}><Text style={styles.name}>Your FirstJobly</Text><Text style={styles.email}>{user?.email}</Text></View><Pressable style={styles.edit}><Ionicons name="pencil-outline" size={18} color={theme.colors.ink} /></Pressable></View>
      <View style={styles.cvCard}><View style={styles.cvIcon}><Ionicons name="document-text-outline" size={23} color={theme.colors.brand} /></View><View style={{ flex: 1 }}><Text style={styles.cvTitle}>Your CV</Text><Text style={styles.cvBody}>Complete your profile to present your best story when applying.</Text></View><Ionicons name="chevron-forward" size={19} color={theme.colors.textMuted} /></View>
      <Text style={styles.heading}>Account</Text><View style={styles.settings}>{settings.map((item) => <Pressable key={item.label} style={({ pressed }) => [styles.setting, pressed && styles.pressed]}><View style={styles.settingIcon}><Ionicons name={item.icon} size={20} color={theme.colors.ink} /></View><View style={{ flex: 1 }}><Text style={styles.settingLabel}>{item.label}</Text><Text style={styles.settingDetail}>{item.detail}</Text></View><Ionicons name="chevron-forward" size={19} color={theme.colors.textMuted} /></Pressable>)}</View>
      <Pressable onPress={signOut} style={styles.signOut}><Ionicons name="log-out-outline" size={19} color={theme.colors.danger} /><Text style={styles.signOutText}>Sign out</Text></Pressable>
    </>}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  loading: { alignItems: 'center', paddingTop: theme.space.xl }, loadingText: { ...theme.type.body, color: theme.colors.textMuted },
  screenTitle: { ...theme.type.display, fontSize: 28, lineHeight: 34, color: theme.colors.ink, marginBottom: theme.space.lg },
  ctas: { gap: theme.space.sm, width: '100%' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: theme.space.md, borderWidth: 1, borderColor: theme.colors.line, ...theme.shadow.card },
  initial: { height: 56, width: 56, borderRadius: 28, backgroundColor: theme.colors.ink, justifyContent: 'center', alignItems: 'center' }, initialText: { ...theme.type.title, color: '#FFFFFF' },
  name: { ...theme.type.bodyStrong, color: theme.colors.ink }, email: { ...theme.type.eyebrow, color: theme.colors.textMuted, marginTop: theme.space.xxs },
  edit: { height: 36, width: 36, justifyContent: 'center', alignItems: 'center', borderRadius: 18, backgroundColor: theme.colors.surfaceMuted },
  cvCard: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm, backgroundColor: theme.colors.brandSoft, borderRadius: theme.radius.md, borderWidth: 1, borderColor: '#F7B1C9', padding: theme.space.md, marginTop: theme.space.md },
  cvIcon: { height: 44, width: 44, justifyContent: 'center', alignItems: 'center', borderRadius: theme.radius.sm, backgroundColor: theme.colors.surface },
  cvTitle: { ...theme.type.bodyStrong, color: theme.colors.ink }, cvBody: { ...theme.type.eyebrow, color: theme.colors.inkSoft, marginTop: theme.space.xxs },
  heading: { ...theme.type.title, color: theme.colors.ink, marginTop: theme.space.xl, marginBottom: theme.space.sm },
  settings: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.line },
  setting: { flexDirection: 'row', alignItems: 'center', padding: theme.space.md, gap: theme.space.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  settingIcon: { height: 40, width: 40, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { ...theme.type.bodyStrong, color: theme.colors.ink }, settingDetail: { ...theme.type.eyebrow, color: theme.colors.textMuted, marginTop: theme.space.xxs },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.space.xs, marginTop: theme.space.lg, minHeight: 52, borderRadius: theme.radius.md, borderWidth: 1, borderColor: '#F4C5C7', backgroundColor: '#FFF5F5' }, signOutText: { ...theme.type.bodyStrong, color: theme.colors.danger },
  pressed: { opacity: 0.76 },
});