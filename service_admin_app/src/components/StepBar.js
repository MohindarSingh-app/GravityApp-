import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export function StepBar({ steps, step }) {
  const { colors, type } = useTheme();
  const current = steps[step] || steps[0];
  const compact = steps.length >= 5;
  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Step ${step + 1} of ${steps.length}: ${current}`}
      style={[
        styles.row,
        compact && styles.compactRow,
        styles.transparentRow,
      ]}
    >
      {steps.map((label, index) => {
        const done = index < step;
        const active = index === step;
        const fg = done || active ? colors.onAccent : colors.textTertiary;
        const bg = done ? colors.successSolid : active ? colors.primary : colors.surfaceTertiary;
        return (
          <View key={`${label}-${index}`} style={[styles.step, compact && styles.compactStep]}>
            <View style={[
              styles.mark,
              compact && styles.compactMark,
              { backgroundColor: bg, borderColor: done || active ? bg : colors.borderStrong },
            ]}>
              <Text style={[styles.markText, compact && styles.compactMarkText, { color: fg }]}>{done ? '✓' : index + 1}</Text>
            </View>
            <Text
              numberOfLines={1}
              style={[
                type.small,
                styles.label,
                compact && styles.compactLabel,
                { color: active ? colors.primary : colors.textTertiary },
                active && styles.activeLabel,
              ]}
            >
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  transparentRow: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  step: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
  },
  mark: {
    width: 32,
    height: 32,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: {
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
  label: {
    textAlign: 'center',
  },
  compactRow: {
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  compactStep: {
    gap: 4,
  },
  compactMark: {
    width: 24,
    height: 24,
    borderRadius: 9,
  },
  compactMarkText: {
    fontSize: 10,
  },
  compactLabel: {
    fontSize: 8,
    lineHeight: 10,
  },
  activeLabel: {
    fontWeight: '600',
  },
});
