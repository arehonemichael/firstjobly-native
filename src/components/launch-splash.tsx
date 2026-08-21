import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Lightbulb } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "../constants/theme";
import { sessionJobMarketFact } from "../lib/session-fact";

type LaunchSplashProps = {
  firstName?: string | null;
  ready: boolean;
  onDone: () => void;
};

const MIN_MS = 1500;
const MAX_MS = 5000;

export function LaunchSplash({
  firstName,
  ready,
  onDone,
}: LaunchSplashProps) {
  const [minimumElapsed, setMinimumElapsed] = useState(false);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const dayGreeting =
      hour < 12
        ? "Good morning"
        : hour < 18
          ? "Good afternoon"
          : "Good evening";

    return firstName
      ? `${dayGreeting}, ${firstName}`
      : "Welcome to FirstJobly";
  }, [firstName]);

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
        <Text style={styles.subtext}>Your career starts here.</Text>

        <ActivityIndicator
          size="small"
          color="#E1225F"
          style={styles.spinner}
        />
      </View>

      <View style={styles.factCard}>
        <View style={styles.factIcon}>
          <Lightbulb size={18} color="#E1225F" strokeWidth={2} />
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
    backgroundColor: "#061A30",
    paddingHorizontal: 22,
    justifyContent: "space-between",
  },
  top: {
    paddingTop: 48,
  },
  wordmark: {
    fontSize: 28,
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontWeight: "800",
  },
  first: {
    color: theme.colors.brandPink,
  },
  jobly: {
    color: theme.colors.brandNavy,
  },
  greeting: {
    color: "#FFFFFF",
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontWeight: "800",
    fontSize: 28,
    lineHeight: 34,
    marginTop: 72,
  },
  subtext: {
    color: "#94A3B8",
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
    fontSize: 13,
    marginTop: 7,
  },
  spinner: {
    marginTop: 26,
    alignSelf: "flex-start",
  },
  factCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EBF0",
    borderRadius: 8,
    padding: 14,
    marginBottom: 18,
  },
  factIcon: {
    width: 34,
    height: 34,
    borderRadius: 6,
    backgroundColor: "#FDEEF3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  factContent: {
    flex: 1,
  },
  factLabel: {
    color: "#B0164A",
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
    fontSize: 11,
    marginBottom: 4,
  },
  factText: {
    color: "#556274",
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
    fontSize: 12,
    lineHeight: 18,
  },
});
