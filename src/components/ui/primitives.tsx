import {
  createContext,
  useContext,
  forwardRef,
  useState,
  type ComponentRef,
} from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  type TextProps,
  type TextInputProps,
  type TouchableOpacityProps,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Colors, Fonts, Radius } from "../../constants/theme";

const TextContext = createContext(false);

/** Shared defaults still allow each screen to express its own hierarchy. */
export const AppText = forwardRef<Text, TextProps>(function AppText(
  { style, ...props },
  ref,
) {
  const nested = useContext(TextContext);
  const textStyle = StyleSheet.flatten(style);
  const weight = Number(textStyle?.fontWeight);
  const face =
    !textStyle?.fontFamily && weight >= 500
      ? { fontFamily: weight >= 600 ? Fonts.semibold : Fonts.medium }
      : undefined;
  return (
    <TextContext.Provider value={true}>
      <Text
        ref={ref}
        {...props}
        style={[!nested && styles.text, face, style]}
      />
    </TextContext.Provider>
  );
});

export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  function AppTextInput(
    { style, onFocus, onBlur, accessibilityLabel, placeholder, ...props },
    ref,
  ) {
    const [focused, setFocused] = useState(false);
    return (
      <TextInput
        ref={ref}
        {...props}
        placeholder={placeholder}
        accessibilityLabel={accessibilityLabel ?? placeholder}
        placeholderTextColor={Colors.mutedSubtle}
        selectionColor={Colors.primary}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, style, focused && styles.focused]}
      />
    );
  },
);

export const AppTouchableOpacity = forwardRef<
  ComponentRef<typeof TouchableOpacity>,
  TouchableOpacityProps
>(function AppTouchableOpacity(
  { accessibilityState, disabled, style, ...props },
  ref,
) {
  return (
    <TouchableOpacity
      ref={ref}
      accessibilityRole="button"
      activeOpacity={0.7}
      {...props}
      disabled={disabled}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      style={[styles.control, style, disabled && styles.disabled]}
    />
  );
});

type AppPressableProps = Omit<PressableProps, "style"> & {
  style?:
    | StyleProp<ViewStyle>
    | ((
        state: PressableStateCallbackType & { hovered?: boolean },
      ) => StyleProp<ViewStyle>);
};
export const AppPressable = forwardRef<
  ComponentRef<typeof Pressable>,
  AppPressableProps
>(function AppPressable(
  { style, disabled, accessibilityState, ...props },
  ref,
) {
  return (
    <Pressable
      ref={ref}
      accessibilityRole="button"
      {...props}
      disabled={disabled}
      accessibilityState={{ ...accessibilityState, disabled: !!disabled }}
      style={(state) => [
        styles.control,
        typeof style === "function" ? style(state) : style,
        disabled && styles.disabled,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  text: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  input: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    color: Colors.foreground,
    minHeight: 44,
    borderRadius: Radius.sm,
  },
  focused: { outlineColor: Colors.ring, outlineWidth: 2, outlineOffset: 2 },
  control: { minHeight: 44, minWidth: 44 },
  disabled: { opacity: 0.5 },
});
