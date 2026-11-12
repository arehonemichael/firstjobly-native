import {
  AppText as Text,
  AppTextInput as TextInput,
  AppPressable as Pressable,
} from "../ui/primitives";
import { Colors, Fonts } from "../../constants/theme";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react-native";

import { INSTITUTIONS } from "../../lib/graduateroom";

export function InstitutionPicker({
  value,
  onChange,
  label = "Institution",
  optional = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  optional?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [otherValue, setOtherValue] = useState("");

  const options = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [...INSTITUTIONS];

    return INSTITUTIONS.filter((institution) =>
      institution.toLowerCase().includes(term),
    );
  }, [query]);

  const isCustom =
    !!value && !INSTITUTIONS.some((institution) => institution === value);

  function select(institution: string) {
    if (institution === "Other institution") {
      setOtherValue(isCustom ? value : "");
      return;
    }

    onChange(institution);
    setOpen(false);
    setQuery("");
  }

  function saveOther() {
    const custom = otherValue.trim();
    if (!custom) return;
    onChange(custom);
    setOpen(false);
    setQuery("");
    setOtherValue("");
  }

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Choose ${label}`}
      >
        <Text
          style={[styles.triggerText, !value && styles.placeholder]}
          numberOfLines={1}
        >
          {value ||
            `Select ${label.toLowerCase()}${optional ? " (optional)" : ""}`}
        </Text>
        <ChevronDown strokeWidth={1.5} size={18} color={Colors.muted} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Choose institution</Text>
                <Text style={styles.subtitle}>
                  Universities, universities of technology, TVET colleges and
                  private colleges.
                </Text>
              </View>
              <Pressable
                style={styles.icon44}
                onPress={() => setOpen(false)}
                accessibilityLabel="Close institution picker"
              >
                <X strokeWidth={1.5} size={18} color={Colors.foreground} />
              </Pressable>
            </View>

            <View style={styles.search}>
              <Search strokeWidth={1.5} size={18} color={Colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search institution"
                placeholderTextColor={Colors.mutedSubtle}
                style={styles.searchInput}
                autoCapitalize="words"
              />
              {query ? (
                <Pressable hitSlop={8} onPress={() => setQuery("")}>
                  <X strokeWidth={1.5} size={18} color={Colors.mutedSubtle} />
                </Pressable>
              ) : null}
            </View>

            {otherValue !== "" || value === "Other institution" ? (
              <View style={styles.otherBox}>
                <Text style={styles.otherLabel}>Your institution</Text>
                <TextInput
                  value={otherValue}
                  onChangeText={setOtherValue}
                  placeholder="Type your institution name"
                  placeholderTextColor={Colors.mutedSubtle}
                  style={styles.otherInput}
                  autoFocus
                />
                <View style={styles.otherActions}>
                  <Pressable
                    style={styles.secondary}
                    onPress={() => setOtherValue("")}
                  >
                    <Text style={styles.secondaryText}>Back to list</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.primary,
                      !otherValue.trim() && styles.disabled,
                    ]}
                    disabled={!otherValue.trim()}
                    onPress={saveOther}
                  >
                    <Text style={styles.primaryText}>Use institution</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <ScrollView
                style={styles.list}
                keyboardShouldPersistTaps="handled"
              >
                {optional ? (
                  <Pressable
                    style={styles.option}
                    onPress={() => {
                      onChange("");
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Text style={styles.optionText}>No institution</Text>
                    {!value ? (
                      <Check
                        strokeWidth={1.5}
                        size={18}
                        color={Colors.primary}
                      />
                    ) : null}
                  </Pressable>
                ) : null}

                {options.map((institution) => {
                  const selected =
                    value === institution ||
                    (institution === "Other institution" && isCustom);

                  return (
                    <Pressable
                      key={institution}
                      style={[styles.option, selected && styles.optionSelected]}
                      onPress={() => select(institution)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected && styles.optionTextSelected,
                        ]}
                      >
                        {institution}
                      </Text>
                      {selected ? (
                        <Check
                          strokeWidth={1.5}
                          size={18}
                          color={Colors.primary}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}

                {!options.length ? (
                  <View style={styles.noResults}>
                    <Text style={styles.noResultsTitle}>
                      Institution not listed?
                    </Text>
                    <Text style={styles.noResultsText}>
                      Choose “Other institution” and enter the name.
                    </Text>
                    <Pressable
                      style={styles.primary}
                      onPress={() => setOtherValue(query.trim())}
                    >
                      <Text style={styles.primaryText}>
                        Enter another institution
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
  },
  triggerText: {
    flex: 1,
    color: Colors.foreground,
    fontSize: 13,
    fontFamily: Fonts.medium,
    fontWeight: "500",
  },
  placeholder: {
    color: Colors.mutedSubtle,
  },
  pressed: {
    opacity: 0.72,
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(6,26,48,0.30)",
  },
  sheet: {
    maxHeight: "86%",
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  icon44: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: Colors.foreground,
    fontSize: 20,
    lineHeight: 28,
    fontFamily: Fonts.medium,
    fontWeight: "500",
  },
  subtitle: {
    color: Colors.muted,
    fontSize: 12,
    lineHeight: 20,
    marginTop: 2,
    paddingRight: 8,
  },
  search: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: 8,
    backgroundColor: Colors.background,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    color: Colors.foreground,
    fontSize: 13,
  },
  list: {
    minHeight: 160,
  },
  option: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionSelected: {
    backgroundColor: Colors.primarySoft,
  },
  optionText: {
    flex: 1,
    color: Colors.foreground,
    fontSize: 12,
    lineHeight: 20,
  },
  optionTextSelected: {
    color: Colors.primaryPressed,
    fontFamily: Fonts.medium,
    fontWeight: "500",
  },
  otherBox: {
    marginTop: 12,
  },
  otherLabel: {
    color: Colors.foreground,
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 8,
  },
  otherInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: Colors.foreground,
    fontSize: 13,
  },
  otherActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
  secondary: {
    minHeight: 46,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.input,
    borderRadius: 8,
    backgroundColor: Colors.surface,
  },
  secondaryText: {
    color: Colors.foreground,
    fontSize: 12,
    fontWeight: "500",
  },
  primary: {
    minHeight: 46,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: Colors.primary,
  },
  primaryText: {
    color: Colors.surface,
    fontSize: 12,
    fontWeight: "500",
  },
  disabled: {
    opacity: 0.45,
  },
  noResults: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  noResultsTitle: {
    color: Colors.foreground,
    fontSize: 14,
    fontWeight: "500",
  },
  noResultsText: {
    color: Colors.muted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
  },
});
