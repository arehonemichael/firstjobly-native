import { signalUserInteraction } from "../../lib/user-interaction";
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type ColorValue,
} from "react-native";
import { Tabs } from "expo-router";
import {
  Bookmark,
  BriefcaseBusiness,
  Home,
  Landmark,
  LayoutGrid,
} from "lucide-react-native";
import { useCircularBadge } from "../../hooks/use-circular";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text } from "../../components/ui/primitives";
import { Colors, Fonts, NavigationColors, Radius } from "../../constants/theme";
import { tabPresentation } from "../../lib/home-presentation";

// Match the navigator's slot to our existing icon box. Its SDK default is 28px
// tall; allowing a 32px child to overflow it collides with the label below.
const ICON_FRAME = 32;
const LABEL_LINE_HEIGHT = 18;
const LABEL_GAP = 2;
const ITEM_PADDING = 10; // Expo Router's vertical tab button has 5px per side.
const ITEM_HEIGHT = ICON_FRAME + LABEL_GAP + LABEL_LINE_HEIGHT + ITEM_PADDING;
const BAR_TOP_PADDING = 8;

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const newCircular = useCircularBadge();
  const { bottom } = useSafeAreaInsets();
  const { showLabels, iconSize, labelSize } = tabPresentation(width);
  const bottomPadding = Math.max(bottom, 8);
  function tab(label: string, Icon: typeof Home) {
    return {
      tabBarAccessibilityLabel: label,
      tabBarLabel: ({
        color,
        focused,
      }: {
        color: ColorValue;
        focused: boolean;
      }) => (
        <Text
          testID="tab-label"
          numberOfLines={1}
          allowFontScaling={false}
          style={[
            styles.label,
            {
              fontSize: labelSize,
              color: focused ? NavigationColors.selectedText : color,
            },
          ]}
        >
          {label}
        </Text>
      ),
      tabBarIcon: ({ focused }: { focused: boolean }) => (
        <View style={[styles.icon, focused && styles.selected]}>
          <Icon
            aria-hidden
            size={iconSize}
            strokeWidth={focused ? 2.5 : 1.7}
            color={focused ? Colors.primary : Colors.muted}
          />
          {focused && <View style={styles.indicator} />}
          {label === "Gov jobs" && newCircular && (
            <View
              accessibilityLabel="New circular"
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: Colors.primary,
              }}
            />
          )}
        </View>
      ),
    };
  }
  return (
    <Tabs
      initialRouteName="index"
      backBehavior="history"
      screenListeners={{ tabPress: signalUserInteraction }}
      screenOptions={{
        headerShown: false,
        tabBarPosition: "bottom",
        sceneStyle: { backgroundColor: Colors.background },
        tabBarShowLabel: showLabels,
        tabBarAllowFontScaling: false,
        tabBarLabelPosition: "below-icon",
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: {
          flex: 1,
          minHeight: ITEM_HEIGHT,
          paddingHorizontal: 0,
        },
        tabBarIconStyle: {
          width: ICON_FRAME,
          height: ICON_FRAME,
          flexShrink: 0,
        },
        tabBarLabelStyle: {
          fontSize: labelSize,
          fontFamily: Fonts.medium,
          lineHeight: LABEL_LINE_HEIGHT,
        },
        tabBarStyle: {
          height:
            ITEM_HEIGHT +
            BAR_TOP_PADDING +
            bottomPadding +
            StyleSheet.hairlineWidth,
          paddingTop: BAR_TOP_PADDING,
          paddingBottom: bottomPadding,
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", ...tab("Home", Home) }}
      />
      <Tabs.Screen
        name="jobs"
        options={{ title: "Jobs", ...tab("Jobs", BriefcaseBusiness) }}
      />
      <Tabs.Screen
        name="circular-jobs"
        options={{ title: "Government jobs", ...tab("Gov jobs", Landmark) }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: "Saved", ...tab("Saved", Bookmark) }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "More", ...tab("More", LayoutGrid) }}
      />
      <Tabs.Screen name="applications" options={{ href: null }} />
      <Tabs.Screen name="tools" options={{ href: null }} />
      <Tabs.Screen name="community" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="graduateroom" options={{ href: null }} />
    </Tabs>
  );
}
const styles = StyleSheet.create({
  label: {
    fontFamily: Fonts.medium,
    lineHeight: LABEL_LINE_HEIGHT,
    paddingTop: LABEL_GAP,
    width: "100%",
    textAlign: "center",
    includeFontPadding: true,
    flexShrink: 0,
    marginBottom: 0,
  },
  icon: {
    width: ICON_FRAME,
    height: ICON_FRAME,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
  },
  selected: { backgroundColor: Colors.primarySoft },
  indicator: {
    position: "absolute",
    bottom: 0,
    width: 12,
    height: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
  },
});
