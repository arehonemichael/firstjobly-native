import { useWindowDimensions } from "react-native";
import { Tabs } from "expo-router";
import { Colors, Layout } from "../../constants/theme";
import { CircularNavigation } from "../../components/navigation/circular-navigation";

export default function TabsLayout() {
  const desktop = useWindowDimensions().width >= Layout.desktop;
  return <Tabs initialRouteName="index" backBehavior="history" tabBar={(props) => <CircularNavigation {...props} />} screenOptions={{ headerShown: false, tabBarPosition: desktop ? "top" : "bottom", sceneStyle: { backgroundColor: Colors.background } }}>
    <Tabs.Screen name="index" options={{ title: "Home" }} />
    <Tabs.Screen name="jobs" options={{ title: "Jobs" }} />
    <Tabs.Screen name="saved" options={{ title: "Saved" }} />
    <Tabs.Screen name="applications" options={{ title: "Applications" }} />
    <Tabs.Screen name="tools" options={{ title: "Career tools" }} />
    <Tabs.Screen name="graduateroom" options={{ title: "Graduate Room" }} />
    <Tabs.Screen name="profile" options={{ title: "Profile" }} />
  </Tabs>;
}
