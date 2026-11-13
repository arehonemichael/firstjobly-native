import { useEffect, useState, type ComponentProps } from "react";
import {
  Animated,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Tabs } from "expo-router";
import {
  Bookmark,
  BriefcaseBusiness,
  Check,
  ClipboardList,
  UsersRound,
  Home,
  Menu,
  User,
  Wrench,
  X,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text, AppPressable as Pressable } from "../ui/primitives";
import {
  Colors,
  Fonts,
  Layout,
  NavigationColors,
  Radius,
  Space,
} from "../../constants/theme";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { radialLayout } from "../../lib/radial-layout";

type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];
const destinations = [
  { name: "index", label: "Home", icon: Home },
  { name: "jobs", label: "Find jobs", icon: BriefcaseBusiness },
  { name: "saved", label: "Saved jobs", icon: Bookmark },
  { name: "applications", label: "Applications", icon: ClipboardList },
  { name: "tools", label: "Career tools", icon: Wrench },
  { name: "community", label: "Community", icon: UsersRound },
  { name: "profile", label: "Profile", icon: User },
];

export function CircularNavigation({ state, navigation }: TabBarProps) {
  const { width, fontScale } = useWindowDimensions();
  const desktop = width >= Layout.desktop;
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const active = state.routes[state.index]?.name;
  const current = destinations.find((item) => item.name === active);
  const visible = destinations.filter((item) =>
    state.routes.some((route) => route.name === item.name),
  );
  const layout = radialLayout(width, fontScale);
  const [lastActive, setLastActive] = useState(active);
  if (lastActive !== active) {
    setLastActive(active);
    setOpen(false);
  }

  function close() {
    setOpen(false);
  }
  function select(name: string) {
    const route = state.routes.find((item) => item.name === name);
    if (!route) return;
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    close();
    if (!event.defaultPrevented) navigation.navigate(route.name, route.params);
  }
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboard(true);
      setOpen(false);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboard(false),
    );
    const resize = Dimensions.addEventListener("change", () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
      resize.remove();
    };
  }, []);
  useEffect(() => {
    if (!open) {
      progress.setValue(0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: reduced ? 0 : 160,
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [open, reduced, progress]);
  useEffect(() => {
    if (!open || Platform.OS !== "web") return;
    const previous = document.activeElement as HTMLElement | null;
    const controls = () =>
      Array.from(
        document
          .getElementById("circular-navigation")
          ?.querySelectorAll<HTMLElement>('button, [role="button"]') ?? [],
      );
    const timer = setTimeout(
      () => document.getElementById("close-navigation")?.focus(),
      50,
    );
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
      if (event.key !== "Tab") return;
      const items = controls();
      const first = items[0],
        last = items[items.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !items.includes(document.activeElement as HTMLElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !items.includes(document.activeElement as HTMLElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      setTimeout(() => {
        if (previous?.isConnected) previous.focus();
      }, 0);
    };
  }, [open]);
  useEffect(() => {
    if (!desktop || Platform.OS !== "web") return;
    const bar = document.getElementById("desktop-navigation");
    const onKey = (event: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        return;
      const tabs = Array.from(
        bar?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [],
      );
      const index = tabs.indexOf(document.activeElement as HTMLElement);
      if (index < 0) return;
      event.preventDefault();
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? tabs.length - 1
            : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) %
              tabs.length;
      tabs[next]?.focus();
    };
    bar?.addEventListener("keydown", onKey);
    return () => bar?.removeEventListener("keydown", onKey);
  }, [desktop]);

  function itemControl(
    item: (typeof destinations)[number],
    index: number,
    radial: boolean,
  ) {
    const selected = active === item.name;
    const Glyph = item.icon;
    return (
      <Pressable
        key={item.name}
        accessibilityRole={radial ? "button" : "tab"}
        accessibilityLabel={item.label}
        accessibilityState={{ selected }}
        aria-selected={selected}
        tabIndex={!radial && !selected ? -1 : 0}
        onPress={() => select(item.name)}
        onLongPress={() => {
          const route = state.routes.find((r) => r.name === item.name);
          if (route)
            navigation.emit({ type: "tabLongPress", target: route.key });
        }}
        style={({ pressed, hovered }) => [
          radial
            ? [
                styles.radialItem,
                {
                  left: layout.points[index].left,
                  top: layout.points[index].top,
                  width: layout.nodeWidth,
                  height: layout.nodeHeight,
                },
              ]
            : styles.desktopItem,
          !radial && selected && styles.selected,
          hovered && styles.feedback,
          pressed && styles.pressed,
        ]}
      >
        <View
          style={[
            radial ? styles.circle : styles.desktopIcon,
            selected && styles.activeCircle,
          ]}
        >
          <Glyph
            strokeWidth={1.5}
            aria-hidden
            size={18}
            color={
              selected
                ? NavigationColors.selectedText
                : NavigationColors.foreground
            }
          />
          {selected && (
            <View style={styles.selectedMark}>
              <Check
                strokeWidth={1.5}
                aria-hidden
                size={10}
                color={Colors.surface}
              />
            </View>
          )}
        </View>
        {(!radial || !layout.iconOnly) && (
          <Text
            style={[
              styles.label,
              radial && styles.radialLabel,
              selected && styles.activeLabel,
              radial && selected && styles.activeRadialLabel,
            ]}
          >
            {item.label}
          </Text>
        )}
      </Pressable>
    );
  }
  if (desktop)
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        nativeID="desktop-navigation"
        accessibilityRole="tablist"
        accessibilityLabel="Main navigation"
        style={{ flexGrow: 0 }}
        contentContainerStyle={[
          styles.desktop,
          { paddingTop: Math.max(insets.top, Space.md) },
        ]}
      >
        {visible.map((item, index) => itemControl(item, index, false))}
      </ScrollView>
    );
  if (keyboard) return null;
  return (
    <>
      <View
        style={[
          styles.bar,
          {
            paddingBottom: Math.max(insets.bottom, Space.sm),
            opacity: open ? 0 : 1,
          },
        ]}
      >
        <View style={styles.dock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Home"
            aria-current={active === "index" ? "page" : undefined}
            accessibilityState={{ selected: active === "index" }}
            onPress={() => select("index")}
            style={({ pressed, hovered }) => [
              styles.home,
              active === "index" && styles.selected,
              hovered && styles.feedback,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.dockIcon}>
              <Home
                strokeWidth={1.5}
                aria-hidden
                size={18}
                color={
                  active === "index" ? Colors.primaryPressed : Colors.foreground
                }
              />
              {active === "index" && (
                <View
                  style={[
                    styles.selectedMark,
                    { width: 12, height: 12, right: -3, top: -3 },
                  ]}
                >
                  <Check size={8} color={Colors.surface} aria-hidden />
                </View>
              )}
            </View>
            {!layout.iconOnly && (
              <Text
                style={[styles.label, active === "index" && styles.activeLabel]}
              >
                Home
              </Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              active === "index"
                ? "Open navigation menu"
                : `Open navigation menu, current page: ${current?.label ?? active}`
            }
            accessibilityState={{ expanded: open }}
            aria-expanded={open}
            {...(Platform.OS === "web"
              ? {
                  "aria-controls": "circular-navigation",
                  "aria-haspopup": "dialog" as const,
                }
              : {})}
            onPress={() => setOpen(true)}
            style={({ pressed, hovered }) => [
              styles.menu,
              hovered && styles.feedback,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.menuCircle}>
              <Menu
                strokeWidth={1.5}
                aria-hidden
                size={18}
                color={Colors.surface}
              />
            </View>
            {!layout.iconOnly && <Text style={styles.label}>Menu</Text>}
          </Pressable>
        </View>
      </View>
      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
      >
        <View style={[styles.overlay, { paddingTop: insets.top + Space.sm }]}>
          <Pressable
            nativeID="navigation-backdrop"
            accessible={false}
            importantForAccessibility="no"
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            nativeID="circular-navigation"
            accessibilityViewIsModal
            accessibilityLabel="Navigation menu"
            {...(Platform.OS === "web"
              ? { role: "dialog" as const, "aria-modal": true }
              : {})}
            pointerEvents="box-none"
            style={[
              styles.modalContent,
              {
                opacity: progress,
                transform: [
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <ScrollView
              style={styles.arcScroll}
              contentContainerStyle={styles.arcContent}
              showsVerticalScrollIndicator={false}
            >
              <View pointerEvents="box-none" style={{ width: layout.width }}>
                <View
                  pointerEvents="box-none"
                  style={{ height: layout.height }}
                >
                  {visible
                    .filter((item) => item.name !== "index")
                    .map((item, index) => itemControl(item, index, true))}
                </View>
              </View>
            </ScrollView>
            <View
              style={[
                styles.menuFooter,
                { paddingBottom: Math.max(insets.bottom, Space.md) },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Home"
                onPress={() => select("index")}
                style={({ pressed }) => [
                  styles.footerHome,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.circle,
                    active === "index" && styles.activeCircle,
                  ]}
                >
                  <Home
                    strokeWidth={1.5}
                    aria-hidden
                    size={18}
                    color={Colors.primaryPressed}
                  />
                  {active === "index" && (
                    <View style={styles.selectedMark}>
                      <Check size={10} color={Colors.surface} aria-hidden />
                    </View>
                  )}
                </View>
                {!layout.iconOnly && (
                  <Text style={styles.radialLabel}>Home</Text>
                )}
              </Pressable>
              <Pressable
                nativeID="close-navigation"
                accessibilityRole="button"
                accessibilityLabel="Close navigation menu"
                onPress={close}
                style={({ pressed }) => [
                  styles.close,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.closeCircle}>
                  <X
                    strokeWidth={1.5}
                    aria-hidden
                    size={18}
                    color={Colors.surface}
                  />
                </View>
                {!layout.iconOnly && (
                  <Text style={styles.radialLabel}>Close</Text>
                )}
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
const styles = StyleSheet.create({
  bar: {
    backgroundColor: Colors.background,
    paddingTop: Space.sm,
    paddingHorizontal: Space.lg,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  dock: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    width: "100%",
    maxWidth: 280,
    backgroundColor: Colors.surface,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  home: {
    borderWidth: 1,
    borderColor: "transparent",
    minHeight: 50,
    flex: 1,
    flexDirection: "row",
    gap: Space.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.pill,
    paddingHorizontal: Space.md,
  },
  menu: {
    borderWidth: 1,
    borderColor: "transparent",
    minHeight: 50,
    flex: 1,
    flexDirection: "row",
    gap: Space.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Space.sm,
    borderRadius: Radius.pill,
  },
  dockIcon: {
    width: 24,
    height: 24,
    flexShrink: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  menuCircle: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  desktop: {
    padding: Space.md,
    gap: Space.xs,
    flexDirection: "row",
    flexGrow: 1,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  desktopItem: {
    borderWidth: 1,
    borderColor: "transparent",
    minHeight: 48,
    minWidth: 144,
    flexGrow: 1,
    flexShrink: 0,
    paddingVertical: Space.sm,
    flexDirection: "row",
    gap: Space.sm,
    alignItems: "center",
    paddingHorizontal: Space.sm,
    borderRadius: Radius.sm,
  },
  desktopIcon: {
    width: 28,
    height: 36,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 12,
    fontFamily: Fonts.semibold,
    flexShrink: 0,
    color: Colors.foreground,
  },
  activeLabel: {
    color: NavigationColors.selectedText,
    fontFamily: Fonts.semibold,
  },
  activeRadialLabel: { backgroundColor: NavigationColors.selectedSurface },
  selected: { backgroundColor: NavigationColors.selectedSurface },
  pressed: {
    backgroundColor: NavigationColors.selectedSurface,
    borderColor: NavigationColors.pressed,
    borderWidth: 1,
  },
  feedback: { opacity: 0.76 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(6,26,48,0.18)",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  modalContent: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  arcScroll: { width: "100%", flex: 1 },
  arcContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: Space.sm,
  },

  radialItem: {
    borderWidth: 1,
    borderColor: "transparent",
    position: "absolute",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.sm,
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  activeCircle: {
    backgroundColor: NavigationColors.selectedSurface,
    borderColor: NavigationColors.selected,
  },
  selectedMark: {
    position: "absolute",
    right: -1,
    top: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primaryPressed,
    alignItems: "center",
    justifyContent: "center",
  },
  radialLabel: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    lineHeight: 20,
    maxWidth: "100%",
    flexShrink: 0,
    color: Colors.surface,
    textAlign: "center",
    backgroundColor: Colors.foreground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  menuFooter: {
    width: "100%",
    minHeight: 98,
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
  },
  close: {
    borderWidth: 1,
    borderColor: "transparent",
    width: 76,
    minHeight: 82,
    alignItems: "center",
    gap: Space.sm,
    borderRadius: Radius.sm,
  },
  closeCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  footerHome: {
    borderWidth: 1,
    borderColor: "transparent",
    width: 76,
    minHeight: 78,
    alignItems: "center",
    gap: Space.sm,
    borderRadius: Radius.sm,
  },
});
