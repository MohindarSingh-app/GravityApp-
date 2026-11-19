import { useUserPreferences } from '../providers/UserPreferencesProvider';
import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { theme } from './theme';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  onRetry,
}) => {
  useUserPreferences();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.errorLight,
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.error,
      padding: theme.spacing.md,
      marginHorizontal: theme.spacing.lg,
      marginVertical: theme.spacing.sm,
      borderRadius: theme.borderRadius.md,
    },
    message: {
      color: theme.colors.error,
      fontSize: 14,
      marginBottom: theme.spacing.sm,
    },
    retryButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      backgroundColor: theme.colors.error,
      borderRadius: theme.borderRadius.sm,
      alignSelf: 'flex-start',
    },
    retryText: {
      color: theme.colors.white,
      fontSize: 12,
      fontWeight: '600' as const,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};