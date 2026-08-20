import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { theme } from '@/constants/theme';

export default function TabLayout() {
  const web = Platform.OS === 'web';
  const tab = (name: keyof typeof Ionicons.glyphMap) => ({ color }: { color: string }) => <Ionicons name={name} size={22} color={color} />;
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: theme.colors.brand,
    tabBarInactiveTintColor: theme.colors.textMuted,
    tabBarStyle: { position: 'absolute', height: web ? 84 : 72, backgroundColor: web ? theme.colors.surface : 'transparent', borderTopColor: theme.colors.line, elevation: 0, paddingTop: 8 },
    tabBarBackground: () => <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.surface }]} />,
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600', paddingBottom: web ? 10 : 0 },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tab('home-outline') }} />
    <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: tab('briefcase-outline') }} />
    <Tabs.Screen name="saved" options={{ title: 'Saved', tabBarIcon: tab('bookmark-outline') }} />
    <Tabs.Screen name="graduateroom" options={{ title: 'Room', tabBarIcon: tab('people-outline') }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tab('person-outline') }} />
  </Tabs>;
}
