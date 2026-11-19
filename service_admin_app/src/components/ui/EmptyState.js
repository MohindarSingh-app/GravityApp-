import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Glyph } from '../Glyph';
import { cardChrome } from './Card';

export function EmptyState({ title, message, action = null, glyph = 'box' }) {
  const { colors, radius, type } = useTheme();
  return (
    <View style={[cardChrome(colors, radius), styles.box]}>
      <View style={[styles.icon, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
        <Glyph name={glyph} color={colors.primary} size={22} />
      </View>
      <Text style={[type.section, styles.center]} accessibilityRole="header">{title}</Text>
      <Text style={[type.body, styles.center]}>{message}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 24,
  },
  icon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  center: {
    textAlign: 'center',
  },
});
