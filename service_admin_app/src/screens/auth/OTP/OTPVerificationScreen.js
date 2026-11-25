import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../theme/ThemeContext';
import { otpFailureMessage, retryAfterSeconds } from '../../../utils/errors';
import { validateOtp } from '../../../utils/validators';

export function OTPVerificationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { verifyOtp, sendOtp } = useAuth();
  const { colors, radius, type } = useTheme();
  const hiddenRef = useRef(null);
  const params = route.params || {};
  const identifier = params.email || params.phone || '';
  const purpose = params.purpose || 'login';
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(route.params && route.params.expiresIn ? route.params.expiresIn : 300);
  const [cooldown, setCooldown] = useState(route.params && route.params.cooldownSeconds ? route.params.cooldownSeconds : 0);
  const [developmentOtp, setDevelopmentOtp] = useState(route.params && route.params.devOtp ? route.params.devOtp : '');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
      setCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function onVerify() {
    if (loading) return;
    Keyboard.dismiss();
    if (!identifier) {
      setError('Enter your phone number first.');
      return;
    }
    const otp = String(code || '').replace(/\D/g, '');
    const otpError = validateOtp(otp);
    if (otpError) {
      setError(otpError);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await verifyOtp({
        ...(params.email ? { email: params.email } : { phone: params.phone }),
        purpose,
        ...(params.fullName ? { fullName: params.fullName } : {}),
        otp,
      }, { newCompanyRegistration: Boolean(params.newCompanyRegistration) });
      if (result && result.approvalRequired) setNotice(result.message || 'Your registration is awaiting Superadmin approval.');
    } catch (err) {
      setError(otpFailureMessage(err, secondsLeft === 0));
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    if (!identifier || cooldown > 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await sendOtp({
        ...(params.email ? { email: params.email } : { phone: params.phone }),
        purpose,
        ...(params.fullName ? { fullName: params.fullName } : {}),
      });
      setSecondsLeft(result.expiresIn || 300);
      setCooldown(result.cooldownSeconds || 30);
      setDevelopmentOtp(result.devOtp || '');
      setCode('');
    } catch (err) {
      const wait = retryAfterSeconds(err);
      if (wait) setCooldown(wait);
      setError(otpFailureMessage(err, false));
    } finally {
      setLoading(false);
    }
  }

  const expired = secondsLeft === 0;
  const digits = Array.from({ length: 6 }, (_item, index) => code[index] || '');
  const displayId = params.phone ? `+91 ${String(params.phone).replace(/\D/g, '').slice(-10)}` : identifier;

  return (
    <Screen
      header={<AppBar title="Verify OTP" onBack={() => navigation.goBack()} />}
      footer={(
        <Button
          title="Verify & Continue ›"
          loadingLabel="Verifying..."
          onPress={onVerify}
          loading={loading}
          disabled={!identifier}
        />
      )}
    >
      <Text style={type.display} accessibilityRole="header">Enter OTP</Text>
      <Text style={type.muted}>{identifier ? `Sent to ${displayId}` : 'Go back and enter your email or phone number.'}</Text>
      {__DEV__ && developmentOtp ? (
        <Text style={[type.small, styles.center, { color: colors.accentText }]}>Development OTP: {developmentOtp}</Text>
      ) : null}
      {notice ? <Banner message={notice} /> : null}

      <Pressable onPress={() => hiddenRef.current && hiddenRef.current.focus()} accessibilityLabel="Enter 6-digit verification code">
        <View style={styles.cells} pointerEvents="none">
          {digits.map((digit, index) => (
            <View
              key={index}
              style={[
                styles.cell,
                {
                  borderColor: digit || code.length === index ? colors.primary : colors.borderStrong,
                  backgroundColor: digit ? colors.primaryLight : colors.surface,
                  borderRadius: radius.input,
                },
              ]}
            >
              <Text style={[type.title, { color: colors.text }]}>{digit}</Text>
            </View>
          ))}
        </View>
      </Pressable>
      <TextInput
        ref={hiddenRef}
        value={code}
        onChangeText={(value) => setCode(String(value || '').replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        caretHidden
        style={styles.hidden}
        accessibilityLabel="OTP"
      />

      <Text style={[type.muted, styles.center, { color: expired ? colors.danger : colors.muted }]}>
        {expired ? 'This code has expired.' : cooldown > 0 ? `Resend in ${cooldown}s` : 'You can resend now'}
      </Text>
      <Banner message={error} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Resend OTP"
        disabled={cooldown > 0 || !identifier || loading}
        onPress={onResend}
        style={styles.linkHit}
      >
        <Text style={[styles.emphasis, { color: cooldown > 0 ? colors.muted : colors.accentText }]}>
          {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cells: {
    flexDirection: 'row',
    gap: 8,
  },
  cell: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  linkHit: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emphasis: {
    fontWeight: '700',
    textAlign: 'center',
  },
  center: {
    textAlign: 'center',
  },
});
