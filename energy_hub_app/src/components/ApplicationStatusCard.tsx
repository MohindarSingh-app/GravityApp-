import { useUserPreferences } from '../providers/UserPreferencesProvider';
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { theme } from './theme';
import { StatusBadge } from './StatusBadge';

interface ApplicationStatusCardProps {
  status: string;
  message?: string;
  reason?: string;
}

export const ApplicationStatusCard: React.FC<ApplicationStatusCardProps> = ({
  status,
  message,
  reason,
}) => {
  useUserPreferences();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      marginHorizontal: theme.spacing.lg,
      marginVertical: theme.spacing.sm,
      alignItems: 'center',
    },
    icon: {
      fontSize: 48,
      marginBottom: theme.spacing.md,
    },
    badge: {
      marginBottom: theme.spacing.md,
    },
    message: {
      color: theme.colors.mainText,
      fontSize: 16,
      fontWeight: '600' as const,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
    reason: {
      color: theme.colors.secondaryText,
      fontSize: 14,
      textAlign: 'center',
    },
  });

  const getIcon = () => {
    switch (status) {
      case 'approved': return '✅';
      case 'rejected': return '❌';
      case 'suspended': return '🚫';
      case 'under_review': return '⏳';
      case 'needs_information': return 'ℹ️';
      default: return '⏳';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{getIcon()}</Text>
      <StatusBadge status={status} />
      {message && <Text style={styles.message}>{message}</Text>}
      {reason && <Text style={styles.reason}>{reason}</Text>}
    </View>
  );
};