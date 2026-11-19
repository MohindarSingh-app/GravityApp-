import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Glyph } from './Glyph';

export function ThemeControls() {
  const { colors, radius, type, scheme, setScheme } = useTheme();
  const options = [
    { id: 'light', label: 'Light', glyph: 'sun' },
    { id: 'dark', label: 'Dark', glyph: 'moon' },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={type.section}>Appearance</Text>
      <Text style={type.muted}>Choose light or dark appearance.</Text>
      <View accessibilityRole="radiogroup" style={styles.modeGrid}>
        {options.map((option) => {
          const selected = scheme === option.id;
          return (
            <Pressable
              key={option.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label} theme`}
              onPress={() => setScheme(option.id)}
              style={[styles.modeOption, {
                backgroundColor: selected ? colors.primaryLight : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
                borderRadius: radius.md,
              }]}
            >
              <Glyph name={option.glyph} color={selected ? colors.primary : colors.textSecondary} size={20} />
              <Text style={[styles.modeLabel, { color: colors.text }]}>{option.label}</Text>
              {selected ? <Glyph name="check" color={colors.primary} size={18} /> : null}
            </Pressable>
          );
        })}
      </View>
      <Text style={type.small}>Orange for actions, red for urgent alerts, and green for success.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  modeGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  modeOption: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
});
