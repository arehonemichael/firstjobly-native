import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Chip, layout } from '@/components/ui';
import { theme } from '@/constants/theme';

const conversations = [
  { title: 'How I prepared for my first assessment centre', author: 'Kamo M.', replies: '24 replies', tag: 'Career prep' },
  { title: 'Looking for a study buddy in Johannesburg', author: 'Anele S.', replies: '11 replies', tag: 'Community' },
  { title: 'What I wish I knew before my internship', author: 'Thato P.', replies: '32 replies', tag: 'First job' },
];

export default function GraduateRoomScreen() {
  return <SafeAreaView style={layout.page} edges={['top']}><ScrollView contentContainerStyle={[layout.scroll, layout.pageTop]}>
    <View style={styles.hero}><View style={styles.heroIcon}><Ionicons name="people-outline" size={26} color={theme.colors.brand} /></View><Text style={styles.title}>GraduateRoom</Text><Text style={styles.subtitle}>A little more human than a job board. Trade notes, encouragement and real-world advice with other graduates.</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip label="For you" active /><Chip label="Career prep" /><Chip label="First job" /><Chip label="Community" /></ScrollView>
    <Text style={styles.heading}>Conversations to join</Text>
    <View style={styles.feed}>{conversations.map((post) => <Pressable key={post.title} style={({ pressed }) => [styles.post, pressed && styles.pressed]}><View style={styles.postTop}><View style={styles.avatar}><Text style={styles.avatarText}>{post.author.slice(0, 1)}</Text></View><View style={{ flex: 1 }}><Text style={styles.author}>{post.author}</Text><Text style={styles.tag}>{post.tag}</Text></View><Ionicons name="ellipsis-horizontal" size={19} color={theme.colors.textMuted} /></View><Text style={styles.postTitle}>{post.title}</Text><View style={styles.postBottom}><Ionicons name="chatbubble-outline" size={16} color={theme.colors.textMuted} /><Text style={styles.reply}>{post.replies}</Text><Text style={styles.dot}>•</Text><Text style={styles.reply}>Join the conversation</Text></View></Pressable>)}</View>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({
  hero: { padding: theme.space.lg, backgroundColor: theme.colors.brandSoft, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: '#F7B1C9' },
  heroIcon: { height: 48, width: 48, borderRadius: theme.radius.md, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.surface },
  title: { ...theme.type.display, fontSize: 28, lineHeight: 34, color: theme.colors.ink, marginTop: theme.space.md, letterSpacing: -0.6 },
  subtitle: { ...theme.type.body, color: theme.colors.inkSoft, marginTop: theme.space.xs },
  chips: { gap: theme.space.xs, paddingVertical: theme.space.lg },
  heading: { ...theme.type.title, color: theme.colors.ink, marginBottom: theme.space.sm },
  feed: { gap: theme.space.sm },
  post: { padding: theme.space.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, ...theme.shadow.card },
  postTop: { flexDirection: 'row', alignItems: 'center', gap: theme.space.sm },
  avatar: { height: 36, width: 36, borderRadius: 18, backgroundColor: theme.colors.ink, justifyContent: 'center', alignItems: 'center' },
  avatarText: { ...theme.type.label, color: '#FFFFFF' },
  author: { ...theme.type.label, color: theme.colors.ink },
  tag: { ...theme.type.eyebrow, color: theme.colors.textMuted },
  postTitle: { ...theme.type.bodyStrong, color: theme.colors.ink, marginTop: theme.space.md },
  postBottom: { flexDirection: 'row', alignItems: 'center', gap: theme.space.xs, marginTop: theme.space.md },
  reply: { ...theme.type.eyebrow, color: theme.colors.textMuted },
  dot: { color: theme.colors.textMuted },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
});