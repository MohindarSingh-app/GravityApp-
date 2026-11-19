import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Glyph } from '../Glyph';

export function LocationCard({
  ready = false,
  detail = '',
  onPress,
  loading = false,
  actionLabel,
}) {
  const { colors, radius, type } = useTheme();
  const label = actionLabel || (ready ? 'Update GPS' : 'Use GPS');
  return (
    <View style={[styles.card, { backgroundColor: colors.successSurface, borderColor: colors.success, borderRadius: radius.md }]}>
      <View style={[styles.icon, { backgroundColor: colors.surface, borderRadius: radius.sm }]}>
        <Glyph name="pin" color={colors.success} size={20} />
      </View>
      <View style={styles.copy}>
        <Text style={[type.heading, { color: colors.text }]}>GPS location</Text>
        <Text style={type.small}>
          {ready && detail ? detail : 'Tap to capture your site GPS'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        disabled={loading}
        style={[styles.action, { backgroundColor: colors.success, borderRadius: radius.button }]}
      >
        {loading ? <ActivityIndicator color={colors.onAccent} /> : (
          <Text style={[styles.actionText, { color: colors.onAccent }]}>{label}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 72,
    borderWidth: 1,
    padding: 12,
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
  action: {
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
