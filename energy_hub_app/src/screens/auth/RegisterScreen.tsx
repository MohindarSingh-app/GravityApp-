import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../providers/AuthProvider';
import { apiService } from '../../services/api';
import { theme } from '../../components/theme';
import { AuthHero } from '../../components/AuthHero';
import { AppButton } from '../../components/AppButton';
import { PhoneNumberInput } from '../../components/PhoneNumberInput';
import { EmailInput } from '../../components/EmailInput';
import { OtpInput } from '../../components/OtpInput';
import { ErrorMessage } from '../../components/ErrorMessage';
import { LoadingOverlay } from '../../components/LoadingOverlay';

const PARTNER_ROLES = [
  { value: 'service_partner', label: 'Service Partner', description: 'On-site installation, maintenance and delivery work', icon: 'construct-outline', tint: '#155EEF', soft: '#EAF1FF' },
  { value: 'repairing_partner', label: 'Repairing Partner', description: 'Workshop diagnosis and hardware repair', icon: 'build-outline', tint: '#0B8F70', soft: '#E4F7F1' },
  { value: 'panel_maker', label: 'Panel Maker', description: 'Panel design, fabrication and quality checks', icon: 'hardware-chip-outline', tint: '#7546C8', soft: '#F2EBFF' },
  { value: 'supplier', label: 'Supplier', description: 'Manage products, stock and marketplace listings', icon: 'storefront-outline', tint: '#E66B12', soft: '#FFF0DF' },
] as const;

interface RegisterScreenProps {
  route: { params?: { mobile?: string; email?: string; registrationId?: string } };
  navigation: any;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ route, navigation }) => {
  useUserPreferences();

  const [step, setStep] = useState<'details' | 'otp' | 'done'>(
    route.params?.registrationId ? 'done' : 'details'
  );
  const [mobile, setMobile] = useState(route.params?.mobile || '');
  const [email, setEmail] = useState(route.params?.email || '');
  const [selectedRole, setSelectedRole] = useState<(typeof PARTNER_ROLES)[number]['value']>('service_partner');
  const [registrationId, setRegistrationId] = useState(route.params?.registrationId || '');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState('');

  const { login } = useAuth();

  const handleRegisterStart = async () => {
    if (!mobile || mobile.length < 10) {
      setError('Please enter a valid mobile number');
      return;
    }
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    setLoading(true);
    setError('');
    setErrorMessage(null);
    try {
      const response = await apiService.registerStart(mobile, email, selectedRole);
      if (response.success && response.data) {
        setRegistrationId(String(response.data.id));
        setDevOtp(response.data.devOtp || '');
        setStep('otp');
      } else {
        setError(response.message || 'Registration start failed');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length < 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }
    setLoading(true);
    setError('');
    setErrorMessage(null);
    try {
      const response = await apiService.verifyOtp(mobile, otp, 'registration');
      if (!response || !response.success) {
        setError(response?.message || 'OTP verification failed');
        return;
      }
      const result = response.data;
      if (!result?.token || !result.user) {
        setError('Invalid response from server');
        return;
      }
      const { token, refreshToken, user, registrationId: verifiedRegistrationId, requiresRegistration } = result;
      const resolvedRegistrationId = verifiedRegistrationId || registrationId;
      if (!resolvedRegistrationId && requiresRegistration) {
        setError('Your registration could not be found. Please start again.');
        return;
      }
      await login(token, {
        id: user.id,
        mobile: user.mobile,
        email: user.email || email,
        role: user.role,
        status: user.status,
        token,
        refreshToken,
      });
      if (requiresRegistration && resolvedRegistrationId) {
        navigation.replace('PersonalInfo', {
          registrationId: String(resolvedRegistrationId),
          mobile,
          email: user.email || email,
          partnerRole: selectedRole,
        });
      } else {
        navigation.replace(
          user.status === 'approved' ? 'Home' : 'Status',
          { registrationId: String(verifiedRegistrationId || ''), status: user.status || 'under_review' }
        );
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.authCanvas },
    scrollContent: { flex: 1, paddingBottom: theme.spacing.lg },
    card: {
      backgroundColor: theme.colors.mainCard,
      borderRadius: 24,
      padding: theme.spacing.xl,
      marginHorizontal: theme.spacing.md,
      marginTop: -18,
      maxWidth: 620,
      alignSelf: 'center',
      ...theme.elevation.card,
    },
    title: { color: theme.colors.mainText, fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: theme.spacing.sm },
    subtitle: { color: theme.colors.secondaryText, fontSize: 15, textAlign: 'center', marginBottom: theme.spacing.lg },
    loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.lg },
    loginText: { color: theme.colors.secondaryText, fontSize: 14 },
    loginLink: { color: theme.colors.primaryAction, fontSize: 14, fontWeight: '600', marginLeft: theme.spacing.xs },
    formLabel: { color: theme.colors.mainText, fontSize: 14, fontWeight: '700', marginBottom: 10, marginTop: 4 },
    roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
    roleCard: { width: '48%', minHeight: 98, borderWidth: 1.5, borderRadius: 16, padding: 12 },
    roleCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    roleName: { fontSize: 12, fontWeight: '700', marginTop: 8 },
    roleDescription: { color: theme.colors.secondaryText, fontSize: 10, lineHeight: 14, marginTop: 4 },
    accountNote: { backgroundColor: '#EEF5FF', borderRadius: 14, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 16 },
    accountNoteText: { flex: 1, color: '#385577', fontSize: 12, lineHeight: 18 },
    progressRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
    progressDot: { height: 5, flex: 1, borderRadius: 99, backgroundColor: '#DCE5F0' },
  });

  const renderStep = () => {
    if (step === 'details') {
      return (
        <>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Use one verified mobile number to build your partner profile.</Text>
          <View style={styles.accountNote}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#155EEF" />
            <Text style={styles.accountNoteText}>Your mobile number is your secure account ID. If you add another partner role later, verify the same number again.</Text>
          </View>
          <Text style={styles.formLabel}>Choose your first partner role</Text>
          <View style={styles.roleGrid}>
            {PARTNER_ROLES.map((role) => {
              const selected = selectedRole === role.value;
              return (
                <TouchableOpacity
                  key={role.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setSelectedRole(role.value)}
                  style={[styles.roleCard, { borderColor: selected ? role.tint : theme.colors.border, backgroundColor: selected ? role.soft : theme.colors.mainCard }]}
                >
                  <View style={styles.roleCardTop}>
                    <Ionicons name={role.icon} size={20} color={role.tint} />
                    {selected ? <Ionicons name="checkmark-circle" size={18} color={role.tint} /> : null}
                  </View>
                  <Text style={[styles.roleName, { color: selected ? role.tint : theme.colors.mainText }]}>{role.label}</Text>
                  <Text style={styles.roleDescription}>{role.description}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <PhoneNumberInput value={mobile} onChangeText={setMobile} error={error} />
          <EmailInput value={email} onChangeText={setEmail} error={error} />
          <AppButton title="Verify mobile & continue" onPress={handleRegisterStart} loading={loading} />
        </>
      );
    }
    if (step === 'done') {
      return (
        <>
          <Text style={styles.title}>Mobile Verified</Text>
          <Text style={styles.subtitle}>
            Your mobile number has been verified. Continue to complete your partner profile.
          </Text>
          <AppButton
            title="Continue to Profile"
            onPress={() =>
              navigation.replace('PersonalInfo', {
                registrationId,
                mobile,
                email,
                partnerRole: selectedRole,
              })
            }
          />
        </>
      );
    }
    return (
      <>
        <Text style={styles.title}>Verify Mobile</Text>
        <Text style={styles.subtitle}>Enter the 6-digit OTP sent to {mobile}</Text>
        {__DEV__ && devOtp ? <Text style={styles.subtitle}>Development OTP: {devOtp}</Text> : null}
        <OtpInput value={otp} onChangeText={setOtp} error={error} />
        <AppButton title="Verify & Continue" onPress={handleVerifyOtp} loading={loading} />
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LoadingOverlay visible={loading} text="Processing..." />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.scrollContent} contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthHero
            title={step === 'otp' ? 'Verify your number' : 'Create your partner account'}
            subtitle={step === 'otp' ? `A verification code was sent to ${mobile}.` : 'A few details first, then set up your field profile.'}
          />
          <View style={styles.card}>
            {step !== 'done' ? (
              <View style={styles.progressRow}>
                {[0, 1, 2].map((item) => <View key={item} style={[styles.progressDot, { backgroundColor: (step === 'details' ? item === 0 : item <= 1) ? theme.colors.primary : theme.colors.border }]} />)}
              </View>
            ) : null}
            {renderStep()}
            {errorMessage && <ErrorMessage message={errorMessage} />}
          </View>
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>
              Already have an account?{' '}
              <TouchableOpacity onPress={() => navigation.replace('Login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
