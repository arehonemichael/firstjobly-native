import { useWindowDimensions } from "react-native";
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
  const desktop = useWindowDimensions().width >= 900;
  const bottomInset = Math.max(insets.bottom, 6);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: desktop ? "top" : "bottom",
        tabBarLabelPosition: desktop ? "beside-icon" : "below-icon",
        tabBarHideOnKeyboard: true,
        sceneStyle: {
          backgroundColor: Colors.background,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.muted,
        tabBarStyle: {
          height: desktop ? 72 : 72 + bottomInset,
          paddingTop: 8,
          paddingBottom: desktop ? 8 : bottomInset,
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
          fontSize: desktop ? 13 : 10,
          lineHeight: 16,
          fontFamily: Fonts.semibold,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <Home size={20} strokeWidth={2} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="jobs"
        options={{
          title: "Jobs",
          tabBarIcon: ({ color }) => (
            <BriefcaseBusiness size={20} strokeWidth={2} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color }) => (
            <Bookmark size={20} strokeWidth={2} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="applications"
        options={{
          title: "Applied",
          tabBarIcon: ({ color }) => (
            <ClipboardList size={20} strokeWidth={2} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="tools"
        options={{
          title: "Tools",
          tabBarIcon: ({ color }) => (
            <Wrench size={20} strokeWidth={2} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="graduateroom"
        options={{
          title: "Room",
          tabBarIcon: ({ color }) => (
            <GraduationCap size={20} strokeWidth={2} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <User size={20} strokeWidth={2} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
