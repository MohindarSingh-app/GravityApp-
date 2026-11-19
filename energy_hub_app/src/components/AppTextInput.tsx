import React, { useState } from 'react';
import { StyleSheet, TextInput, View, Text, TextInputProps } from 'react-native';
import { theme } from './theme';
import { useUserPreferences } from '../providers/UserPreferencesProvider';

interface AppTextInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  maxLength?: number;
  styleOverride?: TextInputProps['style'];
  multiline?: boolean;
  isFocused?: boolean;
}

export const AppTextInput: React.FC<AppTextInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  keyboardType,
  autoCapitalize = 'sentences',
  maxLength,
  styleOverride,
  multiline = false,
  isFocused = false,
}) => {
  const { colors } = useUserPreferences();
  const [focused, setFocused] = useState(false);
  const hasError = !!error;
  const styles = StyleSheet.create({
    container: {
      marginBottom: theme.spacing.md,
    },
    label: {
      color: hasError ? theme.colors.error : theme.colors.textSecondary,
      fontSize: theme.typography.captionMedium.fontSize,
      fontWeight: theme.typography.captionMedium.fontWeight,
      marginBottom: theme.spacing.xs,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: hasError ? theme.colors.error : colors.border,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      color: colors.text,
      fontSize: theme.typography.bodyMedium.fontSize,
      minHeight: 50,
    },
    inputFocused: {
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    error: {
      color: theme.colors.error,
      fontSize: theme.typography.captionSmall.fontSize,
      marginTop: theme.spacing.xs,
      marginLeft: 4,
    },
  });

  return (
    <View style={styles.container}>
      {!!label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          (isFocused || focused) && styles.inputFocused,
          hasError && { borderColor: theme.colors.error },
          styleOverride,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textTertiary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};