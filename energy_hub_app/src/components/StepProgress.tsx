import { useUserPreferences } from '../providers/UserPreferencesProvider';
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { theme } from './theme';

interface StepProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}

export const StepProgress: React.FC<StepProgressProps> = ({
  currentStep,
  totalSteps,
  stepLabels,
}) => {
  useUserPreferences();

  const styles = StyleSheet.create({
    container: {
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.md,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: theme.spacing.xs,
    },
    stepText: {
      color: theme.colors.secondaryText,
      fontSize: 13,
      fontWeight: '600' as const,
    },
    progressContainer: {
      flexDirection: 'row',
      height: 4,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: 4,
      backgroundColor: theme.colors.primaryAction,
      borderRadius: 2,
    },
    stepsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    step: {
      alignItems: 'center',
    },
    stepCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
    },
    stepCircleActive: {
      backgroundColor: theme.colors.primaryAction,
      borderColor: theme.colors.primaryAction,
    },
    stepCircleCompleted: {
      backgroundColor: theme.colors.primaryLight,
      borderColor: theme.colors.primaryAction,
    },
    stepNumber: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: '600' as const,
    },
    stepNumberActive: {
      color: theme.colors.white,
    },
    stepNumberCompleted: {
      color: theme.colors.brandInk,
    },
    stepLabel: {
      fontSize: 10,
      color: theme.colors.textMuted,
      width: 52,
      textAlign: 'center',
    },
    stepLabelActive: {
      color: theme.colors.primaryAction,
      fontWeight: '600' as const,
    },
  });

  const progressWidth = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.stepText}>
          Step {currentStep} of {totalSteps}
        </Text>
      </View>
      <View style={styles.progressContainer}>
        <View style={[styles.progressFill, { width: `${progressWidth}%` }]} />
      </View>
      <View style={styles.stepsContainer}>
        {stepLabels.map((label, index) => {
          const isCompleted = index < currentStep - 1;
          const isActive = index === currentStep - 1;
          return (
            <View key={index} style={styles.step}>
              <View style={[
                styles.stepCircle,
                isCompleted && styles.stepCircleCompleted,
                isActive && styles.stepCircleActive,
              ]}>
                <Text style={[
                  styles.stepNumber,
                  isActive && styles.stepNumberActive,
                  isCompleted && styles.stepNumberCompleted,
                ]}>{index + 1}</Text>
              </View>
              <Text style={[
                styles.stepLabel,
                isActive && styles.stepLabelActive,
              ]}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};