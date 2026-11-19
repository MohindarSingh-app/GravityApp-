import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { dashboardApi, notificationApi } from '../../../api/resources';
import { Banner } from '../../../components/Banner';
import { EmptyState } from '../../../components/EmptyState';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { SkeletonDashboard } from '../../../components/Skeleton';
import { ErrorState } from '../../../components/ui/ErrorState';
import { OfflineBanner } from '../../../components/ui/OfflineBanner';
import { Avatar } from '../../../components/ui/Avatar';
import { JobCard } from '../../../components/ui/JobCard';
import { MiniCard } from '../../../components/ui/MiniCard';
import { SearchBar } from '../../../components/ui/SearchBar';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { useCatalog } from '../../../flows/useCatalog';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../theme/ThemeContext';
import { CATEGORY_TONES, toneInk } from '../../../theme/tokens';
import { getErrorMessage } from '../../../utils/errors';
import { avatarUri } from '../../../utils/avatar';
import {
  boardSearch,
  jobStatusLabel,
  operationMetrics,
} from './dashboardView';

const SERVICE_GLYPH = {
  electrician: 'bolt',
  panel_mcc: 'hammer',
  cabling: 'wrench',
  electrical_safety_audit: 'cert',
  vfd_servo: 'spark',
  plc: 'book',
  hmi: 'hmi',
  scada: 'scada',
};

const SERVICE_CATEGORY_LINK = {
  panel: 'panel_mcc',
  plc: 'plc',
  cabling: 'cabling',
  electrician: 'electrician',
  vfd: 'vfd_servo',
  vfd_servo: 'vfd_servo',
  hmi: 'hmi',
  scada: 'scada',
  audit: 'electrical_safety_audit',
  electrical_safety_audit: 'electrical_safety_audit',
};

const JOB_TABS = [
  { id: 'active', label: 'Active' },
  { id: 'done', label: 'Done' },
];

function filterJobs(jobs, tab) {
  if (tab === 'active') {
    return jobs.filter((job) => ['open', 'pending', 'in_progress', 'on_the_way'].includes(job.status));
  }
  if (tab === 'done') {
    return jobs.filter((job) => job.status === 'completed' || job.status === 'done');
  }
  return [];
}

function jobTabCounts(jobs) {
  return {
    active: filterJobs(jobs, 'active').length,
    done: filterJobs(jobs, 'done').length,
  };
}

export function DashboardScreen() {
  const navigation = useNavigation();
  const { user, refreshAccount } = useAuth();
  const { colors, type, radius, space, scheme } = useTheme();
  useCatalog('account_role');
  const [snapshot, setSnapshot] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [jobTab, setJobTab] = useState('active');

  const load = useCallback(async () => {
    setError('');
    try {
      const [board] = await Promise.all([
        dashboardApi.get(),
        refreshAccount().catch(() => null),
      ]);
      setSnapshot(board);
      // Bell badge ke liye unread count alag se — fail ho to badge bas 0 rahega.
      try {
        const inbox = await notificationApi.list();
        const items = (inbox && inbox.notifications) || [];
        setUnreadCount(items.filter((item) => !item.isRead).length);
      } catch (_notifError) {
        setUnreadCount(0);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshAccount]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const retry = () => {
    if (snapshot) setRefreshing(true);
    else setLoading(true);
    load();
  };

  const operations = (snapshot && snapshot.operations) || null;
  const metrics = operationMetrics(operations);
  const certMetric = metrics.find((metric) => metric.id === 'certs');
  const found = boardSearch(operations, query);
  const visibleServices = query.trim() ? found.services : [];
  const activeLiveJob = operations && operations.liveJob;
  const activeLiveJobRecord = activeLiveJob
    ? activeLiveJob.job || (activeLiveJob.jobId
      ? (operations.jobs || []).find((item) => String(item.id) === String(activeLiveJob.jobId))
      : null)
    : null;
  const activeLiveJobDetails = activeLiveJob
    ? [
      activeLiveJobRecord && activeLiveJobRecord.title,
      activeLiveJob.etaMinutes ? `ETA ${activeLiveJob.etaMinutes} min` : '',
      activeLiveJobRecord && activeLiveJobRecord.location || activeLiveJob.location,
    ].filter(Boolean).join(' · ')
    : '';

  const jobsSource = useMemo(() => {
    const base = (operations && operations.jobs) || [];
    return found.jobs.length || query.trim() ? found.jobs : base;
  }, [found.jobs, operations, query]);
  const tabCounts = useMemo(() => jobTabCounts(jobsSource), [jobsSource]);
  const filteredJobs = useMemo(
    () => filterJobs(jobsSource, jobTab).slice(0, 4),
    [jobsSource, jobTab],
  );
  const openJobs = (initialTab = 'active') => navigation.navigate('Jobs', {
    screen: 'JobsList',
    params: { initialTab },
  });
  const openLiveJob = () => {
    const liveJob = operations && operations.liveJob;
    const job = liveJob
      ? liveJob.job || (liveJob.jobId
        ? (operations.jobs || []).find((item) => String(item.id) === String(liveJob.jobId))
        : null)
      : null;
    if (!job) {
      openJobs('active');
      return;
    }
    navigation.navigate('Jobs', {
      screen: 'JobTracking',
      params: {
        jobId: job.id,
        job: {
          ...job,
          etaMinutes: job.etaMinutes || liveJob.etaMinutes,
          location: job.location || liveJob.location || '',
        },
      },
    });
  };

  return (
    <View style={styles.screenRoot}>
    <Screen
      header={(
        <View
          style={[
            styles.dashboardHeader,
            {
              backgroundColor: colors.primary,
              paddingHorizontal: space.screen,
            },
          ]}
        >
          <View pointerEvents="none" style={styles.headerDecoration}>
            <View style={styles.headerGlowLarge} />
            <View style={styles.headerGlowSmall} />
            <View style={styles.headerGlowRing} />
          </View>
          <View style={styles.headerTitle}>
            <View style={styles.headerEyebrow}>
              <View style={styles.headerLiveDot} />
              <Text style={styles.headerEyebrowText}>SERVICE ADMIN</Text>
            </View>
            <Text
              style={[styles.headerHeading, { color: colors.onAccent }]}
              numberOfLines={1}
              accessibilityRole="header"
            >
              {user && (user.fullName || user.name) ? user.fullName || user.name : 'Welcome'}
            </Text>
            <Text style={[styles.headerSubheading, { color: colors.onAccent }]}>
              Your operations at a glance
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              onPress={() => navigation.navigate('Notifications')}
              style={({ pressed }) => [
                styles.notificationButton,
                pressed && styles.headerActionPressed,
              ]}
            >
              <Glyph name="notifications-outline" color={colors.onAccent} size={21} />
              {unreadCount ? (
                <View style={[
                  styles.notificationBadge,
                  { backgroundColor: colors.danger, borderColor: colors.background },
                ]}>
                  <Text style={[styles.notificationBadgeText, { color: colors.onDanger }]}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={user ? `Profile: ${user.fullName || user.name || 'Account'}` : 'Profile'}
              onPress={() => navigation.navigate('ProfileSettings')}
              style={({ pressed }) => [
                styles.profileButton,
                pressed && styles.headerActionPressed,
              ]}
            >
              <Avatar
                name={user && (user.fullName || user.name)}
                uri={avatarUri(user && user.avatarUrl)}
                size={34}
              />
              <View style={[styles.profileStatus, { backgroundColor: colors.accent }]} />
            </Pressable>
          </View>
        </View>
      )}
      headerScroll
      headerColor={colors.primary}
      onRefresh={retry}
      refreshing={refreshing}
      statusBarStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
      contentGap={space.section}
    >
      <SearchBar
        value={query}
        onChangeText={setQuery}
        placeholder="Search services and jobs"
        accessibilityLabel="Search dashboard"
      />
      {error && snapshot ? <Banner message={error} tone="warning" /> : null}
      {snapshot && snapshot.__offline ? (
        <OfflineBanner onRetry={retry} />
      ) : null}
      {loading && !snapshot ? <SkeletonDashboard /> : null}
      {error && !snapshot ? (
        <ErrorState
          title="Something went wrong"
          message={error || 'We could not load the dashboard.'}
          onRetry={retry}
        />
      ) : null}

      {operations ? (
        <>
          {visibleServices.length ? (
            <View style={styles.searchResults}>
              <SectionHeader title="Service results" />
              <View style={styles.categoryGrid}>
                {visibleServices.map((service) => {
                  const categoryCode = SERVICE_CATEGORY_LINK[String(service.code || '').toLowerCase()] || '';
                  const slug = categoryCode || String(service.id || '').toLowerCase();
                  return (
                    <MiniCard
                      key={service.id || service.name}
                      style={styles.categoryCell}
                      glyph={SERVICE_GLYPH[slug] || 'book'}
                      tone={CATEGORY_TONES[slug] || 'primary'}
                      colorful
                      horizontal
                      iconRight
                      title={service.name}
                      subtitle={service.summary}
                      onPress={() => navigation.navigate('QuickServices', {
                        screen: 'ServiceCategory',
                        params: { categoryCode, query: service.name },
                      })}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Emergency')}
            style={[styles.emergencyStrip, { backgroundColor: colors.danger, borderRadius: radius.md }]}
          >
            <Glyph name="bolt" color={colors.onDanger} size={22} />
            <View style={styles.flex}>
              <Text style={[type.heading, { color: colors.onDanger }]}>Emergency Service</Text>
              <Text style={[type.small, { color: colors.onDanger }]}>Machine down? Request emergency service</Text>
            </View>
            <Glyph name="chevron" color={colors.onDanger} size={18} />
          </Pressable>

          {operations.recommendation ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={operations.recommendation.title}
              onPress={() => navigation.navigate('RepairCenter', {
                screen: 'RepairRecommendation',
                params: { recommendation: operations.recommendation },
              })}
              style={[styles.recommendedStrip, { backgroundColor: colors.warningSurface, borderColor: colors.warning, borderRadius: radius.pill }]}
            >
              <Glyph name="wrench" color={colors.warning} size={17} />
              <View style={styles.flex}>
                <Text style={[type.small, styles.recommendedText, { color: colors.warning }]}>
                  {operations.recommendation.title}
                </Text>
                {operations.recommendation.actorName ? (
                  <Text style={[type.small, { color: colors.warning }]}>
                    {operations.recommendation.actorName}
                  </Text>
                ) : null}
              </View>
              <Glyph name="chevron" color={colors.warning} size={15} />
            </Pressable>
          ) : null}

          {operations.liveJob ? (
            <View style={styles.alertStack}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={[operations.liveJob.title, activeLiveJobDetails].filter(Boolean).join('. ')}
                onPress={openLiveJob}
                style={[styles.alertStrip, { backgroundColor: colors.tealLight, borderRadius: radius.card }]}
              >
                <Glyph name="pin" color={colors.teal} size={18} />
                <View style={styles.flex}>
                  <Text style={type.heading}>{operations.liveJob.title}</Text>
                  <Text style={type.small}>
                    {activeLiveJobDetails || 'Tap to view live job location'}
                  </Text>
                </View>
                <Glyph name="chevron" color={colors.teal} size={16} />
              </Pressable>
            </View>
          ) : null}

          {metrics.length ? (
            <View style={styles.metricSection}>
              <View style={styles.metricHeader}>
                <Text style={[type.heading, { color: colors.text }]}>Status overview</Text>
              </View>
              <View style={styles.metricGrid}>
                {metrics.map((metric) => {
                  const ink = toneInk(colors, metric.tone || 'primary');
                  return (
                    <Pressable
                      key={metric.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${metric.label}: ${metric.value}`}
                      onPress={() => {
                        if (metric.id === 'amc') navigation.navigate('Amc', { screen: 'AmcList' });
                        else if (metric.id === 'certs') navigation.navigate('Compliance');
                        else openJobs('active');
                      }}
                      style={({ pressed }) => [
                        styles.metricCard,
                        {
                          backgroundColor: ink.bg,
                          borderColor: ink.bg,
                          borderRadius: radius.card,
                        },
                        pressed && styles.metricPressed,
                      ]}
                    >
                      <Text style={[type.heading, styles.metricValue, { color: ink.fg }]} numberOfLines={1}>
                        {metric.value}
                      </Text>
                      <Text style={[type.small, styles.metricLabel, { color: ink.fg }]} numberOfLines={2}>
                        {metric.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.actionsSection}>
            <SectionHeader title="Quick Actions" />
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('QuickServices', { screen: 'ServiceCategory' })}
              style={[styles.quickServiceCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary, borderRadius: radius.card }]}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary, borderRadius: radius.md }]}>
                <Glyph name="pin" color={colors.onAccent} size={23} />
              </View>
              <Text style={[type.heading, { color: colors.text }]}>Quick Services</Text>
              <Text style={[type.small, { color: colors.textSecondary }]}>Book a service and view request updates</Text>
              <View style={styles.bookNow}>
                <Text style={[type.label, { color: colors.primary }]}>Book now</Text>
                <Glyph name="chevron" color={colors.primary} size={14} />
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Request AMC coverage"
              onPress={() => navigation.navigate('Amc', {
                screen: 'AmcRequest',
                params: { newRequest: true },
              })}
              style={[styles.protectCard, { backgroundColor: colors.primary, borderRadius: radius.card }]}
            >
              <View style={[styles.recommendBadge, { backgroundColor: colors.surface, borderRadius: radius.pill }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>AMC COVERAGE</Text>
              </View>
              <View style={[styles.protectIcon, { backgroundColor: colors.surface, borderRadius: radius.md }]}>
                <Glyph name="plant" color={colors.primary} size={28} />
              </View>
              <View style={styles.protectCopy}>
                <Text style={[type.heading, { color: colors.textOnPrimary }]}>AMC coverage for your plant</Text>
                <Text style={[type.small, { color: colors.textOnPrimary }]}>
                  Request an AMC quote tailored to your equipment and coverage needs.
                </Text>
                <View style={styles.protectBenefits}>
                  <Text style={[styles.benefitBadge, { color: colors.textOnPrimary }]}>✓ Quote on request</Text>
                  <Text style={[styles.benefitBadge, { color: colors.textOnPrimary }]}>✓ Coverage options</Text>
                </View>
              </View>
              <Glyph name="chevron" color={colors.textOnPrimary} size={18} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('RepairCenter', {
                screen: 'RepairDevice',
                params: { freshFlowKey: Date.now(), recommendedScope: null },
              })}
              style={[styles.promoCard, { backgroundColor: colors.warningSurface, borderColor: colors.warning, borderRadius: radius.card }]}
            >
              <View style={[styles.promoIcon, { backgroundColor: colors.surface, borderRadius: radius.md }]}>
                <Glyph name="box" color={colors.warning} size={26} />
              </View>
              <View style={styles.promoCopy}>
                <View style={styles.promoTitleRow}>
                  <Text style={[type.heading, { color: colors.text }]}>Repair Center</Text>
                  <View style={[styles.badgePill, { backgroundColor: colors.warning }]}>
                    <Text style={[styles.badgeText, { color: colors.onAccent }]}>SEND-IN</Text>
                  </View>
                </View>
                <Text style={[type.small, { color: colors.textSecondary }]}>
                  Send your damaged VFD / PLC / HMI to Gravity Hub workshop for component-level repair
                </Text>
                <Text style={[type.small, { color: colors.warning }]}>✓ 3-7 day turnaround   ✓ GST invoice</Text>
              </View>
              <Glyph name="chevron" color={colors.warning} size={17} />
            </Pressable>

            <View style={styles.actionCardRow}>
              <MiniCard
                style={styles.actionCell}
                glyph="hammer"
                tone="project"
                title="Projects"
                subtitle="New installation"
                onPress={() => navigation.navigate('Projects', { screen: 'ProjectCategory' })}
              />
              <MiniCard
                style={styles.actionCell}
                glyph="box"
                tone="market"
                title="Marketplace"
                subtitle="Buy products"
                onPress={() => navigation.navigate('Marketplace', { screen: 'MarketplaceHome' })}
              />
              <MiniCard
                style={styles.actionCell}
                glyph="document"
                tone="cert"
                title="Compliance"
                subtitle={certMetric
                  ? Number(certMetric.value) > 0 ? `${certMetric.value} expiring soon` : 'No expiring soon'
                  : 'Compliance records'}
                onPress={() => navigation.navigate('Compliance')}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Expert')}
              style={[styles.promoCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary, borderRadius: radius.card }]}
            >
              <View style={[styles.promoIcon, { backgroundColor: colors.surface, borderRadius: radius.md }]}>
                <Glyph name="call" color={colors.primary} size={26} />
              </View>
              <View style={styles.promoCopy}>
                <View style={styles.promoTitleRow}>
                  <Text style={[type.heading, { color: colors.primary }]}>Talk to Expert</Text>
                  <View style={[styles.badgePill, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.badgeText, { color: colors.onAccent }]}>FREE</Text>
                  </View>
                </View>
                <Text style={[type.small, { color: colors.textSecondary }]}>
                  Not sure what to book? Our automation expert will guide you — completely free
                </Text>
                <Text style={[type.small, { color: colors.primary }]}>✓ Free consultation   ✓ No obligation</Text>
              </View>
              <Glyph name="chevron" color={colors.primary} size={17} />
            </Pressable>
          </View>

          <View style={styles.jobsSection}>
            <SectionHeader
              title="Recent Jobs"
              actionLabel={jobsSource.length > 4 ? 'See all' : undefined}
              onAction={jobsSource.length > 4 ? () => openJobs('all') : undefined}
            />
            <SegmentedControl
              tabs={JOB_TABS.map((tab) => ({ ...tab, count: tabCounts[tab.id] }))}
              value={jobTab}
              onChange={setJobTab}
              scrollable
            />
            {filteredJobs.length === 0 ? (
              <EmptyState
                glyph="jobs"
                title={query.trim() ? 'Nothing matches that search' : 'No bookings in this view'}
                message="Your service jobs will appear here."
              />
            ) : filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                title={job.title}
                code={[job.code, job.kind, job.when].filter(Boolean).join(' · ')}
                status={job.status}
                statusLabel={jobStatusLabel(job.status)}
                technician={[job.engineerName, job.specialist, job.rating ? `★ ${job.rating}` : ''].filter(Boolean).join(' · ')}
                location={job.location}
                meta={job.slaLabel || job.amount}
                onPress={() => openJobs('active')}
              />
            ))}
          </View>

        </>
      ) : null}
    </Screen>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="AI Assistance. Ask Gravity Hub AI"
      onPress={() => navigation.navigate('HelpSupport')}
      style={({ pressed }) => [
        styles.aiAssistButton,
        {
          backgroundColor: colors.aiGlass,
          borderColor: colors.primarySoft,
          borderRadius: 999,
          shadowColor: colors.text,
          width: 44,
          height: 44,
        },
        pressed && styles.aiAssistPressed,
      ]}
    >
      <View style={[styles.aiAssistIcon, { backgroundColor: colors.primaryLight }]}>
        <Glyph name="spark" color={colors.aiBlue} size={14} />
      </View>
    </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screenRoot: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dashboardHeader: {
    minHeight: 90,
    paddingTop: 11,
    paddingBottom: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#472015',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 9,
  },
  headerDecoration: {
    ...StyleSheet.absoluteFillObject,
  },
  headerGlowLarge: {
    position: 'absolute',
    width: 188,
    height: 188,
    borderRadius: 94,
    right: -34,
    top: -124,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  headerGlowSmall: {
    position: 'absolute',
    width: 106,
    height: 106,
    borderRadius: 53,
    right: 104,
    bottom: -84,
    backgroundColor: 'rgba(128,35,20,0.10)',
  },
  headerGlowRing: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.13)',
    right: 58,
    bottom: -101,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  headerEyebrow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D8FF9A',
  },
  headerEyebrowText: {
    color: '#FFFFFF',
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '700',
    letterSpacing: 1.05,
  },
  headerHeading: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.55,
  },
  headerSubheading: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    opacity: 0.88,
  },
  notificationButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: 'rgba(255,255,255,0.17)',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
  },
  profileButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.78)',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  profileStatus: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerActionPressed: {
    opacity: 0.84,
    transform: [{ scale: 0.96 }],
  },
  aiAssistButton: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 7,
  },
  aiAssistIcon: {
    width: 25,
    height: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiAssistPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  locationRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  locationPin: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertStack: {
    gap: 8,
  },
  alertStrip: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationText: {
    flex: 1,
  },
  searchResults: {
    gap: 8,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryCell: {
    width: '48%',
    minWidth: 148,
    flexGrow: 1,
    height: 96,
  },
  emergencyStrip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  recommendedStrip: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  recommendedText: {
    flex: 1,
    fontWeight: '700',
  },
  metricSection: {
    gap: 10,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    height: 70,
    paddingHorizontal: 4,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderWidth: 1,
    overflow: 'hidden',
  },
  metricLabel: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 18,
    lineHeight: 22,
  },
  metricPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  actionsSection: {
    gap: 10,
  },
  quickServiceCard: {
    minHeight: 174,
    padding: 14,
    gap: 7,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  liveBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 99,
  },
  actionIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookNow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 1,
  },
  protectCard: {
    minHeight: 136,
    padding: 14,
    paddingTop: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  recommendBadge: {
    position: 'absolute',
    top: 8,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  protectIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  protectCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  protectBenefits: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  benefitBadge: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
  },
  promoCard: {
    minHeight: 102,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
  },
  promoIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoCopy: {
    flex: 1,
    gap: 4,
  },
  promoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCardRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionCell: {
    minWidth: 0,
    flexBasis: 0,
  },
  jobsSection: {
    gap: 10,
  },
});
