import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { toneInk } from '../../theme/tokens';
import { Glyph } from '../Glyph';

export function IllustrationCard({
  glyph = 'cover',
  tone = 'primary',
  title,
  detail,
  badge,
  meta,
  onPress,
  style,
}) {
  const { colors, radius, type } = useTheme();
  const ink = toneInk(colors, tone);

  const face = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: ink.bg,
          borderColor: ink.fg,
          borderRadius: radius.lg,
        },
      ]}
    >
      <View style={[styles.art, { backgroundColor: colors.surface, borderRadius: radius.md }]}>
        <Glyph name={glyph} color={ink.fg} size={28} />
      </View>
      <View style={styles.copy}>
        <View style={styles.head}>
          <Text style={[type.heading, styles.title]} numberOfLines={2}>{title}</Text>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: colors.primary, borderRadius: radius.pill }]}>
              <Text style={[styles.badgeText, { color: colors.textOnPrimary }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {detail ? <Text style={type.muted} numberOfLines={2}>{detail}</Text> : null}
        {meta ? <Text style={type.small}>{meta}</Text> : null}
      </View>
    </View>
  );

  if (!onPress) {
    return <View style={style}>{face}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && styles.pressed]}
    >
      {face}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    padding: 18,
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 150,
  },
  art: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    width: '100%',
    gap: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.92,
  },
});
