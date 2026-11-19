import React from 'react';
import { StyleSheet, TouchableOpacity, Text, View } from 'react-native';
import { theme } from './theme';
import { useUserPreferences } from '../providers/UserPreferencesProvider';

interface SelectionCardProps {
  title: string;
  value: string;
  selected: boolean;
  onPress: () => void;
}

export const SelectionCard: React.FC<SelectionCardProps> = ({
  title,
  selected,
  onPress,
}) => {
  const { colors } = useUserPreferences();
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: selected ? colors.primaryLight : colors.surface,
      borderWidth: 1,
      borderColor: selected ? colors.primary : colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      minHeight: 44,
      minWidth: '46%',
      flexGrow: 1,
    },
    title: {
      color: selected ? colors.primary : colors.text,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: selected ? '700' as const : '500' as const,
    },
    checkmark: {
      color: theme.colors.success,
      fontSize: theme.typography.captionSmall.fontSize,
      fontWeight: '700' as const,
    },
  });

  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={title}
      style={styles.container}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
      </View>
      {selected && <Text style={styles.checkmark}>✓</Text>}
    </TouchableOpacity>
  );
};