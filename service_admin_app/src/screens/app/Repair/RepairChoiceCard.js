import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Glyph } from '../../../components/Glyph';
import { useTheme } from '../../../theme/ThemeContext';

export function RepairChoiceCard({
  title,
  detail,
  glyph,
  selected,
  onPress,
  accessibilityRole = 'radio',
  style,
}) {
  const { colors, radius, type } = useTheme();
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityState={{ checked: Boolean(selected), selected: Boolean(selected) }}
      accessibilityLabel={[title, detail].filter(Boolean).join('. ')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        style,
        {
          backgroundColor: selected ? colors.primaryLight : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderRadius: radius.card,
        },
        pressed && styles.pressed,
      ]}
    >
      {glyph ? (
        <View style={[styles.icon, { backgroundColor: selected ? colors.surface : colors.primaryLight, borderRadius: radius.md }]}>
          <Glyph name={glyph} color={colors.primary} size={20} />
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text style={[type.heading, { color: colors.text }]}>{title}</Text>
        {detail ? <Text style={type.muted}>{detail}</Text> : null}
      </View>
      {accessibilityRole === 'radio' ? (
        <View style={[
          styles.check,
          {
            borderColor: selected ? colors.primary : colors.border,
            borderRadius: radius.pill,
          },
        ]}>
          {selected ? <Glyph name="check" color={colors.primary} size={12} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 58,
    padding: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
  },
  icon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  check: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  pressed: {
    opacity: 0.92,
  },
});
