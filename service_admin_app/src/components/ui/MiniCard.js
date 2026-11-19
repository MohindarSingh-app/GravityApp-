import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { toneInk } from '../../theme/tokens';
import { Glyph } from '../Glyph';

export function MiniCard({
  glyph = 'spark',
  title,
  subtitle,
  subtitleLines,
  count,
  tone = 'primary',
  selected = false,
  horizontal = false,
  iconRight = false,
  colorful = false,
  showChevron = false,
  onPress,
  style,
  cardStyle,
  accessibilityLabel,
}) {
  const { colors, radius, type } = useTheme();
  const ink = toneInk(colors, tone);
  const borderColor = selected ? ink.fg : colors.border;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed, style]}
    >
      <View
        style={[
          styles.card,
          colorful && styles.colorfulCard,
          horizontal && styles.horizontalCard,
          horizontal && iconRight && styles.iconRightCard,
          {
            backgroundColor: colorful ? ink.bg : colors.surface,
            borderColor: colorful ? ink.bg : borderColor,
            borderRadius: radius.card,
          },
          selected ? styles.selectedBorder : styles.cardBorder,
          cardStyle,
        ]}
      >
        <View
          style={[
            styles.icon,
            horizontal && styles.shortcutIcon,
            colorful && styles.raisedIcon,
            { backgroundColor: colorful ? ink.fg : ink.bg, borderRadius: radius.chip },
          ]}
        >
          <Glyph name={glyph} color={colorful ? colors.onAccent : ink.fg} size={colorful ? 19 : 18} />
        </View>
        <View style={horizontal ? styles.horizontalCopy : null}>
          <Text style={[type.heading, styles.title]} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={[type.small, styles.sub]} numberOfLines={subtitleLines || (horizontal ? 2 : 1)}>{subtitle}</Text> : null}
          {count != null && count !== '' ? (
            <Text style={[type.small, styles.count, { color: ink.fg }]}>{count}</Text>
          ) : null}
        </View>
        {showChevron ? (
          <View style={[styles.chevron, { backgroundColor: colors.surface, borderRadius: radius.pill }]}>
            <Glyph name="chevron" color={ink.fg} size={12} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 72,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  card: {
    padding: 10,
    gap: 6,
    minHeight: 88,
    justifyContent: 'flex-start',
  },
  selectedBorder: {
    borderWidth: 2,
  },
  cardBorder: {
    borderWidth: 1.5,
  },
  count: {
    fontWeight: '700',
  },
  colorfulCard: {
    minHeight: 96,
    height: 96,
    padding: 12,
    gap: 10,
  },
  horizontalCard: {
    height: 96,
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  iconRightCard: {
    flexDirection: 'row-reverse',
  },
  horizontalCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  icon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutIcon: {
    width: 38,
    height: 38,
  },
  chevron: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raisedIcon: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  title: {
    fontSize: 14,
    lineHeight: 18,
  },
  sub: {
    marginTop: -2,
  },
});
