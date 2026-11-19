import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppHeader, goBackOrHome } from '../../components/AppHeader';
import { registerThemeStyles, theme } from '../../components/theme';
import { apiService } from '../../services/api';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';

interface WorkshopJob {
  id: number;
  jobType?: string;
  referenceId?: string;
  title?: string;
  equipment?: string;
  equipmentModel?: string;
  brand?: string;
  category?: string;
  stage?: string;
  status?: string;
  siteArea?: string;
  createdAt?: string;
}

interface IncomingHardwareScreenProps {
  navigation: any;
}

export const IncomingHardwareScreen: React.FC<IncomingHardwareScreenProps> = ({ navigation }) => {
  const { colors } = useUserPreferences();
  const [requests, setRequests] = useState<WorkshopJob[]>([]);
  const [workshopJobs, setWorkshopJobs] = useState<WorkshopJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [openResponse, assignedResponse] = await Promise.all([
        apiService.listOpenJobs(),
        apiService.listMyJobs(),
      ]);
      setRequests((openResponse.data || []).filter((job: WorkshopJob) => job.jobType === 'repair'));
      setWorkshopJobs((assignedResponse.data || []).filter((job: WorkshopJob) =>
        job.jobType === 'repair' && job.status !== 'completed' && job.stage !== 'dispatched'
      ));
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || 'Could not load incoming workshop hardware.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openQueue = (tab: 'requests' | 'queue') => {
    navigation.navigate('Workshop', { mode: 'repair', tab });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Incoming hardware"
        subtitle="Repair requests and current workshop intake"
        onBack={() => goBackOrHome(navigation)}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={theme.colors.primary} />}
      >
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Workshop intake</Text>
          <Text style={styles.introCopy}>
            Follow new repair requests and equipment already assigned to your workshop.
          </Text>
          <View style={styles.metrics}>
            <Metric label="New requests" value={requests.length} />
            <Metric label="In workshop" value={workshopJobs.length} />
          </View>
        </View>

        {error ? (
          <Pressable onPress={() => load()} style={styles.errorCard} accessibilityRole="button">
            <Text style={styles.errorTitle}>Unable to load intake</Text>
            <Text style={styles.errorText}>{error} Tap to retry.</Text>
          </Pressable>
        ) : null}

        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={styles.loader} />
        ) : (
          <>
            <SectionHeading
              title="New repair requests"
              subtitle="Open tickets matched to your workshop"
              actionLabel="Open queue"
              onPress={() => openQueue('requests')}
            />
            {requests.length ? requests.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                status="Awaiting acceptance"
                onPress={() => navigation.navigate('WorkshopJobDetail', { jobId: job.id, job, mode: 'repair' })}
              />
            )) : <EmptyState text="No new repair requests are waiting for your workshop." />}

            <SectionHeading
              title="In your workshop"
              subtitle="Assigned repair tickets and their current stage"
              actionLabel="View queue"
              onPress={() => openQueue('queue')}
            />
            {workshopJobs.length ? workshopJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                status={(job.stage || job.status || 'Received').replaceAll('_', ' ')}
                onPress={() => navigation.navigate('WorkshopJobDetail', { jobId: job.id, job, mode: 'repair' })}
              />
            )) : <EmptyState text="Accepted repair hardware will appear here with its current workshop stage." />}

            <Text style={styles.note}>
              Live delivery ETAs and shipment manifests are not provided by the current marketplace API.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const Metric = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>
);

const SectionHeading = ({
  title,
  subtitle,
  actionLabel,
  onPress,
}: {
  title: string;
  subtitle: string;
  actionLabel: string;
  onPress: () => void;
}) => (
  <View style={styles.sectionHeading}>
    <View style={styles.sectionCopy}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
    <Pressable onPress={onPress} accessibilityRole="button">
      <Text style={styles.sectionAction}>{actionLabel}</Text>
    </Pressable>
  </View>
);

const JobCard = ({ job, status, onPress }: { job: WorkshopJob; status: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={styles.jobCard}>
    <View style={styles.jobTop}>
      <Text style={styles.reference}>{job.referenceId || `JOB-${job.id}`}</Text>
      <Text style={styles.status}>{status}</Text>
    </View>
    <Text style={styles.jobTitle}>{job.title || job.equipment || 'Repair request'}</Text>
    <Text style={styles.jobDetails}>
      {[job.brand, job.equipmentModel, job.category].filter(Boolean).join(' · ') || 'Equipment details available in the repair queue'}
    </Text>
    <View style={styles.jobBottom}>
      <Text style={styles.location}>{job.siteArea || 'Location not provided'}</Text>
      <Text style={styles.openLabel}>Open ›</Text>
    </View>
  </Pressable>
);

const EmptyState = ({ text }: { text: string }) => (
  <View style={styles.emptyCard}>
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

const build_styles = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  content: { paddingHorizontal: theme.spacing.lg, paddingBottom: 112 },
  introCard: {
    backgroundColor: theme.colors.primaryDark,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  introTitle: { color: theme.colors.white, fontSize: 18, fontWeight: '700' },
  introCopy: { color: theme.colors.onBrandSoft, fontSize: 13, lineHeight: 19, marginTop: 5 },
  metrics: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  metric: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.sm },
  metricValue: { color: theme.colors.brandInk, fontSize: 18, fontWeight: '800' },
  metricLabel: { color: theme.colors.secondaryText, fontSize: 11, marginTop: 3 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
  sectionCopy: { flex: 1, marginRight: theme.spacing.sm },
  sectionTitle: { color: theme.colors.mainText, fontSize: 17, fontWeight: '700' },
  sectionSubtitle: { color: theme.colors.secondaryText, fontSize: 12, marginTop: 3 },
  sectionAction: { color: theme.colors.primaryAction, fontSize: 12, fontWeight: '700' },
  jobCard: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  jobTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  reference: { color: theme.colors.secondaryText, fontSize: 11, fontWeight: '700' },
  status: { color: theme.colors.brandInk, backgroundColor: theme.colors.softBrand, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.borderRadius.pill, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  jobTitle: { color: theme.colors.mainText, fontSize: 15, fontWeight: '700', marginTop: 9 },
  jobDetails: { color: theme.colors.secondaryText, fontSize: 12, marginTop: 4 },
  jobBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: theme.spacing.md },
  location: { color: theme.colors.tertiary, fontSize: 11, flex: 1 },
  openLabel: { color: theme.colors.primaryAction, fontSize: 12, fontWeight: '700' },
  emptyCard: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border },
  emptyText: { color: theme.colors.secondaryText, fontSize: 13, lineHeight: 19 },
  errorCard: { backgroundColor: theme.colors.errorLight, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  errorTitle: { color: theme.colors.errorDark, fontSize: 13, fontWeight: '700' },
  errorText: { color: theme.colors.errorDark, fontSize: 12, marginTop: 4 },
  loader: { marginTop: theme.spacing.xl },
  note: { color: theme.colors.tertiary, fontSize: 11, lineHeight: 16, marginTop: theme.spacing.lg },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });

