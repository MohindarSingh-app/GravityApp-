import React from 'react';
import { theme } from './theme';
import { AppTextInput } from './AppTextInput';

interface EmailInputProps {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
}

export const EmailInput: React.FC<EmailInputProps> = ({
  value,
  onChangeText,
  error,
}) => {
  return (
    <AppTextInput
      label="Email Address"
      value={value}
      onChangeText={onChangeText}
      placeholder="Enter email address"
      keyboardType="email-address"
      autoCapitalize="none"
      error={error}
    />
  );
};