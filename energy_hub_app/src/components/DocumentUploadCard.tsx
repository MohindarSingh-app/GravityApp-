import React from 'react';
import { StyleSheet, TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';
import { theme } from './theme';
import { useUserPreferences } from '../providers/UserPreferencesProvider';

interface DocumentUploadCardProps {
  title: string;
  status: 'pending' | 'uploading' | 'uploaded' | 'rejected';
  onPress: () => void;
  uploading?: boolean;
  subtitle?: string;
}

export const DocumentUploadCard: React.FC<DocumentUploadCardProps> = ({
  title,
  status,
  onPress,
  uploading = false,
  subtitle,
}) => {
  const { colors } = useUserPreferences();
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: theme.borderRadius.lg,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      minHeight: 56,
    },
    containerUploaded: {
      backgroundColor: theme.colors.primaryLight,
      borderColor: colors.primary,
    },
    left: { flex: 1, paddingRight: theme.spacing.sm },
    title: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600' as const,
    },
    subtitle: {
      color: colors.secondaryText,
      fontSize: 12,
      marginTop: 2,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600' as const,
    },
    statusPending: {
      color: theme.colors.secondaryText,
    },
    statusUploaded: {
      color: theme.colors.success,
    },
    statusRejected: {
      color: theme.colors.error,
    },
  });

  const getStatusColor = () => {
    switch (status) {
      case 'uploaded': return styles.statusUploaded;
      case 'rejected': return styles.statusRejected;
      default: return styles.statusPending;
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'uploaded': return 'Uploaded';
      case 'rejected': return 'Rejected';
      case 'uploading': return 'Uploading...';
      default: return 'Tap to upload';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, status === 'uploaded' && styles.containerUploaded]}
      onPress={onPress}
      disabled={uploading}
    >
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View>
        {uploading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={[styles.statusText, getStatusColor()]}>{getStatusLabel()}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};