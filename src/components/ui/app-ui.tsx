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

import { Colors, Fonts, Radius, theme } from "../../constants/theme";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
};

export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.35}>
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

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.empty} accessible accessibilityLabel={`${title}. ${message}`}>
      <View style={styles.emptyIcon}>
        <Inbox size={28} color={Colors.primary} strokeWidth={2} />
      </View>
      <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.35}>{title}</Text>
      <Text style={styles.emptyMessage} maxFontSizeMultiplier={1.35}>{message}</Text>
      {!!actionLabel && !!onAction && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

type InlineErrorStateProps = { message: string; onRetry?: () => void };

export function InlineErrorState({ message, onRetry }: InlineErrorStateProps) {
  return (
    <View style={styles.error} accessible accessibilityRole="alert">
      <AlertCircle size={20} color={theme.colors.danger} />
      <View style={styles.errorCopy}>
        <Text style={styles.errorText}>{message}</Text>
        {!!onRetry && (
          <Pressable accessibilityRole="button" accessibilityLabel="Retry" onPress={onRetry} hitSlop={8} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function SectionCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function PressableRow({ children, onPress, accessibilityLabel, accessibilityRole = "button" }: {
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
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {children}
    </Pressable>
  );
}

export function SkeletonJobCard() {
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.55, duration: 650, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeletonCard, { opacity }]} accessibilityLabel="Loading opportunity">
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
    paddingHorizontal: theme.space.md,
    paddingTop: theme.space.md,
    paddingBottom: theme.space.sm,
  },
  headerCopy: { flex: 1, paddingRight: theme.space.sm },
  title: {
    color: theme.colors.ink,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    fontSize: 28,
    lineHeight: 34,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontFamily: Fonts.regular,
    fontWeight: "400",
    fontSize: 15,
    lineHeight: 22,
    marginTop: theme.space.xxs,
  },
  empty: {
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.xl,
    alignItems: "center",
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.space.md,
  },
  emptyTitle: {
    color: theme.colors.ink,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    fontSize: 22,
    lineHeight: 28,
    textAlign: "center",
  },
  emptyMessage: {
    color: theme.colors.textMuted,
    fontFamily: Fonts.regular,
    fontWeight: "400",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
    marginTop: theme.space.xs,
  },
  primaryButton: {
    width: "100%",
    minHeight: 52,
    marginTop: theme.space.sm,
    paddingHorizontal: theme.space.md,
    borderRadius: Radius.md,
    backgroundColor: theme.colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: theme.colors.primaryForeground,
    fontFamily: Fonts.semibold,
    fontWeight: "600",
    fontSize: 15,
    lineHeight: 22,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: theme.space.md,
    padding: 13,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  errorCopy: { flex: 1, marginLeft: theme.space.xs },
  errorText: {
    color: theme.colors.ink,
    fontFamily: Fonts.regular,
    fontWeight: "400",
    fontSize: 14,
    lineHeight: 20,
  },
  retry: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  retryText: {
    color: theme.colors.brand,
    fontFamily: Fonts.semibold,
    fontWeight: "600",
    fontSize: 14,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: Radius.md,
    padding: theme.space.md,
    ...theme.shadow.card,
  },
  row: {
    minHeight: 52,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.line,
    justifyContent: "center",
  },
  rowPressed: { backgroundColor: theme.colors.surfaceMuted },
  skeletonCard: {
    minHeight: 124,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
    borderRadius: Radius.md,
    padding: theme.space.sm,
    marginBottom: theme.space.sm,
    ...theme.shadow.card,
  },
  skeletonLogo: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
  },
  skeletonBody: { flex: 1, marginLeft: theme.space.sm },
  skeletonLine: {
    height: 11,
    borderRadius: 4,
    backgroundColor: theme.colors.line,
    marginBottom: theme.space.xs,
  },
  skeletonLineSmall: {
    height: 9,
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceMuted,
  },
});
