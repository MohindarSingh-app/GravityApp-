import { useUserPreferences } from '../providers/UserPreferencesProvider';
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { theme } from './theme';

interface FileUploadProgressProps {
  progress: number;
  fileName: string;
}

export const FileUploadProgress: React.FC<FileUploadProgressProps> = ({
  progress,
  fileName,
}) => {
  useUserPreferences();

  const styles = StyleSheet.create({
    container: {
      marginVertical: theme.spacing.sm,
    },
    fileName: {
      color: theme.colors.mainText,
      fontSize: 12,
      marginBottom: theme.spacing.xs,
    },
    barContainer: {
      width: '100%',
      height: 6,
      backgroundColor: theme.colors.secondaryText,
      borderRadius: 3,
      overflow: 'hidden',
    },
    barFill: {
      height: 6,
      backgroundColor: theme.colors.primaryAction,
      borderRadius: 3,
    },
    percent: {
      color: theme.colors.primaryAction,
      fontSize: 12,
      fontWeight: '600' as const,
      marginTop: theme.spacing.xs,
      alignSelf: 'flex-end',
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.fileName}>{fileName}</Text>
      <View style={styles.barContainer}>
        <View style={[styles.barFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.percent}>{Math.round(progress)}%</Text>
    </View>
  );
};