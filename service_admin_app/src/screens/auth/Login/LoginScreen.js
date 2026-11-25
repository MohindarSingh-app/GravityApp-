import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AuthSwitch } from '../../../components/AuthCanvas';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { TextField } from '../../../components/TextField';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { parseAuthIdentifier } from '../../../utils/authIdentifier';

export function LoginScreen() {
  const navigation = useNavigation();
  const { sendOtp } = useAuth();
  const { colors, type } = useTheme();
  const [identifierType, setIdentifierType] = useState('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const identifier = identifierType === 'email' ? email : phone;
  const setIdentifier = identifierType === 'email' ? setEmail : setPhone;
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (loading) return;
    Keyboard.dismiss();
    const parsed = parseAuthIdentifier(identifier);
    if (parsed.error) {
      setFieldError(parsed.error);
      setError('');
      return;
    }
    setLoading(true);
    setFieldError('');
    setError('');
    try {
      const result = await sendOtp({ ...parsed, purpose: 'login' });
      navigation.navigate('OTPVerification', {
        ...parsed,
        purpose: 'login',
        expiresIn: result.expiresIn || 300,
        cooldownSeconds: result.cooldownSeconds || 30,
        devOtp: result.devOtp,
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      header={<AppBar title="Sign in" onBack={() => navigation.goBack()} />}
      footer={(
        <Button title="Send OTP ›" loadingLabel="Sending OTP..." onPress={onSubmit} loading={loading} />
      )}
    >
      <Text style={type.display} accessibilityRole="header">
        {identifierType === 'email' ? 'Email address' : 'Mobile number'}
      </Text>
      <Text style={type.muted}>Verify with OTP — no password needed</Text>
      <TextField
        label={identifierType === 'email' ? 'Email address' : 'Phone number'}
        value={identifier}
        onChangeText={(value) => {
          setIdentifier(identifierType === 'email'
            ? value.slice(0, 255)
            : value.replace(/\D/g, '').slice(0, 10));
          setFieldError('');
        }}
        error={fieldError}
        placeholder={identifierType === 'email' ? 'you@company.com' : '10-digit mobile number'}
        hint={identifierType === 'email'
          ? 'Enter the email address registered to your account.'
          : 'Enter the mobile number registered to your account.'}
        left={identifierType === 'phone'
          ? <Text style={[styles.prefix, { color: colors.text }]}>+91</Text>
          : null}
        keyboardType={identifierType === 'email' ? 'email-address' : 'phone-pad'}
        autoComplete={identifierType === 'email' ? 'email' : 'tel'}
        textContentType={identifierType === 'email' ? 'emailAddress' : 'telephoneNumber'}
        autoCapitalize="none"
        returnKeyType="done"
        onSubmitEditing={onSubmit}
      />
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setIdentifierType(identifierType === 'phone' ? 'email' : 'phone');
          setFieldError('');
          setError('');
        }}
        style={styles.identifierSwitch}
      >
        <Text style={[styles.identifierSwitchText, { color: colors.accentText }]}>
          {identifierType === 'phone' ? 'Use email instead' : 'Use phone instead'}
        </Text>
      </Pressable>
      <Banner message={error} />
      <View style={styles.switch}>
        <AuthSwitch
          lead="Don't have an account?"
          action="Sign Up"
          onPress={() => navigation.navigate('Register')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  prefix: {
    fontWeight: '700',
    marginRight: 8,
  },
  switch: {
    marginTop: 8,
  },
  identifierSwitch: {
    alignSelf: 'flex-end',
    minHeight: 36,
    justifyContent: 'center',
  },
  identifierSwitchText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
