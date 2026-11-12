import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Lightbulb } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppPressable as Pressable } from "./ui/primitives";
import { Colors, Fonts, Layout, Radius } from "../constants/theme";
import { sessionJobMarketFact } from "../lib/session-fact";

type LaunchSplashProps = {
  ready: boolean;
  fontsReady: boolean;
  reducedMotion: boolean;
  motionReady: boolean;
  error: string | null;
  onRetry: () => void;
  onDone: () => void;
};

/** The introduction never owns readiness or routing. It can be interrupted as
 * soon as essentials settle, then unmounts completely after a short crossfade. */
export function LaunchSplash({
  ready,
  fontsReady,
  reducedMotion,
  motionReady,
  error,
  onRetry,
  onDone,
}: LaunchSplashProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const [opacity] = useState(() => new Animated.Value(1));
  const [logo] = useState(() => new Animated.Value(0));
  const [copy] = useState(() => new Animated.Value(0));
  const [fact] = useState(() => new Animated.Value(0));
  const entrance = useRef<Animated.CompositeAnimation | null>(null);
  const started = useRef(false),
    finished = useRef(false);

  useEffect(() => {
    if (!motionReady || ready) return;
    if (started.current) {
      // React Strict Mode may stop and replay effect setup in development.
      const animation = entrance.current;
      if (!reducedMotion) {
        try {
          animation?.start();
        } catch {
          logo.setValue(1);
          copy.setValue(1);
          fact.setValue(1);
        }
      }
      return () => animation?.stop();
    }
    started.current = true;
    if (reducedMotion) {
      logo.setValue(1);
      copy.setValue(1);
      fact.setValue(1);
      return;
    }
    const native = Platform.OS !== "web";
    const animation = Animated.parallel([
      Animated.timing(logo, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: native,
      }),
      Animated.timing(copy, {
        toValue: 1,
        delay: 160,
        duration: 440,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: native,
      }),
      Animated.timing(fact, {
        toValue: 1,
        delay: 360,
        duration: 440,
        useNativeDriver: native,
      }),
    ]);
    entrance.current = animation;
    try {
      animation.start();
    } catch {
      logo.setValue(1);
      copy.setValue(1);
      fact.setValue(1);
    }
    return () => animation.stop();
  }, [motionReady, reducedMotion, ready, logo, copy, fact]);

  useEffect(() => {
    if (!ready || error) {
      opacity.setValue(1);
      return;
    }
    entrance.current?.stop();
    let active = true;
    const complete = () => {
      if (active && !finished.current) {
        finished.current = true;
        onDone();
      }
    };
    // Fast launches and reduced motion skip all remaining reveal time.
    if (reducedMotion || !started.current) {
      complete();
      return () => {
        active = false;
      };
    }
    const transition = Animated.timing(opacity, {
      toValue: 0,
      duration: 140,
      useNativeDriver: Platform.OS !== "web",
    });
    // Animation callbacks are optional; a lost native callback cannot trap entry.
    const watchdog = setTimeout(complete, 220);
    try {
      transition.start(({ finished: didFinish }) => {
        if (didFinish) complete();
      });
    } catch {
      complete();
    }
    return () => {
      active = false;
      clearTimeout(watchdog);
      transition.stop();
    };
  }, [ready, error, reducedMotion, opacity, onDone]);

  useEffect(() => {
    if (reducedMotion && motionReady) {
      entrance.current?.stop();
      logo.setValue(1);
      copy.setValue(1);
      fact.setValue(1);
    }
  }, [reducedMotion, motionReady, logo, copy, fact]);

  const face = fontsReady
    ? Fonts.medium
    : Platform.select({
        ios: "System",
        android: "sans-serif",
        default: "system-ui",
      });
  return (
    <Animated.View
      testID="launch-splash"
      style={[styles.overlay, { opacity }]}
      accessibilityViewIsModal
    >
      <SafeAreaView
        style={styles.page}
        edges={["top", "bottom", "left", "right"]}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Animated.View
              testID="launch-logo"
              style={{
                opacity: logo,
                transform: [
                  {
                    scale: logo.interpolate({
                      inputRange: [0, 1],
                      outputRange: reducedMotion ? [1, 1] : [0.94, 1],
                    }),
                  },
                ],
              }}
            >
              <View style={styles.logoBox}>
                {!imageFailed && (
                  <Image
                    accessible={false}
                    source={require("../../assets/images/icon.png")}
                    style={styles.logo}
                    resizeMode="contain"
                    onError={() => setImageFailed(true)}
                  />
                )}
              </View>
            </Animated.View>
            <Animated.View
              testID="launch-copy"
              style={{
                opacity: copy,
                transform: [
                  {
                    translateY: copy.interpolate({
                      inputRange: [0, 1],
                      outputRange: reducedMotion ? [0, 0] : [8, 0],
                    }),
                  },
                ],
              }}
            >
              <Text
                accessibilityRole="header"
                accessibilityLabel="FirstJobly"
                style={[styles.wordmark, { fontFamily: face }]}
              >
                <Text style={styles.first}>First</Text>
                <Text style={styles.jobly}>Jobly</Text>
              </Text>
              <Text style={[styles.greeting, { fontFamily: face }]}>
                Your next step into work
              </Text>
              <Text style={[styles.subtext, { fontFamily: face }]}>
                Jobs, internships and learnerships
              </Text>
            </Animated.View>
            <View style={styles.status}>
              {error ? (
                <>
                  <Text
                    accessibilityRole="alert"
                    style={[styles.error, { fontFamily: face }]}
                  >
                    {error}
                  </Text>
                  <Pressable onPress={onRetry} style={styles.retry}>
                    <Text style={[styles.retryText, { fontFamily: face }]}>
                      Retry startup
                    </Text>
                  </Pressable>
                </>
              ) : (
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel="Opening FirstJobly"
                  accessibilityLiveRegion="polite"
                  style={styles.loading}
                >
                  {!reducedMotion && (
                    <ActivityIndicator
                      size="small"
                      color={Colors.primary}
                      accessible={false}
                    />
                  )}
                  <Text style={[styles.loadingText, { fontFamily: face }]}>
                    Opening FirstJobly…
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Animated.View style={[styles.factCard, { opacity: fact }]}>
            <View style={styles.factIcon}>
              <Lightbulb size={18} color={Colors.primary} strokeWidth={1.5} />
            </View>
            <View style={styles.factContent}>
              <Text style={[styles.factLabel, { fontFamily: face }]}>
                Did you know
              </Text>
              <Text style={[styles.factText, { fontFamily: face }]}>
                {sessionJobMarketFact.text}
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    backgroundColor: Colors.background,
  },
  page: { flex: 1, backgroundColor: Colors.background },
  content: {
    flexGrow: 1,
    width: "100%",
    maxWidth: Layout.reading,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
  },
  brand: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
  },
  logoBox: { width: 72, height: 72 },
  logo: { width: 72, height: 72 },
  wordmark: {
    fontSize: 30,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 16,
  },
  first: { color: Colors.primaryPressed },
  jobly: { color: Colors.foreground },
  greeting: {
    color: Colors.foreground,
    fontSize: 24,
    lineHeight: 32,
    textAlign: "center",
    marginTop: 24,
  },
  subtext: {
    color: Colors.mutedSubtle,
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },
  status: {
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 24,
    minHeight: 28,
  },
  loading: { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingText: { color: Colors.muted, fontSize: 13, lineHeight: 21 },
  error: {
    color: Colors.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 380,
  },
  retry: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
  },
  retryText: { color: Colors.primaryForeground, fontSize: 14 },
  factCard: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: 16,
    marginTop: 16,
  },
  factIcon: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  factContent: { flex: 1 },
  factLabel: { color: Colors.primaryPressed, fontSize: 12, marginBottom: 4 },
  factText: { color: Colors.muted, fontSize: 12, lineHeight: 20 },
});
