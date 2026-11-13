import { useCallback, useState } from "react";
import { Modal, ScrollView, View } from "react-native";
import { router, useFocusEffect, type Href } from "expo-router";
import {
  FileText,
  FileCheck,
  UsersRound,
  BookOpen,
  ClipboardList,
  User,
  Bell,
  Settings,
  LifeBuoy,
  Wrench,
  Compass,
  SlidersHorizontal,
  X,
  Flame,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppText as Text,
  AppPressable as Pressable,
} from "../../components/ui/primitives";
import { Colors } from "../../constants/theme";
import { PageShell, cs } from "../../components/circular/shared";
import { openURL } from "../../lib/circular/io";
const features = [
  { label: "CV Maker", icon: FileText, route: "/cv-maker" },
  { label: "Z83", icon: FileCheck, route: "/z83" },
  { label: "Community", icon: UsersRound, route: "/community" },
  {
    label: "Career Hub",
    icon: BookOpen,
    url: "https://firstjobly.co.za/career-hub",
  },
  { label: "Applications", icon: ClipboardList, route: "/applications" },
  { label: "Profile", icon: User, route: "/profile" },
  { label: "Notifications", icon: Bell, route: "/notifications" },
  { label: "Settings", icon: Settings, route: "/settings" },
  { label: "Help", icon: LifeBuoy, route: "/help" },
  { label: "Career tools", icon: Wrench, route: "/tools" },
  { label: "Discover", icon: Compass, route: "/discover" },
  { label: "Job preferences", icon: SlidersHorizontal, route: "/preferences" },
  { label: "Hot jobs", icon: Flame, route: "/hot-jobs" },
];
export default function MoreScreen() {
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const insets = useSafeAreaInsets();
  useFocusEffect(
    useCallback(() => {
      setVisible(true);
      return () => setVisible(false);
    }, []),
  );
  function close() {
    setVisible(false);
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }
  return (
    <PageShell title="More">
      <View style={cs.content}>
        <Text style={cs.muted}>Your tools, account and Community.</Text>
      </View>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "flex-end",
            backgroundColor: Colors.overlay,
          }}
        >
          <Pressable
            accessibilityLabel="Close More menu"
            style={{ flex: 1 }}
            onPress={close}
          />
          <View
            accessibilityViewIsModal
            style={{
              backgroundColor: Colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              maxHeight: "90%",
              paddingBottom: Math.max(insets.bottom, 16),
            }}
          >
            <View style={[cs.row, { paddingHorizontal: 24, paddingTop: 16 }]}>
              <Text style={[cs.title, { flex: 1 }]}>More</Text>
              <Pressable
                accessibilityLabel="Close More"
                onPress={close}
                style={{ alignItems: "center", justifyContent: "center" }}
              >
                <X size={24} color={Colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 18 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {features.map((feature) => (
                  <Pressable
                    key={feature.label}
                    accessibilityLabel={feature.label}
                    onPress={() => {
                      if (feature.url)
                        void openURL(feature.url).catch((e) =>
                          setError(e.message),
                        );
                      else {
                        setVisible(false);
                        router.push(feature.route as Href);
                      }
                    }}
                    style={{
                      width: "33.333%",
                      minHeight: 98,
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 6,
                      gap: 10,
                    }}
                  >
                    <feature.icon size={24} color={Colors.muted} />
                    <Text
                      style={{
                        textAlign: "center",
                        fontSize: 12,
                        lineHeight: 18,
                      }}
                    >
                      {feature.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {!!error && <Text style={cs.body}>{error}</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </PageShell>
  );
}
