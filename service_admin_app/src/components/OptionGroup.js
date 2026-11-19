import { useCallback, useRef } from 'react';
import {
  AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { useFormNavigationField } from './forms/FormNavigation';

export function OptionGroup({ label, options, value, onChange, error }) {
  const { colors, radius, type } = useTheme();
  const firstOptionRef = useRef(null);
  const fieldRef = useRef(null);
  const focusField = useCallback(() => {
    const target = firstOptionRef.current && findNodeHandle(firstOptionRef.current);
    if (target != null) AccessibilityInfo.setAccessibilityFocus(target);
  }, []);
  const formField = useFormNavigationField(focusField, options.length > 0, fieldRef);
  return (
    <View
      ref={fieldRef}
      collapsable={false}
      style={styles.wrap}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      <Text style={type.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              ref={index === 0 ? firstOptionRef : undefined}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              onPress={() => {
                onChange(option.value);
                formField.advance();
              }}
              style={[
                styles.chip,
                {
                  borderRadius: radius.button,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primaryLight : colors.surface,
                  borderWidth: selected ? 2 : 1.5,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? colors.primary : colors.text }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 50,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
});
