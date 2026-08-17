import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityRole,
  type ViewStyle,
} from "react-native";
import { useEffect, useRef } from "react";
import { AlertCircle, Inbox } from "lucide-react-native";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text
          style={styles.title}
          accessibilityRole="header"
          maxFontSizeMultiplier={1.35}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text style={styles.subtitle} maxFontSizeMultiplier={1.35}>
            {subtitle}
          </Text>
        )}
      </View>
      {right}
    </View>
  );
}

type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View
      style={styles.empty}
      accessible
      accessibilityLabel={`${title}. ${message}`}
    >
      <View style={styles.emptyIcon}>
        <Inbox size={22} color="#E1225F" strokeWidth={2} />
      </View>

      <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.35}>
        {title}
      </Text>

      <Text style={styles.emptyMessage} maxFontSizeMultiplier={1.35}>
        {message}
      </Text>

      {!!actionLabel && !!onAction && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

type InlineErrorStateProps = {
  message: string;
  onRetry?: () => void;
};

export function InlineErrorState({ message, onRetry }: InlineErrorStateProps) {
  return (
    <View style={styles.error} accessible accessibilityRole="alert">
      <AlertCircle size={18} color="#DC2626" />
      <View style={styles.errorCopy}>
        <Text style={styles.errorText}>{message}</Text>
        {!!onRetry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry"
            onPress={onRetry}
            hitSlop={8}
            style={({ pressed }) => [
              styles.retry,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function SectionCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PressableRow({
  children,
  onPress,
  accessibilityLabel,
  accessibilityRole = "button",
}: {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityRole?: AccessibilityRole;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
      ]}
    >
      {children}
    </Pressable>
  );
}

export function SkeletonJobCard() {
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.skeletonCard, { opacity }]}
      accessibilityLabel="Loading opportunity"
    >
      <View style={styles.skeletonLogo} />
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonLine, { width: "80%" }]} />
        <View style={[styles.skeletonLine, { width: "54%" }]} />
        <View style={[styles.skeletonLineSmall, { width: "68%" }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
  },
  headerCopy: { flex: 1, paddingRight: 12 },
  title: {
    color: "#061A30",
    fontFamily: "PlusJakartaSans_800ExtraBold",
    fontWeight: "800",
    fontSize: 26,
    lineHeight: 32,
  },
  subtitle: {
    color: "#556274",
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  empty: {
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: "center",
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: "#FDEEF3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    color: "#061A30",
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
    fontSize: 17,
    textAlign: "center",
  },
  emptyMessage: {
    color: "#556274",
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 320,
    marginTop: 6,
  },
  secondaryButton: {
    minHeight: 44,
    marginTop: 18,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#DFE4EC",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#061A30",
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
    fontSize: 13,
  },
  pressed: { opacity: 0.72 },
  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    padding: 13,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FFFFFF",
  },
  errorCopy: { flex: 1, marginLeft: 9 },
  errorText: {
    color: "#061A30",
    fontFamily: "PlusJakartaSans_500Medium",
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 18,
  },
  retry: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  retryText: {
    color: "#E1225F",
    fontFamily: "PlusJakartaSans_700Bold",
    fontWeight: "700",
    fontSize: 13,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EBF0",
    borderRadius: 8,
    padding: 16,
  },
  row: {
    minHeight: 52,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8EBF0",
    justifyContent: "center",
  },
  rowPressed: { backgroundColor: "#F1F5F9" },
  skeletonCard: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EBF0",
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  skeletonLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#E8EBF0",
  },
  skeletonBody: { flex: 1, marginLeft: 12 },
  skeletonLine: {
    height: 11,
    borderRadius: 4,
    backgroundColor: "#E8EBF0",
    marginBottom: 8,
  },
  skeletonLineSmall: {
    height: 9,
    borderRadius: 4,
    backgroundColor: "#F1F5F9",
  },
});
