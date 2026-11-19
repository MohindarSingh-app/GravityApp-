import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../providers/AuthProvider';
import { apiService } from '../../services/api';
import { theme } from '../../components/theme';
import { AuthHero } from '../../components/AuthHero';
import { AppButton } from '../../components/AppButton';
import { OtpInput } from '../../components/OtpInput';
import { ErrorMessage } from '../../components/ErrorMessage';
import { LoadingOverlay } from '../../components/LoadingOverlay';

interface OtpScreenProps {
  route: { params: { mobile: string; purpose: 'login' | 'registration'; devOtp?: string } };
  navigation: any;
}

export const OtpScreen: React.FC<OtpScreenProps> = ({ route, navigation }) => {
  useUserPreferences();

  const { mobile, purpose } = route.params;
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const { login } = useAuth();

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const handleVerifyOtp = async () => {
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');
    setErrorMessage(null);

    try {
      const response = await apiService.verifyOtp(mobile, cleanOtp, purpose);

      if (!response || !response.success) {
        setError(response?.message || 'OTP verification failed');
        return;
      }

      const { token, refreshToken, user, requiresRegistration, registrationId, requiresRoleSelection, roleSelectionToken, availableRoles } = response.data || {};

      if (requiresRoleSelection && roleSelectionToken && Array.isArray(availableRoles) && availableRoles.length) {
        navigation.replace('RoleSelect', {
          mobile,
          roleSelectionToken,
          roles: availableRoles,
        });
        return;
      }

      if (!token || !user) {
        setError('Invalid response from server');
        return;
      }

      await login(token, {
        id: user.id,
        mobile: user.mobile || mobile,
        email: user.email,
        role: user.role,
        status: user.status,
        token,
        refreshToken: refreshToken || '',
      });

      if (requiresRegistration) {
        navigation.replace('PersonalInfo', {
          registrationId: String(registrationId),
          mobile,
          email: user.email,
        });
      } else if (user.role !== 'admin' && user.status !== 'approved') {
        navigation.replace('Status', {
          registrationId: String(registrationId ?? ''),
          status: user.status || 'under_review',
        });
      } else {
        navigation.replace(user.role === 'admin' ? 'AdminSchedule' : 'Home');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setLoading(true);
    try {
      const response = await apiService.loginRequestOtp(mobile, purpose);
      if (response.success) {
        setResendTimer(30);
        setCanResend(false);
      } else {
        setError(response.message || 'Failed to resend OTP');
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.primaryBackground,
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
      maxWidth: 520,
      alignSelf: 'center',
      ...theme.elevation.card,
    },
    title: {
      color: theme.colors.mainText,
      fontSize: 26,
      fontWeight: 'bold' as const,
      textAlign: 'center',
      marginBottom: theme.spacing.sm,
    },
    subtitle: {
      color: theme.colors.secondaryText,
      fontSize: 15,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
    mobileText: {
      color: theme.colors.brandInk,
      fontSize: 16,
      fontWeight: '800' as const,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
    resendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: theme.spacing.md,
    },
    resendText: {
      color: theme.colors.secondaryText,
      fontSize: 14,
    },
    resendLink: {
      color: theme.colors.primaryAction,
      fontSize: 14,
      fontWeight: '600' as const,
      marginLeft: theme.spacing.xs,
    },
    developmentOtp: {
      color: theme.colors.warningDark,
      backgroundColor: theme.colors.warningLight,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.md,
      textAlign: 'center' as const,
      fontWeight: '700' as const,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LoadingOverlay visible={loading} text="Verifying OTP..." />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.scrollContent} contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AuthHero title="Secure sign-in" subtitle={`Enter the 6-digit verification code sent to ${mobile}.`} />
          <View style={styles.card}>
            <Text style={styles.title}>OTP Verification</Text>
            <Text style={styles.subtitle}>
              We've sent a code to {mobile}
            </Text>
            <Text style={styles.mobileText}>{mobile}</Text>
            {__DEV__ && route.params.devOtp ? (
              <Text style={styles.developmentOtp}>Development OTP: {route.params.devOtp}</Text>
            ) : null}
            <OtpInput
              value={otp}
              onChangeText={setOtp}
              error={error}
            />
            {errorMessage && <ErrorMessage message={errorMessage} />}
            <AppButton
              title="Verify & Continue"
              onPress={handleVerifyOtp}
              loading={loading}
            />
            <View style={styles.resendRow}>
              <Text style={styles.resendText}>
                {canResend ? "Didn't receive OTP? " : `Resend in ${resendTimer}s `}
              </Text>
              {canResend && (
                <TouchableOpacity onPress={handleResendOtp}>
                  <Text style={styles.resendLink}>Resend OTP</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};