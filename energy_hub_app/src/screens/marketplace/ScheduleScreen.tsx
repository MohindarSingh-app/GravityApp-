import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { registerThemeStyles, theme } from '../../components/theme';
import { apiService } from '../../services/api';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';

type ScheduledJob = {
  id: number;
  referenceId?: string;
  title?: string;
  equipment?: string;
  jobType?: string;
  status?: string;
  stage?: string;
  scheduledAt?: string;
  createdAt?: string;
  customerName?: string;
  siteArea?: string;
  siteAddress?: string;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Schedule list without the screen chrome so it can also render as a tab
 *  inside the Jobs screen. */
export const ScheduleBody: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors } = useUserPreferences();
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiService.listMyJobs();
      setJobs((response.data || []).filter((job: ScheduledJob) => job.status !== 'completed'));
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || 'Could not load your schedule.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sections = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
    const dated = new Map<number, ScheduledJob[]>();
    const unscheduled: ScheduledJob[] = [];
    jobs.forEach((job) => {
      const timestamp = job.scheduledAt ? new Date(job.scheduledAt).getTime() : Number.NaN;
      if (!Number.isFinite(timestamp)) {
        unscheduled.push(job);
        return;
      }
      const key = startOfDay(new Date(timestamp));
      dated.set(key, [...(dated.get(key) || []), job]);
    });
    const daySections = [...dated.entries()]
      .sort(([left], [right]) => left - right)
      .map(([day, items]) => ({
        key: String(day),
        title: day === todayStart
          ? `TODAY · ${new Date(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
          : day === tomorrowStart
            ? `TOMORROW · ${new Date(day).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
            : new Date(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' }).toUpperCase(),
        jobs: items,
      }));
    return { daySections, unscheduled };
  }, [jobs]);

  const openJob = (job: ScheduledJob) => {
    if (job.jobType === 'delivery') {
      navigation.navigate('Delivery', { jobId: job.id, job });
    } else if (job.jobType === 'repair' || job.jobType === 'panel') {
      navigation.navigate('WorkshopJobDetail', { jobId: job.id, job, mode: job.jobType === 'panel' ? 'panel' : 'repair' });
    } else {
      navigation.navigate('JobDetail', { jobId: job.id, job });
    }
  };

  const renderJob = (job: ScheduledJob) => (
    <TouchableOpacity key={String(job.id)} style={styles.jobCard} onPress={() => openJob(job)} accessibilityRole="button">
      <View style={styles.timeColumn}>
        <Text style={styles.time}>{job.scheduledAt ? new Date(job.scheduledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '— —'}</Text>
        <Text style={styles.type}>{job.jobType || 'SERVICE'}</Text>
      </View>
      <View style={styles.jobCopy}>
        <Text style={styles.jobTitle} numberOfLines={1}>{job.title || job.equipment || 'Service visit'}</Text>
        <Text style={styles.customer} numberOfLines={1}>{job.customerName || job.referenceId || `Job #${job.id}`}</Text>
        <Text style={styles.location} numberOfLines={1}>{[job.siteArea, job.siteAddress].filter(Boolean).join(', ') || 'Location pending'}</Text>
      </View>
      <View style={[styles.statusBadge, job.status === 'in_progress' && styles.statusActive]}>
        <Text style={[styles.statusText, job.status === 'in_progress' && styles.statusTextActive]}>
          {job.status === 'in_progress' ? 'Active' : job.status === 'accepted' ? 'Upcoming' : job.status || 'Assigned'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} style={styles.loader} /></SafeAreaView>;
  }

  return (
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        {error ? (
          <TouchableOpacity onPress={load} style={styles.errorCard} accessibilityRole="button">
            <Text style={styles.error}>{error}</Text><Text style={styles.retry}>Tap to retry</Text>
          </TouchableOpacity>
        ) : null}
        {sections.daySections.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.listCard}>{section.jobs.map(renderJob)}</View>
          </View>
        ))}
        {sections.unscheduled.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TIME TO BE CONFIRMED</Text>
            <View style={styles.listCard}>{sections.unscheduled.map(renderJob)}</View>
            <Text style={styles.helper}>Your assigned work appears here until an appointment time is added.</Text>
          </View>
        ) : null}
        {!jobs.length && !error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No upcoming work scheduled</Text>
            <Text style={styles.emptyCopy}>Accepted jobs will appear here. Browse new jobs to find matched work.</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Jobs', { mode: 'open' })} style={styles.browseButton}>
              <Text style={styles.browseText}>Browse new jobs</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>
  );
};

export const ScheduleScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors } = useUserPreferences();
  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Schedule" subtitle="Assigned work and current stages" />
      <ScheduleBody navigation={navigation} />
    </SafeAreaView>
  );
};

const build_styles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  page: { paddingHorizontal: theme.spacing.md, paddingBottom: 112 },
  loader: { marginTop: 60 },
  section: { marginBottom: theme.spacing.lg },
  sectionTitle: { color: theme.colors.secondaryText, fontSize: 12, fontWeight: '800', marginBottom: theme.spacing.sm },
  listCard: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md },
  jobCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.divider, paddingVertical: 12 },
  timeColumn: { width: 63 },
  time: { color: theme.colors.brandInk, fontSize: 13, fontWeight: '800' },
  type: { color: theme.colors.secondaryText, fontSize: 9, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },
  jobCopy: { flex: 1, minWidth: 0, marginHorizontal: 8 },
  jobTitle: { color: theme.colors.mainText, fontSize: 13, fontWeight: '800' },
  customer: { color: theme.colors.mainText, fontSize: 11, fontWeight: '600', marginTop: 3 },
  location: { color: theme.colors.secondaryText, fontSize: 10, marginTop: 2 },
  statusBadge: { maxWidth: 75, paddingHorizontal: 8, paddingVertical: 5, borderRadius: theme.borderRadius.pill, backgroundColor: theme.colors.surfaceVariant },
  statusActive: { backgroundColor: theme.colors.primaryLight },
  statusText: { color: theme.colors.secondaryText, fontSize: 9, fontWeight: '700' },
  statusTextActive: { color: theme.colors.brandInk },
  helper: { color: theme.colors.secondaryText, fontSize: 11, lineHeight: 16, marginTop: 7, marginHorizontal: 3 },
  empty: { alignItems: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, padding: theme.spacing.lg, marginTop: theme.spacing.md },
  emptyTitle: { color: theme.colors.mainText, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  emptyCopy: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: theme.spacing.sm },
  browseButton: { backgroundColor: theme.colors.primaryAction, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.lg, paddingVertical: 12, marginTop: theme.spacing.md },
  browseText: { color: theme.colors.white, fontSize: 13, fontWeight: '700' },
  errorCard: { backgroundColor: theme.colors.errorLight, borderWidth: 1, borderColor: theme.colors.error, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  error: { color: theme.colors.errorDark, fontSize: 13 },
  retry: { color: theme.colors.errorDark, fontSize: 11, fontWeight: '700', marginTop: 4 },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });

