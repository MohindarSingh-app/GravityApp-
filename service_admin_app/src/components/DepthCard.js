import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { toneInk } from '../theme/tokens';
import { Glyph } from './Glyph';
import { LiveDot } from './LiveDot';
import { cardChrome } from './ui/Card';

export function DepthCard({
  tone = 'amc',
  glyph = 'spark',
  kicker,
  title,
  detail,
  value,
  onPress,
  live = false,
  iconAbove = false,
  compact = false,
  accessibilityLabel,
  children,
}) {
  const { colors, radius, type } = useTheme();
  const ink = toneInk(colors, tone);
  const headStyle = iconAbove
    ? [styles.head, styles.headVertical]
    : styles.head;
  const faceStyle = compact
    ? [styles.face, styles.faceCompact]
    : styles.face;
  const iconStyle = compact
    ? [styles.icon, styles.iconCompact]
    : styles.icon;

  const face = (
    <View style={[cardChrome(colors, radius), faceStyle]}>
      <View style={headStyle}>
        <View style={[iconStyle, { backgroundColor: ink.bg, borderRadius: radius.button }]}>
          <Glyph name={glyph} color={ink.fg} size={compact ? 16 : 20} />
        </View>
        <View style={styles.copy}>
          {kicker ? (
            <View style={styles.kickerRow}>
              {live ? <LiveDot color={ink.fg} size={8} /> : null}
              <Text style={[type.small, styles.kicker, { color: ink.fg }]} numberOfLines={1}>{kicker}</Text>
            </View>
          ) : null}
          {title ? <Text style={type.heading} numberOfLines={compact ? 2 : undefined}>{title}</Text> : null}
        </View>
        {value ? <Text style={type.stat}>{value}</Text> : null}
        {onPress ? <Glyph name="chevron" color={colors.textTertiary} size={18} /> : null}
      </View>
      {detail ? <Text style={type.muted} numberOfLines={compact ? 1 : undefined}>{detail}</Text> : null}
      {children}
    </View>
  );

  if (!onPress) return face;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || [kicker, title, detail].filter(Boolean).join('. ')}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {face}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    gap: 8,
  },
  faceCompact: {
    minHeight: 0,
    padding: 6,
    gap: 2,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headVertical: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  icon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCompact: {
    width: 26,
    height: 26,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kicker: {
    fontWeight: '600',
    flex: 1,
  },
  pressed: {
    opacity: 0.92,
  },
});
