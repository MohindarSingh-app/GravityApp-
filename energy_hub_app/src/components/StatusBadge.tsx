import { useUserPreferences } from '../providers/UserPreferencesProvider';
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { theme } from './theme';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
}) => {
  useUserPreferences();

  const styles = StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 6,
      borderRadius: theme.borderRadius.pill,
      alignSelf: 'flex-start',
    },
    text: {
      color: theme.colors.textInverse,
      fontSize: theme.typography.captionSmall.fontSize,
      fontWeight: theme.typography.captionSmall.fontWeight,
    },
    underReview: {
      backgroundColor: theme.colors.info,
    },
    needsInformation: {
      backgroundColor: theme.colors.warning,
    },
    approved: {
      backgroundColor: theme.colors.success,
    },
    rejected: {
      backgroundColor: theme.colors.error,
    },
    suspended: {
      backgroundColor: theme.colors.error,
    },
  });

  const getStyle = () => {
    switch (status) {
      case 'under_review': return styles.underReview;
      case 'needs_information': return styles.needsInformation;
      case 'approved': return styles.approved;
      case 'rejected': return styles.rejected;
      case 'suspended': return styles.suspended;
      default: return styles.underReview;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'under_review': return 'Under Review';
      case 'needs_information': return 'Needs Information';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'suspended': return 'Suspended';
      default: return status;
    }
  };

  return (
    <View style={[styles.container, getStyle()]}>
      <Text style={styles.text}>{getLabel()}</Text>
    </View>
  );
};