import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Glyph } from '../Glyph';
import { cardChrome } from './Card';

export function ActionCard({
  glyph = 'spark',
  title,
  description,
  onPress,
  accessibilityLabel,
}) {
  const { colors, radius, type } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <View style={[cardChrome(colors, radius), styles.row]}>
        <View style={[styles.icon, { backgroundColor: colors.primaryLight, borderRadius: radius.button }]}>
          <Glyph name={glyph} color={colors.primary} size={20} />
        </View>
        <View style={styles.copy}>
          <Text style={type.heading}>{title}</Text>
          {description ? <Text style={type.muted}>{description}</Text> : null}
        </View>
        <Glyph name="chevron" color={colors.textTertiary} size={18} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.92,
  },
});
