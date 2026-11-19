import React, { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../../components/AppButton';
import { AppHeader, goBackOrHome } from '../../components/AppHeader';
import { registerThemeStyles, theme } from '../../components/theme';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import { apiService } from '../../services/api';

type AcceptedJob = {
  id: number;
  referenceId?: string;
  title?: string;
  equipment?: string;
  jobType?: string;
  urgency?: string;
  customerName?: string;
  customerPhone?: string;
  customerPhoneMasked?: string;
  siteArea?: string;
  siteAddress?: string;
  brand?: string;
  equipmentModel?: string;
  description?: string;
  basePay?: number;
  serviceCharge?: number;
};

export const JobAcceptedScreen: React.FC<{
  navigation: any;
  route: { params: { jobId?: number; job?: AcceptedJob } };
}> = ({ navigation, route }) => {
  const { colors } = useUserPreferences();
  const job = route.params.job;
  const jobId = route.params.jobId || job?.id;
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const callCustomer = () => {
    navigation.navigate('MaskedCall', { jobId, job });
  };

  const navigateToSite = async () => {
    const address = [job?.siteAddress, job?.siteArea].filter(Boolean).join(', ');
    if (!address) {
      setError('A site address is not available for this job.');
      return;
    }
    try {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
    } catch {
      setError('Could not open maps on this device.');
    }
  };

  const checkIn = async () => {
    if (!jobId) {
      setError('Job details are missing. Return to your jobs list and open this job again.');
      return;
    }
    setWorking(true);
    setError('');
    try {
      const response = await apiService.checkIn(jobId);
      navigation.replace('JobDetail', { jobId, job: response.data || job });
    } catch (checkInError: any) {
      setError(checkInError.response?.data?.message || 'Could not check in to this job.');
    } finally {
      setWorking(false);
    }
  };

  const pay = Number(job?.basePay || job?.serviceCharge || 0);
  const facts = [
    ['Job ID', job?.referenceId || (jobId ? `#${jobId}` : 'Not available')],
    ['Service', job?.title || job?.equipment || 'Service request'],
    ['Type', job?.urgency || job?.jobType || 'Standard'],
    ['Customer', job?.customerName || 'Not provided'],
    ['Contact', job?.customerPhone || job?.customerPhoneMasked || 'Not provided'],
    ['Estimated pay', pay ? `₹${pay.toLocaleString('en-IN')}` : 'Not provided'],
  ];

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Job accepted" subtitle={job?.referenceId || (jobId ? `Job #${jobId}` : undefined)} onBack={() => goBackOrHome(navigation)} />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.successBanner}>
          <Text style={styles.bannerTitle}>✓ Job accepted</Text>
          <Text style={styles.bannerCopy}>This job is now assigned to you. Review the site details before travelling.</Text>
        </View>

        <View style={styles.factsCard}>
          {facts.map(([label, value], index) => (
            <View key={label} style={[styles.factRow, index === facts.length - 1 && styles.lastFactRow]}>
              <Text style={styles.factLabel}>{label}</Text>
              <Text style={styles.factValue}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.locationCard}>
          <View style={styles.mapPreview}>
            <Text style={styles.mapPin}>⌖</Text>
            <Text style={styles.mapHint}>Job location</Text>
          </View>
          <View style={styles.locationCopy}>
            <Text style={styles.siteTitle}>{job?.siteAddress || 'Site address not provided'}</Text>
            <Text style={styles.siteMeta}>{job?.siteArea || 'Area not provided'}</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.navigateButton} onPress={navigateToSite} accessibilityRole="button">
            <Text style={styles.navigateText}>Navigate</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.callButton} onPress={callCustomer} accessibilityRole="button">
            <Text style={styles.callText}>Call customer</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.privacyCard}>
          <Text style={styles.privacyIcon}>i</Text>
          <Text style={styles.privacyText}>Use the contact information available for this job. Customer details may be masked for some partner roles.</Text>
        </View>

        <View style={styles.equipmentCard}>
          <Text style={styles.equipmentTitle}>Equipment & reported issue</Text>
          <Text style={styles.equipmentCopy}>
            {[job?.brand, job?.equipmentModel, job?.equipment].filter(Boolean).join(' · ') || 'Equipment details not provided'}
          </Text>
          <Text style={styles.issueCopy}>{job?.description || 'No additional issue details were provided.'}</Text>
        </View>

        <View style={styles.checkinCard}>
          <Text style={styles.checkinTitle}>Check in when you arrive</Text>
          <Text style={styles.checkinCopy}>Only check in after reaching the job site. The workflow opens after check-in.</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <AppButton title="I am at the site — Check in" onPress={checkIn} loading={working} disabled={!jobId} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const build_styles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  page: { paddingHorizontal: theme.spacing.md, paddingBottom: 112 },
  successBanner: { backgroundColor: theme.colors.success, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  bannerTitle: { color: theme.colors.white, fontSize: 15, fontWeight: '800' },
  bannerCopy: { color: theme.colors.white, fontSize: 12, lineHeight: 17, marginTop: 4 },
  factsCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.md },
  factRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  lastFactRow: { borderBottomWidth: 0 },
  factLabel: { color: theme.colors.secondaryText, fontSize: 12 },
  factValue: { flex: 1, color: theme.colors.mainText, fontSize: 12, fontWeight: '700', textAlign: 'right' },
  locationCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, overflow: 'hidden', marginBottom: theme.spacing.md },
  mapPreview: { height: 108, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primaryLight },
  mapPin: { color: theme.colors.primaryAction, fontSize: 30, fontWeight: '800' },
  mapHint: { color: theme.colors.brandInk, fontSize: 11, fontWeight: '700', marginTop: 3 },
  locationCopy: { padding: theme.spacing.md },
  siteTitle: { color: theme.colors.mainText, fontSize: 13, fontWeight: '700' },
  siteMeta: { color: theme.colors.secondaryText, fontSize: 11, marginTop: 3 },
  actions: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  navigateButton: { flex: 1, minHeight: 46, backgroundColor: theme.colors.primaryDark, borderRadius: theme.borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  navigateText: { color: theme.colors.white, fontSize: 13, fontWeight: '700' },
  callButton: { flex: 1, minHeight: 46, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.primaryAction, borderRadius: theme.borderRadius.md, alignItems: 'center', justifyContent: 'center' },
  callText: { color: theme.colors.brandInk, fontSize: 13, fontWeight: '700' },
  privacyCard: { flexDirection: 'row', gap: 8, backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  privacyIcon: { color: theme.colors.brandInk, fontWeight: '800' },
  privacyText: { flex: 1, color: theme.colors.secondaryText, fontSize: 11, lineHeight: 16 },
  equipmentCard: { backgroundColor: theme.colors.infoLight, borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  equipmentTitle: { color: theme.colors.infoDark, fontSize: 13, fontWeight: '800' },
  equipmentCopy: { color: theme.colors.infoDark, fontSize: 12, lineHeight: 17, marginTop: 5 },
  issueCopy: { color: theme.colors.mainText, fontSize: 12, lineHeight: 18, marginTop: 8 },
  checkinCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, padding: theme.spacing.md },
  checkinTitle: { color: theme.colors.mainText, fontSize: 14, fontWeight: '800' },
  checkinCopy: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: theme.spacing.md },
  error: { color: theme.colors.error, fontSize: 12, marginBottom: theme.spacing.sm },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });

