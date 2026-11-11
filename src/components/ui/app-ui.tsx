import { AppPressable as Pressable, AppText as Text } from "./primitives";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { Colors, Fonts, Radius } from "../../constants/theme";
import {
  Animated,
  StyleSheet,
  View,
  type AccessibilityRole,
  type ViewStyle,
} from "react-native";
import { useEffect, useState } from "react";
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
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Inbox size={22} color={Colors.primary} strokeWidth={2} />
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
    <View style={styles.error}>
      <AlertCircle size={18} color={Colors.error} />
      <View style={styles.errorCopy}>
        <Text accessibilityRole="alert" style={styles.errorText}>
          {message}
        </Text>
        {!!onRetry && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry"
            onPress={onRetry}
            hitSlop={8}
            style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
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
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {children}
    </Pressable>
  );
}

export function SkeletonJobCard() {
  const reducedMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(0.55));

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.7);
      return;
    }
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
      ]),
    );

    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion]);

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
    color: Colors.foreground,
    fontFamily: Fonts.editorial,
    fontWeight: "700",
    fontSize: 26,
    lineHeight: 32,
  },
  subtitle: {
    color: Colors.muted,
    fontFamily: Fonts.editorial,
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
    borderRadius: Radius.sm,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    color: Colors.foreground,
    fontFamily: Fonts.editorial,
    fontWeight: "700",
    fontSize: 17,
    textAlign: "center",
  },
  emptyMessage: {
    color: Colors.muted,
    fontFamily: Fonts.medium,
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
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.input,
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: Colors.foreground,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    fontSize: 13,
  },
  pressed: { opacity: 0.72 },
  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    padding: 13,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    backgroundColor: Colors.surface,
  },
  errorCopy: { flex: 1, marginLeft: 9 },
  errorText: {
    color: Colors.foreground,
    fontFamily: Fonts.medium,
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
    color: Colors.primary,
    fontFamily: Fonts.bold,
    fontWeight: "700",
    fontSize: 13,
  },
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: 16,
  },
  row: {
    minHeight: 52,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    justifyContent: "center",
  },
  rowPressed: { backgroundColor: Colors.secondary },
  skeletonCard: {
    minHeight: 104,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    padding: 14,
    marginBottom: 10,
  },
  skeletonLogo: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    backgroundColor: Colors.border,
  },
  skeletonBody: { flex: 1, marginLeft: 12 },
  skeletonLine: {
    height: 11,
    borderRadius: 4,
    backgroundColor: Colors.border,
    marginBottom: 8,
  },
  skeletonLineSmall: {
    height: 9,
    borderRadius: 4,
    backgroundColor: Colors.secondary,
  },
});
