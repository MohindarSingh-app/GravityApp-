import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../../components/AppButton';
import { AppHeader, goBackOrHome } from '../../components/AppHeader';
import { registerThemeStyles, theme } from '../../components/theme';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import { apiService } from '../../services/api';

interface MaskedCallScreenProps {
  route: { params: { jobId: number; job?: any } };
  navigation: any;
}

/**
 * Masked call interstitial (GAP-01).
 * Matches the HTML reference "Customer Call (Masked)" screen: the partner can
 * place a call to the customer without ever seeing the real phone number.
 * The backend resolves the masked session; the dialer opens with the
 * masked-routing number returned by the API.
 */
export const MaskedCallScreen: React.FC<MaskedCallScreenProps> = ({ route, navigation }) => {
  const { colors } = useUserPreferences();
  const job = route.params.job;
  const jobId = route.params.jobId || job?.id;
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [calling, setCalling] = useState(false);
  const [maskedDisplay, setMaskedDisplay] = useState(job?.customerPhoneMasked || '');

  const startMaskedCall = async () => {
    if (!jobId) {
      setError('Job details are missing. Open this job from your jobs list again.');
      return;
    }
    setWorking(true);
    setError('');
    try {
      const response = await apiService.requestMaskedCall(jobId);
      const dialNumber: string | undefined = response.data?.dialNumber;
      if (!dialNumber) {
        setError('Masked calling is not available for this job. Contact dispatch for assistance.');
        return;
      }
      if (response.data?.customerPhoneMasked) {
        setMaskedDisplay(response.data.customerPhoneMasked);
      }
      setCalling(true);
      try {
        await Linking.openURL(`tel:${dialNumber}`);
      } catch {
        setError('Could not open the phone dialer on this device.');
      }
    } catch (callError: any) {
      setError(callError.response?.data?.message || 'Masked calling is not configured. Contact dispatch for assistance.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Customer Call (Masked)" subtitle={job?.referenceId || (jobId ? `Job #${jobId}` : undefined)} onBack={() => goBackOrHome(navigation)} />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.ringWrap}>
            <Text style={styles.phoneIcon}>☎</Text>
          </View>
          <Text style={styles.heroTitle}>Protected calling session</Text>
          <Text style={styles.heroCopy}>
            Zypli connects you to {job?.customerName || 'the customer'} through a masked number. Neither side sees the other's real phone number.
          </Text>
        </View>

        <View style={styles.factsCard}>
          <View style={[styles.factRow, styles.lastFactRow]}>
            <Text style={styles.factLabel}>Customer</Text>
            <Text style={styles.factValue}>{job?.customerName || 'Not provided'}</Text>
          </View>
          <View style={[styles.factRow, styles.lastFactRow]}>
            <Text style={styles.factLabel}>Dial as</Text>
            <Text style={styles.factValue}>{maskedDisplay || 'Assigned at call time'}</Text>
          </View>
          <View style={[styles.factRow, styles.lastFactRow]}>
            <Text style={styles.factLabel}>Purpose</Text>
            <Text style={styles.factValue}>{job?.title || job?.equipment || 'Service visit'}</Text>
          </View>
        </View>

        <View style={styles.privacyCard}>
          <Text style={styles.privacyIcon}>i</Text>
          <Text style={styles.privacyText}>
            Calls are recorded for quality where permitted. Do not share personal contact details during the call; use the app for updates.
          </Text>
        </View>

        {calling ? (
          <View style={styles.activeCard}>
            <Text style={styles.activeTitle}>Dialer opened</Text>
            <Text style={styles.activeCopy}>Return here after the call ends. Log any agreed changes in the job workflow.</Text>
          </View>
        ) : null}

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

        <AppButton
          title={calling ? 'Call again' : 'Start masked call'}
          onPress={startMaskedCall}
          loading={working}
          disabled={!jobId}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const build_styles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  page: { padding: theme.spacing.md, paddingBottom: 48 },
  heroCard: { backgroundColor: theme.colors.primaryLight, borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, alignItems: 'center', marginBottom: theme.spacing.md },
  ringWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.primaryAction, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.sm },
  phoneIcon: { color: theme.colors.white, fontSize: 26, fontWeight: '800' },
  heroTitle: { color: theme.colors.brandInk, fontSize: 15, fontWeight: '800' },
  heroCopy: { color: theme.colors.brandInk, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  factsCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.md },
  factRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  lastFactRow: { borderBottomWidth: 0 },
  factLabel: { color: theme.colors.secondaryText, fontSize: 12 },
  factValue: { flex: 1, color: theme.colors.mainText, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  privacyCard: { flexDirection: 'row', gap: 8, backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  privacyIcon: { color: theme.colors.brandInk, fontWeight: '800' },
  privacyText: { flex: 1, color: theme.colors.secondaryText, fontSize: 11, lineHeight: 16 },
  activeCard: { backgroundColor: theme.colors.success, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  activeTitle: { color: theme.colors.white, fontSize: 13, fontWeight: '800' },
  activeCopy: { color: theme.colors.white, fontSize: 12, lineHeight: 17, marginTop: 4 },
  error: { color: theme.colors.error, fontSize: 12, marginBottom: theme.spacing.sm },
});

let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
