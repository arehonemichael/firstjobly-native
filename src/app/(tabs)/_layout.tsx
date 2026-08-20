import { Tabs } from "expo-router";
import {
  Bookmark,
  BriefcaseBusiness,
  ClipboardList,
  GraduationCap,
  Home,
  User,
  Wrench,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, Fonts } from "../../constants/theme";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 6);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        sceneStyle: {
          backgroundColor: Colors.background,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.muted,
        tabBarStyle: {
          height: 68 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: Colors.surface,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarItemStyle: {
          minHeight: 50,
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 14,
          fontFamily: Fonts.semibold,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Home size={22} strokeWidth={2} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="jobs"
        options={{
          title: "Jobs",
          tabBarIcon: ({ color }) => (
            <BriefcaseBusiness size={22} strokeWidth={2} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color }) => (
            <Bookmark size={22} strokeWidth={2} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="applications"
        options={{
          title: "Applied",
          tabBarIcon: ({ color }) => (
            <ClipboardList size={22} strokeWidth={2} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="tools"
        options={{
          title: "Tools",
          tabBarIcon: ({ color }) => (
            <Wrench size={22} strokeWidth={2} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="graduateroom"
        options={{
          title: "Room",
          tabBarIcon: ({ color }) => (
            <GraduationCap size={22} strokeWidth={2} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <User size={22} strokeWidth={2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
