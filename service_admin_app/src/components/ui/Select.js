import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useFormNavigationField } from '../forms/FormNavigation';
import { Glyph } from '../Glyph';
import { BottomSheet } from './BottomSheet';

export function Select({
  label,
  value,
  placeholder = 'Select',
  options = [],
  onChange,
  error,
  helper,
}) {
  const { colors, radius, type } = useTheme();
  const [open, setOpen] = useState(false);
  const fieldRef = useRef(null);
  const selected = options.find((option) => option.value === value);
  const focusField = useCallback(() => {
    if (options.length) setOpen(true);
  }, [options.length]);
  const formField = useFormNavigationField(focusField, options.length > 0, fieldRef);

  return (
    <View ref={fieldRef} collapsable={false} style={styles.wrap}>
      {label ? <Text style={type.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label || placeholder}
        accessibilityState={{ expanded: open, disabled: options.length === 0 }}
        disabled={options.length === 0}
        onPress={() => {
          formField.activate();
          setOpen(true);
        }}
        style={[
          styles.field,
          {
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radius.input,
            backgroundColor: error ? colors.dangerSurface : colors.surfaceSecondary,
          },
        ]}
      >
        <Text
          style={[styles.value, { color: selected ? colors.text : colors.placeholder }]}
          numberOfLines={1}
        >
          {selected ? selected.label : placeholder}
        </Text>
        <Glyph name="chevron" color={colors.textTertiary} size={18} />
      </Pressable>
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : options.length === 0 ? (
        <Text style={[styles.error, { color: colors.warning }]}>
          Choices are not available for this field. Please try again later or contact support.
        </Text>
      ) : helper ? (
        <Text style={type.small}>{helper}</Text>
      ) : null}
      <BottomSheet visible={open} title={label || placeholder} onClose={() => setOpen(false)}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
                formField.advance();
              }}
              style={[styles.option, { borderBottomColor: colors.border }]}
            >
              <Text style={[
                type.body,
                active ? styles.selectedOption : styles.optionText,
                { color: active ? colors.primary : colors.text },
              ]}>
                {option.label}
              </Text>
              {active ? <Glyph name="check" color={colors.primary} size={18} /> : null}
            </Pressable>
          );
        })}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  field: {
    minHeight: 58,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  value: {
    flex: 1,
    fontSize: 14,
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: {
    fontWeight: '400',
  },
  selectedOption: {
    fontWeight: '600',
  },
});
