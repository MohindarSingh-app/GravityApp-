import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AppBar } from '../../../components/AppBar';
import { Screen } from '../../../components/Screen';
import { ThemeControls } from '../../../components/ThemeControls';
import { useTheme } from '../../../theme/ThemeContext';

export function AppearanceScreen() {
  const navigation = useNavigation();
  const { colors, radius, type } = useTheme();
  return (
    <Screen header={<AppBar title="Appearance" onBack={() => navigation.goBack()} />}>
      <ThemeControls />
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('License')}
        style={[styles.license, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.card }]}
      >
        <Text style={type.heading}>License & notices</Text>
        <Text style={[type.small, { color: colors.textSecondary }]}>App license, acceptable use and open-source notices</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  license: {
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
});
