import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from './Button';
import { Glyph } from '../Glyph';
import { cardChrome } from './Card';

export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this screen.',
  onRetry,
  retryLabel = 'Try again',
}) {
  const { colors, radius, type } = useTheme();
  return (
    <View style={[cardChrome(colors, radius), styles.box]}>
      <View style={[styles.icon, { backgroundColor: colors.dangerSurface, borderRadius: radius.md }]}>
        <Glyph name="bolt" color={colors.danger} size={22} />
      </View>
      <Text style={[type.section, styles.center]} accessibilityRole="header">{title}</Text>
      <Text style={[type.body, styles.center]}>{message}</Text>
      {onRetry ? <Button title={retryLabel} onPress={onRetry} /> : null}
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
