import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { AppHeader, goBackOrHome } from '../../components/AppHeader';
import { registerThemeStyles, theme } from '../../components/theme';
import { apiService } from '../../services/api';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import { FieldWorkflowScreen } from './FieldWorkflowScreen';

interface Job {
  id: number;
  referenceId?: string;
  title?: string;
  description?: string;
  jobType?: string;
  category?: string;
  equipment?: string;
  equipmentModel?: string;
  brand?: string;
  urgency?: string;
  status?: string;
  stage?: string;
  checkedInAt?: string;
  siteArea?: string;
  siteAddress?: string;
  customerName?: string;
  customerPhone?: string;
  customerPhoneMasked?: string;
  distanceKm?: number;
  estimatedDriveMinutes?: number;
  basePay?: number;
  serviceCharge?: number;
  issueTags?: string[];
  customerPhotos?: string[];
  workflow?: unknown[];
}

interface JobDetailScreenProps {
  route: { params: { jobId: number; job?: Job } };
  navigation: any;
}

export const JobDetailScreen: React.FC<JobDetailScreenProps> = ({ route, navigation }) => {
  const { colors } = useUserPreferences();
  const { jobId } = route.params;
  const [job, setJob] = useState<Job | null>(route.params.job || null);
  const [loading, setLoading] = useState(!route.params.job);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const loadJob = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiService.getJob(jobId);
      setJob(response.data);
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || 'Could not load this job.');
    } finally {
      setLoading(false);
    }
  };

  const navigateToSite = async () => {
    const address = [job?.siteAddress, job?.siteArea].filter(Boolean).join(', ');
    if (!address) {
      setError('A site address is not available for this request.');
      return;
    }
    try {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`);
    } catch {
      setError('Could not open maps on this device.');
    }
  };

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const accept = async () => {
    setWorking(true);
    setError('');
    try {
      const response = await apiService.acceptJob(jobId);
      setJob({ ...job, ...(response.data || {}), status: response.data?.status || 'accepted' });
    } catch (acceptError: any) {
      setError(acceptError.response?.data?.message || 'Could not accept this request.');
    } finally {
      setWorking(false);
    }
  };

  const callCustomer = () => {
    navigation.navigate('MaskedCall', { jobId, job });
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  }

  if (!job) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Job Details" onBack={() => goBackOrHome(navigation)} />
        <Text style={styles.error}>{error || 'Job not found.'}</Text>
        <AppButton title="Try again" onPress={loadJob} style={styles.retry} />
      </View>
    );
  }

  const isOpen = job.status === 'open';
  const hasCustomerContact = !!(job.customerPhone || job.customerPhoneMasked);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Job Details" subtitle={job.referenceId || `Job ${job.id}`} onBack={() => goBackOrHome(navigation)} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.title}>{job.title || job.equipment || 'Service request'}</Text>
          <Text style={styles.status}>{String(job.stage || job.status || 'Open').replaceAll('_', ' ')}</Text>
        </View>
        <View style={styles.facts}>
          <Text style={styles.factsTitle}>Request details</Text>
          <Fact label="Job ID" value={job.referenceId || `#${job.id}`} />
          <Fact label="Service" value={job.title || job.equipment} />
          <Fact label="Type" value={job.urgency || job.jobType} />
          <Fact label="Customer" value={job.customerName} />
          <Fact label="Site" value={job.siteAddress} />
          <Fact label="Area" value={job.siteArea} />
          <Fact label="Contact" value={job.customerPhone || job.customerPhoneMasked} />
        </View>

        <View style={styles.equipmentCard}>
          <Text style={styles.sectionTitle}>Equipment</Text>
          <Text style={styles.equipmentTitle}>{[job.brand, job.equipment].filter(Boolean).join(' — ') || 'Equipment details not provided'}</Text>
          <Text style={styles.equipmentCopy}>{job.equipmentModel || job.category || 'Model details not provided'}</Text>
        </View>

        <View style={styles.descriptionCard}>
          <Text style={styles.sectionTitle}>Customer description</Text>
          <Text style={styles.description}>{job.description || 'No additional request description was provided.'}</Text>
          {job.issueTags?.length ? (
            <View style={styles.tags}>
              {job.issueTags.map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}
            </View>
          ) : null}
        </View>

        <View style={styles.photosCard}>
          <Text style={styles.sectionTitle}>Photos from customer</Text>
          {job.customerPhotos?.length ? (
            <View style={styles.photos}>
              {job.customerPhotos.map((uri, index) => <Image key={`${uri}-${index}`} source={{ uri }} style={styles.customerPhoto} />)}
            </View>
          ) : <Text style={styles.noPhotos}>No customer photos attached to this request.</Text>}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.actions}>
          <AppButton title="Navigate" onPress={navigateToSite} variant="outline" style={styles.actionButton} />
          {hasCustomerContact ? <AppButton title="Call customer" onPress={callCustomer} variant="outline" style={styles.actionButton} /> : null}
        </View>
        <View style={styles.privacyCard}>
          <Text style={styles.privacyText}>Customer contact details are subject to partner-role access. Use only for this service request.</Text>
        </View>
        {isOpen ? (
          <AppButton title="Accept request" onPress={accept} loading={working} style={styles.primaryAction} />
        ) : (
          <FieldWorkflowScreen
            embedded
            route={{ params: { jobId, job } }}
            navigation={navigation}
            onJobChange={setJob}
          />
        )}
      </ScrollView>
    </View>
  );
};

const Fact = ({ label, value }: { label: string; value?: string | number }) => (
  <View style={styles.fact}>
    <Text style={styles.factLabel}>{label}</Text>
    <Text style={styles.factValue}>{value === undefined || value === null || value === '' ? 'Not provided' : String(value)}</Text>
  </View>
);

const build_styles = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primaryBackground },
  scroll: { flex: 1 },
  content: { paddingHorizontal: theme.spacing.md, paddingBottom: 128 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: theme.spacing.md },
  title: { flex: 1, flexShrink: 1, color: theme.colors.mainText, fontSize: 19, lineHeight: 25, fontWeight: '800' },
  status: { flexShrink: 1, maxWidth: '42%', color: theme.colors.brandInk, backgroundColor: theme.colors.primaryLight, paddingHorizontal: 9, paddingVertical: 5, borderRadius: theme.borderRadius.pill, fontSize: 10, lineHeight: 14, fontWeight: '700', textTransform: 'uppercase', overflow: 'hidden' },
  description: { color: theme.colors.mainText, fontSize: 13, lineHeight: 20 },
  facts: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, marginBottom: theme.spacing.md },
  factsTitle: { color: theme.colors.secondaryText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 3 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  factLabel: { color: theme.colors.secondaryText, fontSize: 13, lineHeight: 18, width: 88 },
  factValue: { color: theme.colors.mainText, fontSize: 13, lineHeight: 18, fontWeight: '600', flex: 1, flexShrink: 1, textAlign: 'right' },
  equipmentCard: { backgroundColor: theme.colors.infoLight, borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  equipmentTitle: { color: theme.colors.infoDark, fontSize: 13, fontWeight: '700' },
  equipmentCopy: { color: theme.colors.infoDark, fontSize: 12, lineHeight: 17, marginTop: 4 },
  descriptionCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  sectionTitle: { color: theme.colors.secondaryText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 9 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: { color: theme.colors.brandInk, backgroundColor: theme.colors.primaryLight, borderWidth: 1, borderColor: theme.colors.borderStrong, paddingVertical: 6, paddingHorizontal: 9, borderRadius: theme.borderRadius.pill, fontSize: 11 },
  photosCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  customerPhoto: { width: 82, height: 82, borderRadius: theme.borderRadius.sm, backgroundColor: theme.colors.surfaceVariant },
  noPhotos: { color: theme.colors.secondaryText, fontSize: 12, paddingVertical: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  actionButton: { flexGrow: 1, flexBasis: 140, marginBottom: 0 },
  privacyCard: { backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginVertical: theme.spacing.sm },
  privacyText: { color: theme.colors.secondaryText, fontSize: 11, lineHeight: 16 },
  primaryAction: { marginTop: theme.spacing.sm },
  error: { color: theme.colors.error, marginBottom: 12 },
  retry: { marginHorizontal: theme.spacing.lg },
  callButton: { marginBottom: theme.spacing.sm },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
