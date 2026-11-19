import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

const TONE_BY_STATUS = {
  active: 'success',
  completed: 'success',
  done: 'success',
  success: 'success',
  pending: 'pending',
  open: 'pending',
  in_progress: 'info',
  on_the_way: 'info',
  cancelled: 'error',
  canceled: 'error',
  revoked: 'error',
  expired: 'warning',
  expiring: 'warning',
  primary: 'info',
  placed: 'info',
  confirmed: 'info',
  dispatched: 'info',
  shipped: 'info',
  delivered: 'success',
  processing: 'pending',
};

export function StatusBadge({ label, status, tone }) {
  const { colors, type } = useTheme();
  const key = tone || TONE_BY_STATUS[String(status || '').toLowerCase()] || 'pending';
  const palette = {
    success: { fg: colors.success, bg: colors.successSurface },
    warning: { fg: colors.warning, bg: colors.warningSurface },
    error: { fg: colors.danger, bg: colors.dangerSurface },
    info: { fg: colors.info, bg: colors.infoSurface },
    pending: { fg: colors.pending, bg: colors.pendingSurface },
  };
  const ink = palette[key] || palette.pending;
  const text = label || status || '';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={text}
      style={[styles.badge, { backgroundColor: ink.bg }]}
    >
      <View style={[styles.dot, { backgroundColor: ink.fg }]} />
      <Text style={[type.small, styles.label, { color: ink.fg }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontWeight: '600',
  },
});
