import {
  AppText as Text,
  AppTouchableOpacity as TouchableOpacity,
  AppPressable as Pressable,
} from "../ui/primitives";
import { Colors, Fonts } from "../../constants/theme";
import { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, View } from "react-native";
import { Icon as Ionicons } from "../ui/icon";
import { SafeAreaView } from "react-native-safe-area-context";

export const SOUTH_AFRICAN_PROVINCES = [
  "Gauteng",
  "Western Cape",
  "Eastern Cape",
  "KwaZulu-Natal",
  "Free State",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
] as const;

export const QUALIFICATIONS = [
  "Matric",
  "Certificate",
  "Diploma",
  "Degree",
  "Postgraduate",
] as const;

export const SOUTH_AFRICAN_LANGUAGES = [
  "Afrikaans",
  "English",
  "isiNdebele",
  "isiXhosa",
  "isiZulu",
  "Sepedi",
  "Sesotho",
  "Setswana",
  "siSwati",
  "Tshivenda",
  "Xitsonga",
  "Sign language",
];

export const DOCUMENT_KINDS = [
  { key: "cv", label: "CV", required: true, hint: "PDF or Word, max 5 MB" },
  {
    key: "matric_certificate",
    label: "Matric certificate",
    required: false,
    hint: "Certified copy",
  },
  {
    key: "academic_transcript",
    label: "Academic transcript",
    required: false,
    hint: "Latest results",
  },
  {
    key: "qualification_certificate",
    label: "Qualification certificate",
    required: false,
    hint: "Diploma or degree certificate",
  },
  {
    key: "cover_letter",
    label: "Cover letter",
    required: false,
    hint: "Optional",
  },
] as const;

type SingleSelectProps = {
  label: string;
  value: string;
  options: readonly string[];
  placeholder?: string;
  onChange: (value: string) => void;
};

export function SingleSelectField({
  label,
  value,
  options,
  placeholder = "Select an option",
  onChange,
}: SingleSelectProps) {
  const [open, setOpen] = useState(false);

  const displayOptions = useMemo(() => {
    if (value && !options.includes(value)) {
      return [value, ...options];
    }
    return [...options];
  }, [options, value]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={styles.inputButton}
        activeOpacity={0.75}
        onPress={() => setOpen(true)}
      >
        <Text
          numberOfLines={1}
          style={[styles.inputText, !value && styles.placeholder]}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Colors.muted} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Ionicons name="close" size={18} color={Colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.options}
            contentContainerStyle={styles.optionsContent}
          >
            {displayOptions.map((option) => {
              const active = option === value;
              const legacy = !options.includes(option);

              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => {
                    onChange(option);
                    setOpen(false);
                  }}
                >
                  <View style={styles.optionCopy}>
                    <Text
                      style={[
                        styles.optionText,
                        active && styles.optionTextActive,
                      ]}
                    >
                      {option}
                    </Text>

                    {legacy && (
                      <Text style={styles.legacyText}>
                        Existing saved value
                      </Text>
                    )}
                  </View>

                  {active && (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={Colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

type MultiSelectProps = {
  label: string;
  value: string;
  options: readonly string[];
  placeholder?: string;
  onChange: (value: string) => void;
};

function splitCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function MultiSelectField({
  label,
  value,
  options,
  placeholder = "Select one or more",
  onChange,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => splitCsv(value), [value]);

  const displayOptions = useMemo(() => {
    const legacy = selected.filter((item) => !options.includes(item));
    return [...legacy, ...options];
  }, [options, selected]);

  function toggle(option: string) {
    const next = selected.includes(option)
      ? selected.filter((item) => item !== option)
      : [...selected, option];

    onChange(next.join(", "));
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>

      <TouchableOpacity
        style={styles.inputButton}
        activeOpacity={0.75}
        onPress={() => setOpen(true)}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.inputText,
            selected.length === 0 && styles.placeholder,
          ]}
        >
          {selected.length > 0 ? selected.join(", ") : placeholder}
        </Text>

        <View style={styles.multiEnd}>
          {selected.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{selected.length}</Text>
            </View>
          )}
          <Ionicons name="chevron-down" size={18} color={Colors.muted} />
        </View>
      </TouchableOpacity>

      <View style={styles.chips}>
        {selected.map((item) => (
          <TouchableOpacity
            key={item}
            style={styles.chip}
            onPress={() => toggle(item)}
          >
            <Text style={styles.chipText}>{item}</Text>
            <Ionicons name="close" size={18} color={Colors.primaryPressed} />
          </TouchableOpacity>
        ))}
      </View>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>{label}</Text>
              <Text style={styles.sheetHint}>Select all that apply</Text>
            </View>

            <TouchableOpacity onPress={() => setOpen(false)}>
              <Ionicons name="close" size={18} color={Colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.options}
            contentContainerStyle={styles.optionsContent}
          >
            {displayOptions.map((option) => {
              const active = selected.includes(option);
              const legacy = !options.includes(option);

              return (
                <TouchableOpacity
                  key={option}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => toggle(option)}
                >
                  <View style={styles.optionCopy}>
                    <Text
                      style={[
                        styles.optionText,
                        active && styles.optionTextActive,
                      ]}
                    >
                      {option}
                    </Text>

                    {legacy && (
                      <Text style={styles.legacyText}>
                        Existing saved value
                      </Text>
                    )}
                  </View>

                  <View
                    style={[styles.checkbox, active && styles.checkboxActive]}
                  >
                    {active && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={Colors.surface}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => setOpen(false)}
          >
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

type DobProps = {
  value: string;
  onChange: (value: string) => void;
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function parseDob(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return { year: "", month: "", day: "" };
  }

  return {
    year: match[1],
    month: String(Number(match[2])),
    day: String(Number(match[3])),
  };
}

export function DateOfBirthField({ value, onChange }: DobProps) {
  const parsed = parseDob(value);
  const [day, setDay] = useState(parsed.day);
  const [month, setMonth] = useState(parsed.month);
  const [year, setYear] = useState(parsed.year);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1950 + 1 }, (_, index) =>
    String(currentYear - index),
  );

  const months = MONTHS.map((name, index) => ({
    name,
    value: String(index + 1),
  }));

  const daysInMonth =
    month && year ? new Date(Number(year), Number(month), 0).getDate() : 31;

  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));

  function commit(nextDay: string, nextMonth: string, nextYear: string) {
    if (!nextDay || !nextMonth || !nextYear) {
      return;
    }

    const maxDay = new Date(Number(nextYear), Number(nextMonth), 0).getDate();

    const safeDay = Math.min(Number(nextDay), maxDay);

    onChange(`${nextYear}-${pad(Number(nextMonth))}-${pad(safeDay)}`);
  }

  function setDobDay(next: string) {
    setDay(next);
    commit(next, month, year);
  }

  function setDobMonth(next: string) {
    setMonth(next);

    let nextDay = day;
    if (day && year) {
      const maxDay = new Date(Number(year), Number(next), 0).getDate();
      if (Number(day) > maxDay) {
        nextDay = String(maxDay);
        setDay(nextDay);
      }
    }

    commit(nextDay, next, year);
  }

  function setDobYear(next: string) {
    setYear(next);
    commit(day, month, next);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Date of birth</Text>

      <View style={styles.dateRow}>
        <CompactSelect
          label="Day"
          value={day}
          options={days.map((item) => ({ label: item, value: item }))}
          onChange={setDobDay}
        />

        <CompactSelect
          label="Month"
          value={month}
          options={months.map((item) => ({
            label: item.name,
            value: item.value,
          }))}
          onChange={setDobMonth}
        />

        <CompactSelect
          label="Year"
          value={year}
          options={years.map((item) => ({ label: item, value: item }))}
          onChange={setDobYear}
        />
      </View>

      {!!value && <Text style={styles.dateValue}>Saved as {value}</Text>}
    </View>
  );
}

type CompactOption = {
  label: string;
  value: string;
};

function CompactSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: CompactOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedLabel =
    options.find((item) => item.value === value)?.label ?? value;

  return (
    <View style={styles.compactWrap}>
      <TouchableOpacity
        style={styles.compactButton}
        onPress={() => setOpen(true)}
      >
        <Text
          numberOfLines={1}
          style={[styles.compactText, !value && styles.placeholder]}
        >
          {selectedLabel || label}
        </Text>
        <Ionicons name="chevron-down" size={18} color={Colors.muted} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Ionicons name="close" size={18} color={Colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.options}
            contentContainerStyle={styles.optionsContent}
          >
            {options.map((option) => {
              const active = option.value === value;

              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      active && styles.optionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>

                  {active && (
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={Colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

export function YearCompletedField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1950 + 1 }, (_, index) =>
    String(currentYear - index),
  );

  return (
    <SingleSelectField
      label="Year completed"
      value={value}
      options={years}
      placeholder="Select year"
      onChange={onChange}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    color: Colors.foreground,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 13,
    marginBottom: 8,
  },
  inputButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.input,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  inputText: {
    flex: 1,
    color: Colors.foreground,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 14,
    marginRight: 8,
  },
  placeholder: {
    color: Colors.mutedSubtle,
  },
  multiEnd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 8,
    backgroundColor: Colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    color: Colors.primaryPressed,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 12,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primarySoft,
    borderWidth: 1,
    borderColor: Colors.primaryBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  chipText: {
    color: Colors.primaryPressed,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 12,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(6,26,48,0.35)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "72%",
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  sheetHeader: {
    minHeight: 58,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetTitle: {
    color: Colors.foreground,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 16,
  },
  sheetHint: {
    color: Colors.muted,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 12,
    marginTop: 2,
  },
  options: {
    maxHeight: 430,
  },
  optionsContent: {
    padding: 12,
    paddingBottom: 24,
  },
  option: {
    minHeight: 48,
    borderRadius: 7,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  optionActive: {
    backgroundColor: Colors.primarySoft,
  },
  optionCopy: {
    flex: 1,
    marginRight: 12,
  },
  optionText: {
    color: Colors.foreground,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 14,
  },
  optionTextActive: {
    color: Colors.primaryPressed,
    fontFamily: Fonts.medium,
    fontWeight: "500",
  },
  legacyText: {
    color: Colors.mutedSubtle,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.input,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  doneButton: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    color: Colors.surface,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 14,
  },
  dateRow: {
    flexDirection: "row",
    gap: 8,
  },
  compactWrap: {
    flex: 1,
  },
  compactButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: Colors.input,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  compactText: {
    flex: 1,
    color: Colors.foreground,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 12,
    marginRight: 4,
  },
  dateValue: {
    color: Colors.muted,
    fontFamily: Fonts.medium,
    fontWeight: "500",
    fontSize: 12,
    marginTop: 8,
  },
});
