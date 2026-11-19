import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Glyph } from './Glyph';
import { useTheme } from '../theme/ThemeContext';
import { useFormNavigationField } from './forms/FormNavigation';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function dateStamp(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateFromStamp(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function monthOffset(date) {
  return (date.getDay() + 6) % 7;
}

function monthKey(date) {
  return date.getFullYear() * 12 + date.getMonth();
}

function calendarDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = monthOffset(first);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return [
    ...Array(offset).fill(null),
    ...Array.from({ length: count }, (_, index) => (
      new Date(month.getFullYear(), month.getMonth(), index + 1)
    )),
  ];
}

function displayDate(value) {
  const date = dateFromStamp(value);
  return date
    ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
}

export function DatePickerField({
  label,
  value,
  onChange,
  error,
  hint,
  minDate,
  maxDate,
  disabledDates = [],
}) {
  const { colors, radius, type } = useTheme();
  const today = dateStamp(new Date());
  const earliest = minDate || today;
  const earliestDate = dateFromStamp(earliest);
  const latestDate = dateFromStamp(maxDate);
  const [visible, setVisible] = useState(false);
  const fieldRef = useRef(null);
  const [shownMonth, setShownMonth] = useState(() => {
    const initial = dateFromStamp(value) || earliestDate || new Date();
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const days = useMemo(() => calendarDays(shownMonth), [shownMonth]);
  const disabled = useMemo(() => new Set(disabledDates), [disabledDates]);
  const firstMonth = earliestDate ? monthKey(earliestDate) : Number.NEGATIVE_INFINITY;
  const lastMonth = latestDate ? monthKey(latestDate) : Number.POSITIVE_INFINITY;
  const currentMonth = monthKey(shownMonth);

  const openCalendar = useCallback(() => {
    const initial = dateFromStamp(value) || dateFromStamp(earliest) || new Date();
    setShownMonth(new Date(initial.getFullYear(), initial.getMonth(), 1));
    setVisible(true);
  }, [earliest, value]);
  const formField = useFormNavigationField(openCalendar, true, fieldRef);

  function chooseDate(date) {
    const stamp = dateStamp(date);
    if (stamp < earliest || (maxDate && stamp > maxDate) || disabled.has(stamp)) return;
    onChange(stamp);
    setVisible(false);
    formField.advance();
  }

  return (
    <View ref={fieldRef} collapsable={false} style={styles.wrap}>
      {label ? <Text style={type.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label || 'Date'}${value ? `, ${displayDate(value)}` : ''}. Open calendar.`}
        onPress={() => {
          openCalendar();
          formField.activate();
        }}
        style={[
          styles.field,
          {
            borderColor: error ? colors.danger : colors.borderStrong,
            backgroundColor: error ? colors.dangerSurface : colors.surfaceSecondary,
            borderRadius: radius.input,
          },
        ]}
      >
        <Text style={[styles.value, { color: value ? colors.text : colors.placeholder }]}>
          {value ? displayDate(value) : 'Select date'}
        </Text>
        <Glyph name="calendar" color={colors.primary} size={19} />
      </Pressable>
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityLiveRegion="polite">{error}</Text>
      ) : hint ? <Text style={type.small}>{hint}</Text> : null}

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close calendar"
            onPress={() => setVisible(false)}
            style={[styles.scrim, { backgroundColor: colors.overlay }]}
          />
          <View style={[styles.dialog, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
            <View style={styles.header}>
              <Text style={[type.heading, styles.monthTitle, { color: colors.text }]}>
                {MONTHS[shownMonth.getMonth()]} {shownMonth.getFullYear()}
              </Text>
              <View style={styles.monthControls}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  disabled={currentMonth <= firstMonth}
                  onPress={() => setShownMonth(new Date(shownMonth.getFullYear(), shownMonth.getMonth() - 1, 1))}
                  style={styles.monthButton}
                >
                  <Text style={[styles.monthArrow, { color: currentMonth <= firstMonth ? colors.textTertiary : colors.text }]}>‹</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  disabled={currentMonth >= lastMonth}
                  onPress={() => setShownMonth(new Date(shownMonth.getFullYear(), shownMonth.getMonth() + 1, 1))}
                  style={styles.monthButton}
                >
                  <Text style={[styles.monthArrow, { color: currentMonth >= lastMonth ? colors.textTertiary : colors.text }]}>›</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.grid}>
              {WEEKDAYS.map((weekday) => (
                <Text key={weekday} style={[styles.weekday, { color: colors.textSecondary }]}>{weekday}</Text>
              ))}
              {days.map((date, index) => {
                if (!date) return <View key={`blank-${index}`} style={styles.dayCell} />;
                const stamp = dateStamp(date);
                const isDisabled = stamp < earliest || (maxDate && stamp > maxDate) || disabled.has(stamp);
                const selected = stamp === value;
                return (
                  <Pressable
                    key={stamp}
                    accessibilityRole="button"
                    accessibilityLabel={date.toLocaleDateString(undefined, { dateStyle: 'full' })}
                    accessibilityState={{ selected, disabled: Boolean(isDisabled) }}
                    disabled={Boolean(isDisabled)}
                    onPress={() => chooseDate(date)}
                    style={[
                      styles.dayCell,
                      selected && { backgroundColor: colors.primary, borderRadius: radius.pill },
                    ]}
                  >
                    <Text style={[
                      styles.dayText,
                      { color: isDisabled ? colors.textTertiary : selected ? colors.textOnPrimary : colors.text },
                    ]}>
                      {date.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setVisible(false)}
              style={[styles.closeButton, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md }]}
            >
              <Text style={[type.label, { color: colors.text }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  field: {
    minHeight: 58,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  value: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: {
    flex: 1,
  },
  monthControls: {
    flexDirection: 'row',
    gap: 8,
  },
  monthButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthArrow: {
    fontSize: 30,
    lineHeight: 34,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  weekday: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 30,
    fontWeight: '700',
  },
  dayCell: {
    width: '14.2857%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
