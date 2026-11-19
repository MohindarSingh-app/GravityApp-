import { useUserPreferences } from '../providers/UserPreferencesProvider';
import React from 'react';
import { StyleSheet, View, Text, TextInput } from 'react-native';
import { registerThemeStyles, theme } from './theme';

interface PhoneNumberInputProps {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
}

export const PhoneNumberInput: React.FC<PhoneNumberInputProps> = ({
  value,
  onChangeText,
  error,
}) => {
  useUserPreferences();

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Mobile Number</Text>
      <View style={[styles.row, error ? styles.rowError : null]}>
        <View style={styles.countryCode}>
          <Text style={styles.countryCodeText}>+91</Text>
        </View>
        <TextInput
          accessibilityLabel="Mobile Number"
          style={styles.input}
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, 10))}
          placeholder="10-digit mobile number"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="phone-pad"
          maxLength={10}
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const build_styles = () => StyleSheet.create({
  container: { marginBottom: theme.spacing.md },
  label: { color: theme.colors.mainText, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    minHeight: 54,
    overflow: 'hidden',
  },
  rowError: { borderColor: theme.colors.error },
  countryCode: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  countryCodeText: { color: theme.colors.brandInk, fontSize: 15, fontWeight: '700' },
  input: { flex: 1, minHeight: 54, paddingHorizontal: 14, color: theme.colors.mainText, fontSize: 16 },
  error: { color: theme.colors.error, fontSize: 12, marginTop: 5, marginLeft: 2 },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
