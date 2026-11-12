import { AppPressable as Pressable, AppText as Text } from "./primitives";
import { Colors, Fonts, Radius } from "../../constants/theme";
import {
  StyleSheet,
  View,
  type AccessibilityRole,
  type ViewStyle,
} from "react-native";
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
        <Inbox size={18} color={Colors.primary} strokeWidth={1.5} />
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
      <AlertCircle strokeWidth={1.5} size={18} color={Colors.error} />
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
  return (
    <View
      style={[styles.skeletonCard, { opacity: 0.7 }]}
      accessibilityLabel="Loading opportunity"
    >
      <View style={styles.skeletonLogo} />
      <View style={styles.skeletonBody}>
        <View style={[styles.skeletonLine, { width: "80%" }]} />
        <View style={[styles.skeletonLine, { width: "54%" }]} />
        <View style={[styles.skeletonLineSmall, { width: "68%" }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerCopy: { flex: 1, paddingRight: 12 },
  title: {
    color: Colors.foreground,
    fontFamily: Fonts.editorial,
    fontWeight: "400",
    fontSize: 26,
    lineHeight: 32,
  },
  subtitle: {
    color: Colors.muted,
    fontFamily: Fonts.editorial,
    fontWeight: "400",
    fontSize: 13,
    lineHeight: 20,
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
    marginBottom: 16,
  },
  emptyTitle: {
    color: Colors.foreground,
    fontFamily: Fonts.editorial,
    fontWeight: "400",
    fontSize: 18,
    textAlign: "center",
  },
  emptyMessage: {
    color: Colors.muted,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
    marginTop: 8,
  },
  secondaryButton: {
    minHeight: 44,
    marginTop: 20,
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
    fontWeight: "500",
    fontSize: 13,
  },
  pressed: { opacity: 0.72 },
  error: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    padding: 12,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    backgroundColor: Colors.surface,
  },
  errorCopy: { flex: 1, marginLeft: 8 },
  errorText: {
    color: Colors.foreground,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 13,
    lineHeight: 20,
  },
  retry: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  retryText: {
    color: Colors.primaryPressed,
    fontFamily: Fonts.bold,
    fontWeight: "500",
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
    padding: 16,
    marginBottom: 12,
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
