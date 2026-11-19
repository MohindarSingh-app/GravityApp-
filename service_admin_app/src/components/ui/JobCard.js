import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { toneInk } from '../../theme/tokens';
import { Glyph } from '../Glyph';
import { StatusBadge } from './StatusBadge';
import { cardChrome } from './Card';

function toneForStatus(status) {
  if (status === 'cancelled' || status === 'canceled') return 'emergency';
  if (status === 'completed' || status === 'done') return 'success';
  if (status === 'in_progress' || status === 'on_the_way') return 'info';
  if (status === 'open' || status === 'pending') return 'pending';
  return 'primary';
}

export function JobCard({
  title,
  code,
  status,
  statusLabel,
  technician,
  location,
  meta,
  onPress,
  compact = true,
}) {
  const { colors, radius, type } = useTheme();
  const ink = toneInk(colors, toneForStatus(status));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <View
        style={[
          cardChrome(colors, radius),
          compact ? styles.compact : styles.card,
        ]}
      >
        <View style={[styles.statusIcon, { backgroundColor: ink.bg, borderRadius: radius.chip }]}>
          <Glyph name="jobs" color={ink.fg} size={16} />
        </View>
        <View style={styles.body}>
          <View style={styles.head}>
            <View style={styles.copy}>
              <Text style={type.heading} numberOfLines={1}>{title}</Text>
              {code ? <Text style={type.small}>{code}</Text> : null}
            </View>
            {statusLabel ? <StatusBadge label={statusLabel} status={status} /> : null}
          </View>
          {(technician || location || meta) ? (
            <View style={styles.metaBlock}>
              {technician ? (
                <View style={styles.metaRow}>
                  <Glyph name="user" color={colors.orange} size={12} />
                  <Text style={type.small} numberOfLines={1}>{technician}</Text>
                </View>
              ) : null}
              {location ? (
                <View style={styles.metaRow}>
                  <Glyph name="pin" color={colors.teal} size={12} />
                  <Text style={type.small} numberOfLines={1}>{location}</Text>
                </View>
              ) : null}
              {meta ? <Text style={type.small}>{meta}</Text> : null}
            </View>
          ) : null}
        </View>
        {onPress ? <Glyph name="chevron" color={colors.textTertiary} size={16} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  compact: {
    gap: 10,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  statusIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  metaBlock: {
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pressed: {
    opacity: 0.92,
  },
});
