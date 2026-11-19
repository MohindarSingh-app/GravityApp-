import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { theme } from './theme';
import { AppearanceMode, useUserPreferences } from '../providers/UserPreferencesProvider';

const MODES: Array<{ id: AppearanceMode; label: string; icon: 'sunny' | 'moon' }> = [
  { id: 'light', label: 'Light', icon: 'sunny' },
  { id: 'dark', label: 'Dark', icon: 'moon' },
];

export const AppearanceSwitch: React.FC = () => {
  const { appearance, setAppearance } = useUserPreferences();
  const colors = theme.colors;
  const styles = StyleSheet.create({
    card: {
      marginHorizontal: 18,
      marginTop: 18,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      gap: 12,
    },
    copy: { gap: 2 },
    title: { color: colors.mainText, fontSize: 14, fontWeight: '700' },
    subtitle: { color: colors.textMuted, fontSize: 12, fontWeight: '500' },
    segment: {
      flexDirection: 'row',
      gap: 6,
      padding: 4,
      borderRadius: 12,
      backgroundColor: colors.surfaceVariant,
    },
    option: {
      flex: 1,
      minHeight: 40,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    optionSelected: {
      backgroundColor: colors.surface,
      borderColor: colors.primary,
    },
    optionLabel: { color: colors.secondaryText, fontSize: 13, fontWeight: '700' },
    optionLabelSelected: { color: colors.brandInk },
  });

  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.title}>Appearance</Text>
        <Text style={styles.subtitle}>{appearance === 'dark' ? 'Dark theme' : 'Light theme'}</Text>
      </View>
      <View style={styles.segment}>
        {MODES.map((mode) => {
          const selected = appearance === mode.id;
          return (
            <TouchableOpacity
              key={mode.id}
              accessibilityRole="button"
              accessibilityLabel={`${mode.label} theme`}
              accessibilityState={{ selected }}
              activeOpacity={theme.interaction.pressedOpacity}
              onPress={() => { void setAppearance(mode.id); }}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Ionicons name={mode.icon} size={15} color={selected ? colors.primary : colors.textMuted} />
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{mode.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};
