import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { toneInk } from '../../theme/tokens';
import { Glyph } from '../Glyph';
import { cardChrome } from './Card';
import { StatusBadge } from './StatusBadge';

export function ListItem({
  glyph,
  tone = 'primary',
  title,
  subtitle,
  meta,
  badge,
  badgeStatus,
  onPress,
  trailing,
  showChevron = true,
  accessibilityLabel,
  compact = false,
}) {
  const { colors, radius, type } = useTheme();
  const ink = toneInk(colors, tone);
  const face = (
    <View style={[
      cardChrome(colors, radius),
      compact && styles.compactCard,
      styles.row,
      compact && styles.compactRow,
    ]}>
      {glyph ? (
        <View style={[
          styles.icon,
          compact && styles.compactIcon,
          { backgroundColor: ink.bg, borderRadius: radius.button },
        ]}>
          <Glyph name={glyph} color={ink.fg} size={compact ? 16 : 20} />
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text style={type.heading} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={type.muted} numberOfLines={compact ? 1 : 2}>{subtitle}</Text> : null}
        {meta ? <Text style={type.small} numberOfLines={1}>{meta}</Text> : null}
      </View>
      {badge || badgeStatus ? (
        <StatusBadge label={badge} status={badgeStatus} />
      ) : null}
      {trailing}
      {onPress && showChevron && !badge && !badgeStatus ? (
        <Glyph name="chevron" color={colors.textTertiary} size={18} />
      ) : null}
    </View>
  );

  if (!onPress) return face;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {face}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactCard: {
    height: 58,
    padding: 6,
  },
  compactRow: {
    flex: 1,
    gap: 8,
  },
  icon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactIcon: {
    width: 24,
    height: 24,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.92,
  },
});
