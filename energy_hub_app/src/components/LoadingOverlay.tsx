import { useUserPreferences } from '../providers/UserPreferencesProvider';
import React from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { theme } from './theme';

interface LoadingOverlayProps {
  visible: boolean;
  text?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  text = 'Loading...',
}) => {
  useUserPreferences();

  const styles = StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(18, 35, 46, 0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    container: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.lg,
      alignItems: 'center',
      minWidth: 200,
      ...theme.elevation.raised,
    },
    loadingText: {
      color: theme.colors.mainText,
      fontSize: 15,
      marginTop: theme.spacing.md,
    },
  });

  if (!visible) return null;

  return (
    <View style={styles.overlay}>
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primaryAction} />
        <Text style={styles.loadingText}>{text}</Text>
      </View>
    </View>
  );
};