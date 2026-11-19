import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { toneInk } from '../../theme/tokens';
import { Glyph } from '../Glyph';

export function TileCard({
  glyph = 'spark',
  title,
  detail,
  badge,
  tone = 'primary',
  fill = false,
  paint,
  onPress,
  style,
}) {
  const { colors, radius, type } = useTheme();
  const ink = toneInk(colors, tone);
  const painted = Boolean(fill && paint);
  const bg = painted ? paint : fill ? colors.primary : colors.surface;
  const fg = fill ? colors.onAccent : ink.fg;
  const copy = fill ? colors.onAccent : colors.text;
  const muted = fill ? 'rgba(255,255,255,0.82)' : colors.muted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.press, pressed && styles.pressed, style]}
    >
      <View
        style={[
          styles.card,
          fill ? styles.cardFill : styles.cardOutline,
          { backgroundColor: bg, borderRadius: radius.card, borderColor: fill ? 'transparent' : colors.border },
        ]}
      >
        <View style={styles.top}>
          <View
            style={[
              styles.icon,
              fill ? styles.iconGlow : { backgroundColor: ink.bg },
              { borderRadius: radius.button },
            ]}
          >
            <Glyph name={glyph} color={fg} size={22} />
          </View>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: fill ? colors.primary : ink.bg, borderRadius: radius.pill }]}>
              <Text style={[styles.badgeText, { color: fill ? colors.textOnPrimary : ink.fg }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[type.heading, { color: copy }]} numberOfLines={2}>{title}</Text>
        {detail ? <Text style={[type.small, { color: muted }]} numberOfLines={2}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    flex: 1,
  },
  pressed: {
    opacity: 0.92,
  },
  card: {
    minHeight: 108,
    height: 108,
    padding: 12,
    gap: 6,
    justifyContent: 'space-between',
  },
  cardFill: {
    borderWidth: 0,
  },
  cardOutline: {
    borderWidth: 1,
  },
  iconGlow: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  icon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
