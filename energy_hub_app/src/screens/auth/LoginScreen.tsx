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
import { ErrorMessage } from '../../components/ErrorMessage';
import { LoadingOverlay } from '../../components/LoadingOverlay';

interface LoginScreenProps {
  navigation: any;
}

const DEMO_ACCOUNTS = [
  { label: 'All roles', mobile: '9811100001' },
  { label: 'Service Partner', mobile: '9000000099' },
  { label: 'Repairing Partner', mobile: '9000000098' },
  { label: 'Panel Maker', mobile: '9000000097' },
  { label: 'Supplier', mobile: '9000000096' },
] as const;

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  useUserPreferences();

  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { login } = useAuth();

  const handleSendOtp = async () => {
    if (!mobile || mobile.length < 10) {
      setError('Please enter a valid mobile number');
      return;
    }

    setLoading(true);
    setError('');
    setErrorMessage(null);

    try {
      const response = await apiService.loginRequestOtp(mobile);
      if (response.success) {
        navigation.navigate('Otp', {
          mobile,
          purpose: 'login',
          ...(__DEV__ && response.data?.devOtp ? { devOtp: response.data.devOtp } : {}),
        });
      } else {
        setError(response.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.authCanvas,
    },
    scrollContent: {
      flex: 1,
      paddingBottom: theme.spacing.lg,
    },
    card: {
      backgroundColor: theme.colors.mainCard,
      borderRadius: 24,
      padding: theme.spacing.xl,
      marginHorizontal: theme.spacing.md,
      marginTop: -18,
      width: 'auto',
      maxWidth: 560,
      alignSelf: 'center',
      ...theme.elevation.card,
    },
    welcomeText: {
      color: theme.colors.mainText,
      fontSize: 24,
      fontWeight: 'bold' as const,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      color: theme.colors.secondaryText,
      fontSize: 15,
      textAlign: 'center',
      marginBottom: theme.spacing.xl,
    },
    registerRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      marginTop: theme.spacing.lg,
    },
    registerText: {
      color: theme.colors.secondaryText,
      fontSize: 14,
    },
    registerLink: {
      color: theme.colors.primaryAction,
      fontSize: 14,
      fontWeight: '600' as const,
      marginLeft: theme.spacing.xs,
    },
    hint: {
      color: theme.colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginTop: theme.spacing.md,
    },
    demoSection: {
      marginTop: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    demoTitle: {
      color: theme.colors.secondaryText,
      fontSize: 12,
      fontWeight: '700' as const,
      textAlign: 'center' as const,
    },
    demoAccounts: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      justifyContent: 'center' as const,
      gap: theme.spacing.xs,
    },
    demoAccount: {
      borderColor: theme.colors.border,
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      backgroundColor: theme.colors.primaryBackground,
    },
    demoAccountSelected: {
      borderColor: theme.colors.primaryAction,
      backgroundColor: theme.colors.mainCard,
    },
    demoAccountText: {
      color: theme.colors.secondaryText,
      fontSize: 11,
      fontWeight: '600' as const,
    },
    demoAccountTextSelected: {
      color: theme.colors.primaryAction,
    },
    trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 18 },
    trustText: { color: theme.colors.secondaryText, fontSize: 12, fontWeight: '600' as const },
    registerCard: { backgroundColor: '#EAF1FF', borderRadius: 18, padding: 16, marginHorizontal: 20, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: 'auto', maxWidth: 560, alignSelf: 'center' },
    registerCopy: { flex: 1, paddingRight: 12 },
    registerTitle: { color: theme.colors.mainText, fontSize: 14, fontWeight: '700' as const },
    registerSubtitle: { color: theme.colors.secondaryText, fontSize: 12, marginTop: 4 },
    registerButton: { backgroundColor: theme.colors.mainCard, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LoadingOverlay visible={loading} text="Sending OTP..." />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.scrollContent} contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthHero title="Make every field visit count" subtitle="Sign in to manage matched work, service visits and payouts." />
          <View style={styles.card}>
            <Text style={styles.welcomeText}>Login</Text>
            <Text style={styles.subtitle}>
              Enter your registered mobile number to receive an OTP
            </Text>
            <PhoneNumberInput
              value={mobile}
              onChangeText={setMobile}
              error={error}
            />
            {errorMessage && <ErrorMessage message={errorMessage} />}
            <AppButton
              title="Send OTP"
              onPress={handleSendOtp}
              loading={loading}
            />
            {__DEV__ ? (
              <View style={styles.demoSection}>
                <Text style={styles.demoTitle}>Choose a demo account</Text>
                <View style={styles.demoAccounts}>
                  {DEMO_ACCOUNTS.map((account) => (
                    <TouchableOpacity
                      key={account.mobile}
                      accessibilityRole="button"
                      accessibilityLabel={`${account.label}, ${account.mobile}`}
                      onPress={() => {
                        setMobile(account.mobile);
                        setError('');
                        setErrorMessage(null);
                      }}
                      style={[
                        styles.demoAccount,
                        mobile === account.mobile && styles.demoAccountSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.demoAccountText,
                          mobile === account.mobile && styles.demoAccountTextSelected,
                        ]}
                      >
                        {account.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.hint}>
                  Select an account, tap Send OTP, then use the development code shown on the next screen.
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.trustRow}>
            <Ionicons name="shield-checkmark" size={15} color="#087747" />
            <Text style={styles.trustText}>Secure OTP login · one mobile account</Text>
          </View>
          <View style={styles.registerCard}>
            <View style={styles.registerCopy}>
              <Text style={styles.registerTitle}>New to EnergyHub?</Text>
              <Text style={styles.registerSubtitle}>Create your account and choose a partner role.</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('Register')} style={styles.registerButton}>
              <Text style={styles.registerLink}>Register</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};