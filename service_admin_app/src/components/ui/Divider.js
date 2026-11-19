import { StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export function Divider({ inset = false }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="none"
      style={[
        styles.line,
        { backgroundColor: colors.border, marginLeft: inset ? 16 : 0 },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
});
