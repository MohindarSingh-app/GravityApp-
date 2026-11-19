import { useUserPreferences } from '../providers/UserPreferencesProvider';
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable } from 'react-native';
import { registerThemeStyles, theme } from './theme';

interface OtpInputProps {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  length?: number;
}

export const OtpInput: React.FC<OtpInputProps> = ({
  value,
  onChangeText,
  error,
  length = 6,
}) => {
  useUserPreferences();

  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const inputRef = useRef<any>(null);

  useEffect(() => {
    const next = value.replace(/\D/g, '').slice(0, length).split('');
    const padded = Array(length).fill('');
    next.forEach((d, i) => (padded[i] = d));
    setDigits(padded);
  }, [value, length]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>OTP Verification</Text>
      <Pressable onPress={() => inputRef.current?.focus()}>
        <View style={styles.boxes}>
          {digits.map((digit, index) => (
            <View
              key={index}
              style={[
                styles.box,
                digit ? styles.boxFilled : null,
                error ? styles.boxError : null,
              ]}
            >
              <Text style={styles.digit}>{digit}</Text>
            </View>
          ))}
        </View>
      </Pressable>
      <TextInput
        ref={inputRef}
        accessibilityLabel="One-time password"
        style={styles.hiddenInput}
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        maxLength={length}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const build_styles = () => StyleSheet.create({
  container: { marginBottom: theme.spacing.md },
  label: { color: theme.colors.mainText, fontSize: 13, fontWeight: '700', marginBottom: theme.spacing.sm },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  box: {
    flex: 1,
    maxWidth: 54,
    aspectRatio: 0.92,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: theme.colors.primaryAction, borderWidth: 1.5, backgroundColor: theme.colors.primaryLight },
  boxError: { borderColor: theme.colors.error },
  digit: { color: theme.colors.mainText, fontSize: 22, fontWeight: '700' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 54, width: '100%' },
  error: { color: theme.colors.error, fontSize: 12, marginTop: theme.spacing.xs, marginLeft: 2 },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
