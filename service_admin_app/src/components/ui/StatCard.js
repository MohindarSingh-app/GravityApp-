import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { toneInk } from '../../theme/tokens';
import { Glyph } from '../Glyph';
import { cardChrome } from './Card';

export function MetricChip({
  label,
  value,
  description,
  tone = 'primary',
  glyph = 'pulse',
  onPress,
  compact = false,
}) {
  const { colors, radius, type } = useTheme();
  const ink = toneInk(colors, tone);
  const face = (
    <View
      style={[
        styles.chip,
        compact && styles.compactChip,
        {
          backgroundColor: ink.bg,
          borderColor: ink.fg,
          borderRadius: radius.card,
        },
      ]}
    >
      <View style={[styles.chipHeading, compact && styles.compactHeading]}>
        <View style={[styles.chipIcon, compact && styles.compactIcon, { backgroundColor: colors.surface, borderRadius: radius.chip }]}>
          <Glyph name={glyph} color={ink.fg} size={compact ? 16 : 15} />
        </View>
        {compact ? (
          <View style={styles.compactCopy}>
            <Text style={[styles.compactValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
            <Text style={[type.small, styles.compactLabel, { color: colors.textSecondary }]} numberOfLines={1}>
              {label}
            </Text>
            <Text style={[type.small, styles.compactDescription, { color: colors.textTertiary }]} numberOfLines={1}>
              {description}
            </Text>
          </View>
        ) : (
          <Text style={[type.small, styles.chipLabel, { color: colors.textSecondary }]} numberOfLines={2}>
            {label}
          </Text>
          )}
      </View>
      {!compact ? <Text style={[styles.chipValue, { color: colors.text }]}>{value}</Text> : null}
    </View>
  );
  if (!onPress) return face;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.chipPress, pressed && styles.pressed]}
    >
      {face}
    </Pressable>
  );
}

export function MetricCircle({ label, value, tone = 'primary', onPress }) {
  const { colors, type } = useTheme();
  const ink = toneInk(colors, tone);
  const face = (
    <View style={styles.circleWrap}>
      <View style={[styles.circle, { backgroundColor: ink.bg, borderColor: ink.fg }]}>
        <Text style={[styles.circleValue, { color: ink.fg }]}>{value}</Text>
      </View>
      <Text style={[type.small, styles.circleLabel]} numberOfLines={2}>{label}</Text>
    </View>
  );
  if (!onPress) return face;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      onPress={onPress}
      style={({ pressed }) => [styles.circlePress, pressed && styles.pressed]}
    >
      {face}
    </Pressable>
  );
}

export function StatCard({ label, value, hint, onPress, glyph, tone = 'primary' }) {
  const { colors, radius, type } = useTheme();
  const ink = toneInk(colors, tone);
  const face = (
    <View style={[cardChrome(colors, radius), styles.card]}>
      {glyph ? (
        <View style={[styles.icon, { backgroundColor: ink.bg, borderRadius: radius.sm }]}>
          <Glyph name={glyph} color={ink.fg} size={16} />
        </View>
      ) : null}
      <Text style={type.stat}>{value}</Text>
      <Text style={type.small} numberOfLines={2}>{label}</Text>
      {hint ? <Text style={[type.small, { color: colors.success }]}>{hint}</Text> : null}
    </View>
  );

  if (!onPress) return face;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value}`}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {face}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chipPress: {
    flex: 1,
  },
  chip: {
    flex: 1,
    borderWidth: 1.5,
    padding: 12,
    gap: 2,
    minHeight: 100,
    justifyContent: 'center',
  },
  compactChip: {
    minHeight: 82,
    height: 82,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    justifyContent: 'center',
  },
  chipIcon: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactHeading: {
    gap: 10,
  },
  compactCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 0,
  },
  compactValue: {
    fontSize: 15.5,
    lineHeight: 19,
    fontWeight: '800',
  },
  chipValue: {
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 31,
  },
  chipLabel: {
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 15,
  },
  compactLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  compactDescription: {
    fontSize: 9,
    lineHeight: 11,
    textAlign: 'right',
  },
  compactIcon: {
    width: 34,
    height: 34,
  },
  card: {
    gap: 4,
    minHeight: 112,
    height: 112,
    justifyContent: 'center',
  },
  icon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  pressed: {
    opacity: 0.92,
  },
  circlePress: {
    flex: 1,
  },
  circleWrap: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  circleValue: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  circleLabel: {
    textAlign: 'center',
  },
});
