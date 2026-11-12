import { AppText as Text } from "./ui/primitives";
import { Colors, Fonts } from "../constants/theme";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Lightbulb } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { sessionJobMarketFact } from "../lib/session-fact";

type LaunchSplashProps = {
  firstName?: string | null;
  ready: boolean;
  onDone: () => void;
};

const MIN_MS = 600;
const MAX_MS = 5000;

export function LaunchSplash({ ready, onDone }: LaunchSplashProps) {
  const [minimumElapsed, setMinimumElapsed] = useState(false);

  const greeting = "Your next step into work";

  useEffect(() => {
    const minimumTimer = setTimeout(() => {
      setMinimumElapsed(true);
    }, MIN_MS);

    const maximumTimer = setTimeout(() => {
      onDone();
    }, MAX_MS);

    return () => {
      clearTimeout(minimumTimer);
      clearTimeout(maximumTimer);
    };
  }, [onDone]);

  useEffect(() => {
    if (ready && minimumElapsed) {
      onDone();
    }
  }, [ready, minimumElapsed, onDone]);

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.top}>
        <Text style={styles.wordmark}>
          <Text style={styles.first}>First</Text>
          <Text style={styles.jobly}>Jobly</Text>
        </Text>

        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.subtext}>Jobs, internships and learnerships</Text>

        <ActivityIndicator
          size="small"
          color={Colors.primary}
          style={styles.spinner}
        />
      </View>

      <View style={styles.factCard}>
        <View style={styles.factIcon}>
          <Lightbulb size={18} color={Colors.primary} strokeWidth={1.5} />
        </View>

        <View style={styles.factContent}>
          <Text style={styles.factLabel}>Did you know</Text>
          <Text style={styles.factText}>{sessionJobMarketFact.text}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
    justifyContent: "space-between",
  },
  top: {
    paddingTop: 48,
  },
  wordmark: {
    fontSize: 28,
    fontFamily: Fonts.medium,
    fontWeight: "500",
  },
  first: {
    color: Colors.primaryPressed,
  },
  jobly: {
    color: Colors.foreground,
  },
  greeting: {
    color: Colors.foreground,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 28,
    lineHeight: 36,
    marginTop: 72,
  },
  subtext: {
    color: Colors.mutedSubtle,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 13,
    marginTop: 8,
  },
  spinner: {
    marginTop: 28,
    alignSelf: "flex-start",
  },
  factCard: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
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
  factContent: {
    flex: 1,
  },
  factLabel: {
    color: Colors.primaryPressed,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 12,
    marginBottom: 4,
  },
  factText: {
    color: Colors.muted,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 20,
  },
});
