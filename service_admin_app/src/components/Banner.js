import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Glyph } from './Glyph';

export function Banner({ message, tone = 'error' }) {
  const { colors, radius } = useTheme();
  if (!message) return null;
  const palette = tone === 'success'
    ? { background: colors.successSurface, color: colors.success, glyph: 'check' }
    : tone === 'info'
      ? { background: colors.infoSurface, color: colors.info, glyph: 'spark' }
      : tone === 'warning'
        ? { background: colors.warningSurface, color: colors.warning, glyph: 'bolt' }
        : { background: colors.dangerSurface, color: colors.danger, glyph: 'bolt' };

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.box,
        {
          backgroundColor: palette.background,
          borderRadius: radius.md,
          borderColor: palette.color,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: `${palette.color}22`, borderRadius: radius.chip }]}>
        <Glyph name={palette.glyph} color={palette.color} size={16} />
      </View>
      <Text style={[styles.text, { color: palette.color }]}>{message}</Text>
    </View>
  );
}

export function ErrorText({ message }) {
  return <Banner message={message} tone="error" />;
}

const styles = StyleSheet.create({
  box: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
