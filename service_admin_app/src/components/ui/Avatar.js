import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '•';
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
}

export function Avatar({ name, uri, size = 40 }) {
  const { colors } = useTheme();
  const safe = size === 32 || size === 48 || size === 88 ? size : 40;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name ? `${name} avatar` : 'Avatar'}
      style={[
        styles.circle,
        {
          width: safe,
          height: safe,
          borderRadius: safe / 2,
          backgroundColor: colors.primaryLight,
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: safe, height: safe, borderRadius: safe / 2 }} />
      ) : (
        <Text style={[styles.letters, { color: colors.primary, fontSize: Math.round(safe * 0.34) }]}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  letters: {
    fontWeight: '700',
    includeFontPadding: false,
  },
});
