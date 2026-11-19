import { useUserPreferences } from '../providers/UserPreferencesProvider';
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { theme } from './theme';

interface FormSectionProps {
  title: string;
  children: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  children,
}) => {
  useUserPreferences();

  const styles = StyleSheet.create({
    container: {
      marginBottom: theme.spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.secondaryText,
    },
    numberBadge: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.primaryAction,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: theme.spacing.sm,
    },
    numberText: {
      color: theme.colors.white,
      fontSize: 14,
      fontWeight: 'bold' as const,
    },
    title: {
      color: theme.colors.mainText,
      fontSize: 18,
      fontWeight: '600' as const,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.numberBadge}>
          <Text style={styles.numberBadge}>{title}</Text>
        </View>
      </View>
      {children}
    </View>
  );
};