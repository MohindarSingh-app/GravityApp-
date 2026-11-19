import React from 'react';
import { StyleSheet, TouchableOpacity, Text, View, ActivityIndicator } from 'react-native';
import { theme } from './theme';
import { useUserPreferences } from '../providers/UserPreferencesProvider';

interface AppButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  disabled?: boolean;
  style?: any;
  fullWidth?: boolean;
}

export const AppButton: React.FC<AppButtonProps> = ({
  title,
  onPress,
  loading = false,
  variant = 'primary',
  disabled = false,
  style,
  fullWidth = false,
}) => {
  const { colors } = useUserPreferences();
  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadius.md,
      paddingVertical: 15,
      minHeight: 54,
    },
    fullWidth: {
      width: '100%',
    },
    primary: {
      backgroundColor: colors.primary,
      ...theme.elevation.low,
    },
    secondary: {
      backgroundColor: theme.colors.accent,
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.primary,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    disabled: {
      opacity: theme.interaction.disabledOpacity,
    },
    title: {
      color: theme.colors.textInverse,
      fontSize: theme.typography.buttonMedium.fontSize,
      fontWeight: theme.typography.buttonMedium.fontWeight,
    },
    titleSecondary: {
      color: theme.colors.primaryDark,
    },
    titleOutline: {
      color: colors.primary,
    },
    titleGhost: {
      color: colors.primary,
    },
    loader: {
      marginRight: 8,
    },
  });

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return { container: styles.secondary, title: styles.titleSecondary };
      case 'outline':
        return { container: styles.outline, title: styles.titleOutline };
      case 'ghost':
        return { container: styles.ghost, title: styles.titleGhost };
      default:
        return { container: styles.primary, title: styles.title };
    }
  };

  const variantStyle = getVariantStyles();
  const isDisabled = loading || disabled;

  if (loading) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: isDisabled, busy: true }}
        style={[styles.container, fullWidth && styles.fullWidth, variantStyle.container, disabled && styles.disabled, style]}
        onPress={onPress}
        disabled={isDisabled}
      >
        <ActivityIndicator size="small" color={theme.colors.textInverse} style={styles.loader} />
        <Text style={[variantStyle.title, { color: theme.colors.textInverse }]}>{title}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled }}
      style={[styles.container, fullWidth && styles.fullWidth, variantStyle.container, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={theme.interaction.pressedOpacity}
    >
      <Text style={variantStyle.title}>{title}</Text>
    </TouchableOpacity>
  );
};