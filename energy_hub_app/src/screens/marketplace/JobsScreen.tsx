import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, goBackOrHome } from '../../components/AppHeader';
import { registerThemeStyles, theme } from '../../components/theme';
import { apiService } from '../../services/api';
import { useAuth } from '../../providers/AuthProvider';
import { ScheduleBody } from './ScheduleScreen';

/* Semantic aliases keep urgency-specific styling readable while sourcing every
   value from the shared EnergyHub design system. */
const build_UI = () => ({
  red: theme.colors.error,
  redLight: theme.colors.errorLight,
  redText: theme.colors.errorDark,
  redLine: theme.colors.error,
  green: theme.colors.success,
  greenLight: theme.colors.successLight,
  greenText: theme.colors.successDark,
  greenLine: theme.colors.success,
  blue: theme.colors.primary,
  blueLight: theme.colors.primaryLight,
  blueText: theme.colors.brandInk,
  blueLine: theme.colors.primary,
  amber: theme.colors.warning,
  amberLight: theme.colors.warningLight,
  amberText: theme.colors.warningDark,
  amberText2: theme.colors.warningDark,
  amberLine: theme.colors.warning,
  purpleLight: theme.colors.surfaceVariant,
  purpleText: theme.colors.brandInk,
  text: theme.colors.mainText,
  text2: theme.colors.secondaryText,
  text3: theme.colors.textTertiary,
  bd: theme.colors.border,
  bd2: theme.colors.borderStrong,
  bg: theme.colors.primaryBackground,
  surface: theme.colors.surface,
});
let UI = build_UI();
registerThemeStyles(() => { UI = build_UI(); });


type FeedMode = 'open' | 'mine' | 'delivery';

interface Job {
  id: number;
  referenceId?: string;
  title?: string;
  description?: string;
  jobType?: string;
  urgency?: string;
  status?: string;
  stage?: string;
  category?: string;
  equipment?: string;
  equipmentModel?: string;
  brand?: string;
  siteArea?: string;
  siteAddress?: string;
  customerName?: string;
  customerCompany?: string;
  customerPhoneMasked?: string;
  startedAt?: string;
  scheduledAt?: string;
  estimatedDurationHours?: number;
  distanceKm?: number;
  estimatedDriveMinutes?: number;
  basePay?: number;
  serviceCharge?: number;
  slaDueAt?: string;
  repairCenterRecommended?: boolean;
  createdAt?: string;
  completedAt?: string;
  payoutAmount?: number;
  totalBill?: number;
}

interface Earning {
  netAmount?: number;
  createdAt?: string;
}

interface JobsScreenProps {
  route: { params?: { mode?: FeedMode } };
  navigation: any;
}

/* Urgency theme — red (emergency), amber (urgent), blue (scheduled) exactly
   like the mockup req-top bars. */
const urgencyTheme = (urgency?: string) => {
  const key = (urgency || '').toLowerCase();
  if (key.includes('emerg')) return { bg: UI.redLight, line: UI.redLine, strong: UI.red, text: UI.redText, label: 'EMERGENCY' };
  if (key.includes('urgent') || key.includes('high')) return { bg: UI.amberLight, line: UI.amberLine, strong: UI.amber, text: UI.amberText, label: 'URGENT' };
  return { bg: UI.blueLight, line: UI.blueLine, strong: UI.blue, text: UI.blueText, label: 'SCHEDULED' };
};

/* Live countdown — ticks every second, turns red under 10 minutes. */
const useNow = (active: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
};

const CountdownRing: React.FC<{ secondsLeft: number; total: number }> = ({ secondsLeft, total }) => {
  const pct = Math.max(0, Math.min(1, total > 0 ? secondsLeft / total : 0));
  const minutes = Math.floor(Math.max(0, secondsLeft) / 60);
  const seconds = Math.max(0, secondsLeft) % 60;
  const expired = secondsLeft <= 0;
  const critical = secondsLeft <= 10 * 60;
  const tint = expired ? UI.text3 : critical ? UI.red : UI.green;
  const sweep = `${pct * 360 - 90}deg`;

  return (
    <View style={styles.ringWrap}>
      <View style={styles.ringSize}>
        <View style={[styles.ringTrack, { borderColor: `${tint}33` }]} />
        {!expired ? (
          <View style={[styles.ringFill, { borderColor: tint, borderRightColor: 'transparent', borderBottomColor: 'transparent', transform: [{ rotate: sweep }] }]} />
        ) : null}
        <Text style={[styles.ringText, { color: tint }]}>{expired ? 'Closed' : `${minutes}:${String(seconds).padStart(2, '0')}`}</Text>
      </View>
      <Text style={[styles.ringLabel, { color: expired ? UI.text3 : UI.text2 }]}>
        {expired ? 'Window closed' : 'Response window'}
      </Text>
    </View>
  );
};

const RequestCard: React.FC<{
  job: Job;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onDecline: () => void;
}> = ({ job, expanded, busy, onToggle, onAccept, onDecline }) => {
  const theme = urgencyTheme(job.urgency);
  const now = useNow(true);
  const pay = Number(job.basePay || job.serviceCharge || 0);
  const place = job.siteArea || job.siteAddress || 'Location pending';
  const distance = job.distanceKm ? `${job.distanceKm} km · ` : '';
  const drive = job.estimatedDriveMinutes ? `${job.estimatedDriveMinutes} min drive` : '';
  const posted = job.createdAt
    ? `Posted ${new Date(job.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : 'Just now';
  const windowTotal = 45 * 60;
  const secondsLeft = job.slaDueAt
    ? Math.floor((new Date(job.slaDueAt).getTime() - now) / 1000)
    : windowTotal;
  const isCritical = secondsLeft <= 10 * 60;

  return (
    <View style={[styles.reqCard, { borderColor: theme.line }]}>
      {/* Pulsing top bar — red for emergency, amber for urgent, blue for scheduled */}
      <View style={[styles.reqTop, { backgroundColor: theme.bg }]}>
        <View style={[styles.reqTopDot, { backgroundColor: theme.strong }]} />
        <Text style={[styles.reqTopText, { color: theme.text }]}>
          {theme.label} · {posted}
        </Text>
        {isCritical && !expanded ? (
          <View style={[styles.reqTopPill, { backgroundColor: theme.strong }]}>
            <Text style={styles.reqTopPillText}>{Math.max(0, Math.floor(secondsLeft / 60))} min left</Text>
          </View>
        ) : null}
      </View>

      <Pressable accessibilityRole="button" onPress={onToggle} style={styles.reqBody}>
        <View style={styles.reqHead}>
          <View style={styles.flexOne}>
            <Text style={styles.reqRef}>{job.referenceId || `JOB-${job.id}`}</Text>
            <Text style={styles.reqTitle}>{job.title || job.equipment || 'Service request'}</Text>
            <Text style={styles.reqCustomer}>
              {job.customerName || 'Customer'}{job.customerCompany ? ` · ${job.customerCompany}` : ''}
            </Text>
          </View>
          <View style={styles.payPill}>
            <Text style={styles.payLabel}>PAYOUT</Text>
            <Text style={styles.pay}>₹{pay.toLocaleString('en-IN')}</Text>
          </View>
        </View>

        <View style={styles.reqMetaRow}>
          <Text style={styles.reqMeta}>{place}</Text>
          {distance || drive ? <Text style={styles.reqMeta}>{[distance, drive].filter(Boolean).join('')}</Text> : null}
        </View>

        <Text style={styles.reqDesc} numberOfLines={expanded ? undefined : 1}>
          {job.description || [job.brand, job.equipmentModel, job.category].filter(Boolean).join(' · ') || 'Service details in ticket'}
        </Text>

        {/* Countdown ring — live ticking, red under 10 minutes */}
        {job.status === 'open' ? (
          <View style={styles.timerRow}>
            <CountdownRing secondsLeft={secondsLeft} total={windowTotal} />
            <View style={styles.timerCopy}>
              <Text style={styles.timerHint}>Accept before the window closes.</Text>
              <Text style={[styles.timerUrgency, { color: isCritical ? UI.red : UI.text3 }]}>
                {isCritical ? 'Responding fast improves match score' : 'Requests expire when the timer ends'}
              </Text>
            </View>
          </View>
        ) : null}

        {expanded ? (
          <View style={styles.reqDetails}>
            {job.brand || job.equipmentModel ? (
              <View style={styles.detailRowInline}>
                <Text style={styles.detailKey}>Equipment</Text>
                <Text style={styles.detailValue}>{[job.brand, job.equipmentModel, job.category].filter(Boolean).join(' · ') || '—'}</Text>
              </View>
            ) : null}
            {job.scheduledAt ? (
              <View style={styles.detailRowInline}>
                <Text style={styles.detailKey}>Scheduled</Text>
                <Text style={styles.detailValue}>{new Date(job.scheduledAt).toLocaleString()}</Text>
              </View>
            ) : null}
            {job.siteAddress ? (
              <View style={styles.detailRowInline}>
                <Text style={styles.detailKey}>Address</Text>
                <Text style={styles.detailValue}>{job.siteAddress}</Text>
              </View>
            ) : null}
            {job.customerPhoneMasked ? (
              <View style={styles.detailRowInline}>
                <Text style={styles.detailKey}>Contact</Text>
                <Text style={styles.detailValue}>{job.customerPhoneMasked}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.expandRow}>
          <Text style={[styles.expandText, { color: theme.strong }]}>{expanded ? 'Show less ▲' : 'View full details ▼'}</Text>
        </View>
      </Pressable>

      {job.status === 'open' ? (
        <View style={[styles.reqActions, { borderTopColor: UI.bd }]}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onDecline}
            style={[styles.declineBtn, busy && styles.busyBtn]}
          >
            <Text style={styles.declineText}>✕ Decline</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onAccept}
            style={[styles.acceptBtn, { backgroundColor: theme.strong }, busy && styles.busyBtn]}
          >
            <Text style={styles.acceptText}>✓ Accept request</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[styles.reqActions, { borderTopColor: UI.bd }]}>
          <Text style={styles.openText}>Open ticket →</Text>
        </View>
      )}
    </View>
  );
};

export const JobsScreen: React.FC<JobsScreenProps> = ({ route, navigation }) => {
  useUserPreferences();

  const { user, previewRole } = useAuth();
  const mode = route.params?.mode || 'open';
  const activeRole = previewRole || user?.role || 'service_partner';
  const isActiveView = mode === 'mine';
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [needsDeliveryVerification, setNeedsDeliveryVerification] = useState(false);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [supportingDataError, setSupportingDataError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [activeSection, setActiveSection] = useState<'active' | 'schedule'>('active');

  const loadJobs = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    setSupportingDataError('');
    setNeedsDeliveryVerification(false);
    try {
      const response = mode === 'delivery'
        ? await apiService.listOpenDeliveryJobs()
        : mode === 'mine'
            ? await apiService.listMyJobs()
            : await apiService.listOpenJobs();
      setJobs(response.data || []);
      if (mode === 'mine') {
        const earningsResult = await Promise.allSettled([apiService.listEarnings()]);
        const errors: string[] = [];
        if (earningsResult[0].status === 'fulfilled') {
          setEarnings(earningsResult[0].value.data || []);
        } else {
          errors.push('Could not load today’s earnings.');
        }
        setSupportingDataError(errors.join(' '));
      }
    } catch (loadError: any) {
      const message = loadError.response?.data?.message || 'Could not load jobs. Check the connection and try again.';
      setError(message);
      setNeedsDeliveryVerification(
        mode === 'delivery'
        && loadError.response?.status === 403
        && !message.startsWith('Only service partners')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const acceptJob = async (job: Job) => {
    setBusyId(job.id);
    try {
      const response = mode === 'delivery' || job.jobType === 'delivery'
        ? await apiService.acceptDelivery(job.id)
        : await apiService.acceptJob(job.id);
      const accepted = { ...job, ...(response.data || {}), status: response.data?.status || 'accepted' };
      setJobs((current) => current.filter((item) => item.id !== job.id));
      if (mode === 'delivery' || job.jobType === 'delivery') {
        navigation.navigate('Delivery', { jobId: job.id, job: accepted });
      } else if (job.jobType === 'repair' || job.jobType === 'panel') {
        navigation.navigate('WorkshopJobDetail', {
          jobId: job.id,
          job: accepted,
          mode: job.jobType === 'panel' ? 'panel' : 'repair',
        });
      } else {
        navigation.navigate('JobDetail', { jobId: job.id, job: accepted });
      }
    } catch (acceptError: any) {
      setError(acceptError.response?.data?.message || 'Could not accept this job. Refresh to check availability.');
    } finally {
      setBusyId(null);
    }
  };

  const declineJob = async (job: Job) => {
    setBusyId(job.id);
    try {
      await apiService.declineJob(job.id, 'Partner unavailable');
      setJobs((current) => current.filter((item) => item.id !== job.id));
    } catch (declineError: any) {
      setError(declineError.response?.data?.message || 'Could not decline this request.');
    } finally {
      setBusyId(null);
    }
  };

  const openJob = (job: Job) => {
    if (mode === 'delivery' || job.jobType === 'delivery') {
      navigation.navigate('Delivery', { jobId: job.id, job });
    } else if (job.jobType === 'repair' || job.jobType === 'panel') {
      navigation.navigate('WorkshopJobDetail', {
        jobId: job.id,
        job,
        mode: job.jobType === 'panel' ? 'panel' : 'repair',
      });
    } else {
      navigation.navigate('JobDetail', {
        jobId: job.id,
        job,
      });
    }
  };

  const title = mode === 'delivery'
    ? 'Delivery requests'
    : mode === 'mine'
        ? 'Active'
        : 'New Jobs';

  const activeJobs = jobs.filter((job) => job.status === 'accepted' || job.status === 'in_progress');
  const completedJobs = jobs.filter((job) => job.status === 'completed');
  const activeJobsSorted = [...activeJobs].sort((left, right) => {
    if (!left.scheduledAt) return right.scheduledAt ? -1 : 0;
    if (!right.scheduledAt) return 1;
    return new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime();
  });
  const today = new Date().toDateString();
  const todayEarnings = earnings
    .filter((earning) => earning.createdAt && new Date(earning.createdAt).toDateString() === today)
    .reduce((total, earning) => total + Number(earning.netAmount || 0), 0);
  const completedCount = completedJobs.length;
  const currentJob = activeJobsSorted.find((job) => !job.scheduledAt || new Date(job.scheduledAt).getTime() <= Date.now()) || activeJobsSorted[0];
  const nextScheduledJob = activeJobsSorted
    .filter((job) => job.id !== currentJob?.id && job.scheduledAt && new Date(job.scheduledAt).getTime() > Date.now())[0];

  const openJobs = useMemo(() => jobs.filter((job) => job.status === 'open'), [jobs]);
  const visibleOpen = showAll ? openJobs : openJobs.slice(0, 4);
  const formatJobTime = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? null
      : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };
  const jobTimeLabel = (job: Job) => {
    const started = formatJobTime(job.startedAt);
    if (started) return `Started ${started}`;
    const scheduled = formatJobTime(job.scheduledAt);
    return scheduled ? `Scheduled ${scheduled}` : 'Schedule pending';
  };

  return (
    <View style={styles.screen}>
      <AppHeader
        title={title}
        subtitle={mode === 'mine' ? 'Your current work, progress and activity' : `${openJobs.length} requests matched to your skills`}
        onBack={() => goBackOrHome(navigation)}
      />
      {isActiveView ? (
        <View style={styles.activeTabs}>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel="Active jobs tab"
            accessibilityState={{ selected: activeSection === 'active' }}
            onPress={() => setActiveSection('active')}
            style={[styles.activeTab, activeSection === 'active' && styles.activeTabSelected]}
          >
            <Text style={[styles.activeTabText, activeSection === 'active' && styles.activeTabTextSelected]}>Active</Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel="Schedule tab"
            accessibilityState={{ selected: activeSection === 'schedule' }}
            onPress={() => setActiveSection('schedule')}
            style={[styles.activeTab, activeSection === 'schedule' && styles.activeTabSelected]}
          >
            <Text style={[styles.activeTabText, activeSection === 'schedule' && styles.activeTabTextSelected]}>Schedule</Text>
          </Pressable>
        </View>
      ) : null}
      {!isActiveView ? (
        <View style={styles.feedSwitch}>
          <>
            <Pressable onPress={() => navigation.replace('Jobs', { mode: 'open' })} style={[styles.feedOption, mode === 'open' && styles.feedOptionActive]}>
              <Text style={[styles.feedLabel, mode === 'open' && styles.feedLabelActive]}>New Jobs</Text>
            </Pressable>
            {activeRole === 'service_partner' ? (
              <Pressable onPress={() => navigation.replace('Jobs', { mode: 'delivery' })} style={[styles.feedOption, mode === 'delivery' && styles.feedOptionActive]}>
                <Text style={[styles.feedLabel, mode === 'delivery' && styles.feedLabelActive]}>Delivery</Text>
              </Pressable>
            ) : null}
          </>
        </View>
      ) : null}
      {error && activeSection !== 'schedule' ? (
        <View style={styles.errorBlock}>
          <Text style={styles.error}>{error}</Text>
          {needsDeliveryVerification ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Specializations')}
              style={styles.verificationButton}
            >
              <Text style={styles.verificationButtonText}>Review delivery verification</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {isActiveView && activeSection === 'schedule' ? (
        <ScheduleBody navigation={navigation} />
      ) : loading ? (
        <ActivityIndicator color={UI.blue} style={styles.loader} />
      ) : mode === 'mine' ? (
        <ScrollView
          contentContainerStyle={styles.activePage}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadJobs(true)} tintColor={UI.blue} />}
          showsVerticalScrollIndicator={false}
        >
          {supportingDataError ? <Text style={styles.supportingError}>{supportingDataError}</Text> : null}

          {/* Repair recommendation pill — mockup style compact strip */}
          <Text style={styles.sectionStatus}>{activeJobs.length ? 'Partner is busy on assigned work.' : 'No active job; you are available for new work.'}</Text>
          <Text style={styles.currentJobHeading}>Your work</Text>
          {activeJobs.length ? (
            <View style={styles.currentJobBanner}>
              <Text style={styles.currentJobEyebrow}>CURRENT JOB</Text>
              <Text style={styles.currentJobTitle}>{currentJob?.title || currentJob?.equipment || currentJob?.referenceId || 'Assigned job'}</Text>
              <Text style={styles.currentJobMeta}>{currentJob?.referenceId || 'Current assignment'} · {currentJob?.stage?.replaceAll('_', ' ') || currentJob?.status}</Text>
              <Text style={styles.currentJobMeta}>Time: {formatJobTime(currentJob?.scheduledAt || currentJob?.startedAt) || 'In progress'}{currentJob?.estimatedDurationHours ? ` · Est. ${currentJob.estimatedDurationHours} hrs` : ''}</Text>
              <Text style={styles.currentJobMeta}>Next schedule: {nextScheduledJob ? `${nextScheduledJob.title || nextScheduledJob.referenceId} at ${formatJobTime(nextScheduledJob.scheduledAt)}` : 'No other scheduled job'}</Text>
            </View>
          ) : null}

          {activeJobs.some((job) => job.repairCenterRecommended) ? (
            <View style={styles.recommendationCard}>
              <Text style={styles.recommendationIcon}>EH</Text>
              <Text style={styles.recommendationText}>
                Repair recommendation — {activeJobs.find((job) => job.repairCenterRecommended)?.referenceId || 'Active job'}
              </Text>
              <View style={[styles.badge, { backgroundColor: UI.amberLight }]}>
                <Text style={[styles.badgeText, { color: UI.amberText2, fontSize: 10 }]}>Pending customer review</Text>
              </View>
            </View>
          ) : null}

          {/* Stats — 4 rs-cards with rings (mockup) */}
          <View style={styles.rsGrid}>
            <RingStat label="Today" value={formatMoney(todayEarnings)} percent={Math.min(todayEarnings / 2500 * 100, 100)} bg={UI.greenLight} tint={UI.greenText} track={UI.greenLine} />
            <RingStat label="Completed" value={String(completedCount)} percent={Math.min(completedCount * 17, 100)} bg={UI.blueLight} tint={UI.blueText} track={UI.blueLine} />
            <RingStat label="Active" value={String(activeJobs.length)} percent={activeJobs.length ? 33 : 0} bg={UI.amberLight} tint={UI.amberText2} track={UI.amberLine} />
            <RingStat label="Rating" value="—" percent={0} bg={UI.purpleLight} tint={UI.purpleText} track={theme.colors.borderStrong} />
          </View>

          {/* Active Job — compact job-card with emoji rows (mockup) */}
          <Text style={styles.secTitle}>Active Job</Text>
          {activeJobsSorted.length ? activeJobsSorted.map((job) => (
            <Pressable key={job.id} onPress={() => openJob(job)} style={styles.activeJobCard}>
              <View style={styles.activeJobHeader}>
                <View style={styles.flexOne}>
                  <Text style={styles.activeJobTitle}>{job.title || job.equipment || 'Service request'}</Text>
                  <Text style={styles.activeJobRef}>{job.referenceId || `JOB-${job.id}`} · {job.stage ? job.stage.replaceAll('_', ' ') : 'Scheduled'}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: UI.blueLight }]}>
                  <Text style={[styles.badgeText, { color: UI.blueText, fontSize: 10 }]}>In Progress</Text>
                </View>
              </View>
              <Text style={styles.jobRow}>{job.customerName || 'Customer'}{job.siteArea ? ` · ${job.siteArea}` : ''}</Text>
              <Text style={styles.jobRow}>⏱ {jobTimeLabel(job)}{job.estimatedDurationHours ? ` · Est. ${job.estimatedDurationHours} hrs` : ''}</Text>
              <Text style={styles.jobRow}>₹ Est. payout ₹{Number(job.payoutAmount || job.basePay || job.serviceCharge || 0).toLocaleString('en-IN')}</Text>
            </Pressable>
          )) : (
            <View style={styles.emptyActiveCard}>
              <Text style={styles.emptyTitle}>No active work yet</Text>
              <Text style={styles.emptyCopy}>Accepted jobs will appear here with their current progress.</Text>
              <Pressable onPress={() => navigation.navigate('Jobs', { mode: 'open' })} style={styles.browseButton}>
                <Text style={styles.browseButtonText}>Browse new jobs</Text>
              </Pressable>
            </View>
          )}

        </ScrollView>
      ) : (
        <FlatList
          data={visibleOpen}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <RequestCard
              job={item}
              expanded={expandedId === item.id}
              busy={busyId === item.id}
              onToggle={() => setExpandedId((current) => current === item.id ? null : item.id)}
              onAccept={() => void acceptJob(item)}
              onDecline={() => void declineJob(item)}
            />
          )}
          contentContainerStyle={openJobs.length ? styles.list : styles.emptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadJobs(true)} tintColor={UI.blue} />}
          ListHeaderComponent={openJobs.length ? (
            <View style={styles.matchBanner}>
              <Ionicons name="locate" size={16} color={UI.blueText} />
              <Text style={styles.matchBannerText}>{openJobs.length} nearby request{openJobs.length === 1 ? '' : 's'} matched to your skills</Text>
            </View>
          ) : null}
          ListEmptyComponent={(
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No requests right now</Text>
              <Text style={styles.emptyCopy}>Pull down to check for newly matched work.</Text>
            </View>
          )}
          ListFooterComponent={openJobs.length > 4 ? (
            <Pressable accessibilityRole="button" onPress={() => setShowAll((current) => !current)} style={styles.showMore}>
              <Text style={styles.showMoreText}>{showAll ? 'Show fewer requests ▲' : `Show all ${openJobs.length} requests ▼`}</Text>
            </Pressable>
          ) : null}
        />
      )}
    </View>
  );
};

const MetricCard = null;

/* rs-card with ring arc — mockup style stat card */
const RingStat = ({ label, value, percent, bg, tint, track }: {
  label: string;
  value: string;
  percent: number;
  bg: string;
  tint: string;
  track: string;
}) => (
  <View style={[styles.rsCard, { backgroundColor: bg }]}>
    <View style={styles.rsRing}>
      <View style={[styles.rsRingTrack, { borderColor: track }]} />
      <View
        style={[styles.rsRingFill, {
          borderColor: tint,
          borderRightColor: 'transparent',
          borderBottomColor: 'transparent',
          transform: [{ rotate: `${Math.max(percent, 4) / 100 * 360 - 90}deg` }],
        }]}
      />
    </View>
    <Text style={[styles.rsN, { color: tint }]} numberOfLines={1}>{value}</Text>
    <Text style={[styles.rsL, { color: tint }]}>{label}</Text>
  </View>
);

const formatMoney = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const build_styles = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },
  flexOne: { flex: 1 },
  activePage: { paddingHorizontal: theme.spacing.md, paddingBottom: 112, gap: 0 },
  activeTabs: {
    flexDirection: 'row',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: 4,
    borderRadius: theme.borderRadius.md,
    backgroundColor: UI.blueLight,
  },
  activeTab: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
  },
  activeTabSelected: {
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.bd,
  },
  activeTabText: { color: UI.text2, fontSize: 13, fontWeight: '700' },
  activeTabTextSelected: { color: UI.blueText, fontWeight: '800' },
  feedSwitch: {
    marginHorizontal: 18,
    marginBottom: 10,
    padding: 4,
    borderRadius: 12,
    backgroundColor: UI.blueLight,
    flexDirection: 'row',
  },
  feedOption: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  feedOptionActive: { backgroundColor: UI.surface },
  feedLabel: { color: UI.text2, fontSize: 13, fontWeight: '600' },
  feedLabelActive: { color: UI.blueText },
  list: { paddingHorizontal: theme.spacing.lg, paddingBottom: 112, paddingTop: theme.spacing.xs },
  emptyList: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 18 },

  /* Match banner — blue info strip like the mockup */
  matchBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: UI.blueLight, borderColor: UI.blueLine, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12 },
  matchBannerText: { flex: 1, color: UI.blueText, fontSize: 12.5, lineHeight: 18, fontWeight: '700' },

  /* Request card — white card with colored top bar */
  reqCard: { backgroundColor: UI.surface, borderWidth: 1, borderRadius: 14, marginBottom: 14, overflow: 'hidden' },
  reqTop: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9 },
  reqTopDot: { width: 8, height: 8, borderRadius: 4 },
  reqTopText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3, flex: 1 },
  reqTopPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  reqTopPillText: { color: theme.colors.white, fontSize: 10, fontWeight: '800' },
  reqBody: { padding: 14 },
  reqHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reqRef: { color: UI.text3, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  reqTitle: { color: UI.text, fontSize: 16, fontWeight: '800', marginTop: 2, letterSpacing: -0.2 },
  reqCustomer: { color: UI.text2, fontSize: 12, marginTop: 4 },
  payPill: { alignItems: 'flex-end', backgroundColor: UI.greenLight, borderColor: UI.greenLine, borderWidth: 1, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7 },
  payLabel: { color: UI.greenText, fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  pay: { color: UI.greenText, fontSize: 15, fontWeight: '800', marginTop: 1 },
  reqMetaRow: { flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' },
  reqMeta: { color: UI.text2, fontSize: 12, fontWeight: '500' },
  reqDesc: { color: UI.text3, fontSize: 12, marginTop: 6, lineHeight: 17 },

  /* Countdown timer row */
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12, backgroundColor: UI.bg, borderRadius: 12, padding: 10 },
  ringWrap: { alignItems: 'center' },
  ringSize: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  ringTrack: { position: 'absolute', width: 42, height: 42, borderRadius: 21, borderWidth: 3 },
  ringFill: { position: 'absolute', width: 42, height: 42, borderRadius: 21, borderWidth: 3 },
  ringText: { fontSize: 10, fontWeight: '800' },
  ringLabel: { fontSize: 8.5, fontWeight: '600', marginTop: 3 },
  timerCopy: { flex: 1 },
  timerHint: { color: UI.text2, fontSize: 11.5, fontWeight: '600' },
  timerUrgency: { fontSize: 10.5, fontWeight: '600', marginTop: 3 },

  /* Expanded details */
  reqDetails: { marginTop: 12, borderTopWidth: 1, borderTopColor: UI.bd, paddingTop: 10, gap: 8 },
  detailRowInline: { flexDirection: 'row', gap: 10 },
  detailKey: { color: UI.text3, fontSize: 11, fontWeight: '600', width: 70 },
  detailValue: { color: UI.text, fontSize: 11.5, fontWeight: '600', flex: 1 },
  expandRow: { marginTop: 10, alignItems: 'flex-end' },
  expandText: { fontSize: 12, fontWeight: '700' },

  /* Actions */
  reqActions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1 },
  declineBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: UI.bd2, backgroundColor: UI.bg },
  declineText: { color: UI.text2, fontSize: 12, fontWeight: '700' },
  acceptBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  acceptText: { color: theme.colors.white, fontSize: 13, fontWeight: '700' },
  openText: { color: UI.blueText, fontSize: 13, fontWeight: '700' },
  busyBtn: { opacity: 0.6 },

  showMore: { alignSelf: 'center', marginVertical: 14, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: UI.surface, borderWidth: 1, borderColor: UI.bd },
  showMoreText: { color: UI.blueText, fontSize: 12.5, fontWeight: '700' },

  empty: { alignItems: 'center', paddingHorizontal: 22 },
  emptyTitle: { color: UI.text, fontSize: 18, fontWeight: '700' },
  emptyCopy: { color: UI.text2, fontSize: 14, textAlign: 'center', marginTop: 8 },
  error: { color: UI.red, paddingHorizontal: 18, marginBottom: 6 },
  errorBlock: { paddingBottom: 8 },
  verificationButton: {
    alignSelf: 'flex-start',
    marginHorizontal: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: UI.blueLight,
  },
  verificationButtonText: { color: UI.blueText, fontSize: 12, fontWeight: '700' },
  loader: { marginTop: 70 },
  sectionStatus: { color: UI.text2, fontSize: 12, marginBottom: 10 },
  currentJobHeading: { fontSize: 17, fontWeight: '800', color: UI.text, marginBottom: 8 },
  partnerStatus: { color: UI.text2, fontSize: 12, marginBottom: 10 },
  currentJobBanner: { padding: 14, marginBottom: 12, backgroundColor: UI.blueLight, borderColor: UI.blueLine, borderWidth: 1, borderRadius: 14 },
  currentJobEyebrow: { color: UI.blueText, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  currentJobTitle: { color: UI.text, fontSize: 15, fontWeight: '800', marginTop: 5 },
  currentJobMeta: { color: UI.text2, fontSize: 11, marginTop: 4, lineHeight: 16 },

  /* Active mode */
  secTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: UI.text, marginTop: 14, marginBottom: 8, textTransform: 'uppercase' },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  rsGrid: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  rsCard: { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4, alignItems: 'center' },
  rsRing: { width: 30, height: 30, marginBottom: 6, alignItems: 'center', justifyContent: 'center' },
  rsRingTrack: { position: 'absolute', width: 30, height: 30, borderRadius: 15, borderWidth: 3 },
  rsRingFill: { position: 'absolute', width: 30, height: 30, borderRadius: 15, borderWidth: 3 },
  rsN: { fontSize: 12, fontWeight: '800', letterSpacing: -0.3 },
  rsL: { fontSize: 9.5, fontWeight: '600', textAlign: 'center' },
  jobRow: { color: UI.text2, fontSize: 12, marginTop: 7 },
  scheduleBlock: { backgroundColor: UI.surface, borderWidth: 1, borderColor: UI.bd, borderRadius: 14, paddingHorizontal: 14 },
  schItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  schTimeWrap: { width: 62, flexShrink: 0 },
  schTime: { fontSize: 12, fontWeight: '800', color: UI.text },
  schSub: { fontSize: 10, color: UI.text3, fontWeight: '500' },
  schTitle: { fontSize: 13, fontWeight: '700', color: UI.text },
  schMeta: { fontSize: 11, color: UI.text2, marginTop: 2 },
  rowLastBorder: { borderBottomWidth: 1, borderBottomColor: UI.bd },
  metricsGrid: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  metricCard: { flex: 1, minWidth: 0, minHeight: 76, paddingHorizontal: 4, paddingVertical: 9, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 6 },
  metricValue: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  metricLabel: { fontSize: 9, fontWeight: '600', textAlign: 'center' },
  supportingError: { color: UI.red, fontSize: 12, marginBottom: 8 },
  recommendationCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 16, marginBottom: 14, borderRadius: 999, borderWidth: 1, borderColor: UI.bd, backgroundColor: UI.surface },
  recommendationIcon: { color: UI.blueText, fontSize: 16 },
  recommendationText: { flex: 1, color: UI.text2, fontSize: 11, fontWeight: '700' },
  recommendationStatus: { color: UI.amberText2, fontSize: 10, fontWeight: '800' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 8 },
  sectionTitle: { color: UI.text, fontSize: 17, fontWeight: '800' },
  sectionCount: { color: UI.text2, fontSize: 12, fontWeight: '700' },
  activeJobCard: {
    padding: 16,
    marginBottom: 14,
    backgroundColor: UI.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: UI.bd,
    borderLeftWidth: 4,
    borderLeftColor: UI.blue,
  },
  activeJobHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  activeJobHeading: { flex: 1 },
  activeJobTitle: { color: UI.text, fontSize: 15, fontWeight: '800' },
  activeJobRef: { color: UI.text2, fontSize: 11, marginTop: 4, textTransform: 'capitalize' },
  inProgressBadge: { color: UI.blueText, backgroundColor: UI.blueLight, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, fontSize: 10, fontWeight: '800', overflow: 'hidden' },
  activeJobMeta: { color: UI.text2, fontSize: 12, marginTop: 10 },
  activeJobFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  jobPay: { color: UI.blueText, fontSize: 14, fontWeight: '800' },
  emptyActiveCard: { alignItems: 'flex-start', padding: 16, marginBottom: 14, backgroundColor: UI.surface, borderRadius: 12, borderWidth: 1, borderColor: UI.bd },
  browseButton: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: UI.blue },
  browseButtonText: { color: theme.colors.white, fontSize: 12, fontWeight: '700' },
  scheduleCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, marginBottom: 8, backgroundColor: UI.surface, borderRadius: 12, borderWidth: 1, borderColor: UI.bd },
  scheduleMarker: { width: 10, height: 10, borderRadius: 5, backgroundColor: UI.blue },
  scheduleCopy: { flex: 1 },
  scheduleTitle: { color: UI.text, fontSize: 13, fontWeight: '700' },
  scheduleMeta: { color: UI.text2, fontSize: 11, marginTop: 4, textTransform: 'capitalize' },
  scheduleStatus: { color: UI.blueText, fontSize: 10, fontWeight: '800' },
  scheduleEmpty: { padding: 16, marginBottom: 8, backgroundColor: UI.surface, borderRadius: 12, borderWidth: 1, borderColor: UI.bd },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
