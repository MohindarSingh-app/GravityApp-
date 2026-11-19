import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Glyph } from '../Glyph';

export function IconButton({
  glyph = 'bell',
  label,
  onPress,
  badge,
  color,
}) {
  const { colors, radius } = useTheme();
  const tint = color || colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.hit,
        {
          borderRadius: radius.button,
          backgroundColor: pressed ? colors.primaryLight : colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
      ]}
    >
      <Glyph name={glyph} color={tint} size={22} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.badgeText, { color: colors.onAccent }]}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
