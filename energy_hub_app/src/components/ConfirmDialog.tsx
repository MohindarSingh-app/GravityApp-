import { useUserPreferences } from '../providers/UserPreferencesProvider';
import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { theme } from './theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Yes',
  cancelText = 'Cancel',
}) => {
  useUserPreferences();

  const styles = StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      width: '90%',
      maxWidth: 400,
      alignItems: 'center',
    },
    title: {
      color: theme.colors.mainText,
      fontSize: 18,
      fontWeight: '600' as const,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
    message: {
      color: theme.colors.secondaryText,
      fontSize: 14,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      width: '100%',
    },
    cancelButton: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: theme.borderRadius.md,
      marginRight: theme.spacing.sm,
      alignItems: 'center',
    },
    confirmButton: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.primaryAction,
      borderRadius: theme.borderRadius.md,
      marginLeft: theme.spacing.sm,
      alignItems: 'center',
    },
    cancelText: {
      color: theme.colors.mainText,
    },
    buttonText: {
      color: theme.colors.white,
      fontSize: 14,
      fontWeight: '600' as const,
    },
  });

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
            <Text style={[styles.buttonText, styles.cancelText]}>{cancelText}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmButton} onPress={onConfirm}>
            <Text style={styles.buttonText}>{confirmText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};