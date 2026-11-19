import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { registerThemeStyles, theme } from '../../components/theme';
import { useAuth } from '../../providers/AuthProvider';
import { apiService } from '../../services/api';
import { SectionHeader } from './SectionHeader';
import { PartnerHeaderIcon } from '../../navigation/PartnerNavigationBar';
import { ProfileAvatarButton } from '../../components/AppHeader';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface RoleBasedDashboardProps {
  navigation: any;
}

export const RoleBasedDashboard: React.FC<RoleBasedDashboardProps> = ({ navigation }) => {
  const { user, login, previewRole } = useAuth();
  const { avatarUri, colors } = useUserPreferences();
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [notificationsError, setNotificationsError] = useState('');
  const [roleAccounts, setRoleAccounts] = useState<Array<{ role: string; status: string; userId: number }>>([]);
  const [switchingRole, setSwitchingRole] = useState('');
  const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);

  const loadDashboard = async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const [dashboardResult, recommendationsResult] = await Promise.allSettled([
        apiService.getDashboardData(),
        apiService.listOpenJobs(),
      ]);
      if (dashboardResult.status === 'rejected') throw dashboardResult.reason;
      setDashboard(dashboardResult.value.data);
      setRecommendedJobs(recommendationsResult.status === 'fulfilled' ? recommendationsResult.value.data || [] : []);
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || 'Could not load your dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadNotifications = useCallback(async () => {
    setNotificationsError('');
    try {
      const response = await apiService.listNotifications();
      setNotifications(response.data || []);
      setNotificationsLoaded(true);
    } catch (notificationLoadError: any) {
      setNotificationsError(notificationLoadError.response?.data?.message || 'Could not refresh the unread count.');
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Multi-role accounts get a switcher chip in the header (hidden when only one role exists).
  useEffect(() => {
    let active = true;
    apiService.getProfile()
      .then((response) => {
        if (!active) return;
        const accounts = (response.data?.roleAccounts || []) as Array<{ role: string; status: string; userId: number }>;
        setRoleAccounts(accounts.filter((account) => account.status === 'approved'));
      })
      .catch(() => { /* header chips are optional; ignore profile errors */ });
    return () => { active = false; };
  }, []);

  const switchRole = async (role: string) => {
    if (role === user?.role || switchingRole) return;
    setSwitchingRole(role);
    setError('');
    try {
      const result = await apiService.switchPartnerRole(role);
      await login(result.data.token, { ...user!, ...result.data.user, token: result.data.token, refreshToken: user?.refreshToken || '' });
      navigation.replace('Home');
    } catch (switchError: any) {
      setError(switchError.response?.data?.message || 'Could not switch partner role.');
    } finally {
      setSwitchingRole('');
    }
  };

  useFocusEffect(useCallback(() => {
    void loadNotifications();
  }, [loadNotifications]));

  const role = previewRole || dashboard?.role || user?.role || 'service_partner';
  const roleTitle = theme.roleLabels[role] || 'Partner';
  const profile = dashboard?.profile || {};
  const stats = dashboard?.stats || {};
  const activeJobs = dashboard?.activeJobs || [];
  const sortedActiveJobs = useMemo(() => {
    const now = Date.now();
    return [...activeJobs].sort((left: any, right: any) => {
      const time = (job: any) => new Date(job.scheduledAt || job.startedAt || job.createdAt || 0).getTime();
      const leftTime = time(left);
      const rightTime = time(right);
      const leftRunning = !left.scheduledAt || leftTime <= now;
      const rightRunning = !right.scheduledAt || rightTime <= now;
      if (leftRunning !== rightRunning) return leftRunning ? -1 : 1;
      return leftTime - rightTime;
    });
  }, [activeJobs]);
  const isOnline = !!profile.isOnline;
  const currentJob = sortedActiveJobs[0];

  const toggleAvailability = async () => {
    if (previewRole && previewRole !== user?.role) {
      setError('Availability cannot be changed while previewing another role.');
      return;
    }
    setWorking(true);
    setError('');
    try {
      const response = await apiService.setOnlineStatus(!isOnline);
      setDashboard((current: any) => ({
        ...current,
        profile: { ...current?.profile, ...response.data },
      }));
    } catch (statusError: any) {
      setError(statusError.response?.data?.message || 'Could not update availability.');
    } finally {
      setWorking(false);
    }
  };

  const unreadCount = notificationsLoaded
    ? notifications.filter((notification) => !notification.isRead).length
    : Number(stats.unreadNotifications || 0);
  const activeJobsCount = activeJobs.length;
  const greeting = 'Good day,';
  const partnerName = profile.fullName || profile.name || profile.businessName || user?.mobile || 'Partner';

  const openMyWork = () => {
    if (role === 'repairing_partner' || role === 'panel_maker') {
      navigation.navigate('Workshop', {
        mode: role === 'panel_maker' ? 'panel' : 'repair',
        tab: 'queue',
      });
      return;
    }
    navigation.navigate('Jobs', { mode: 'mine' });
  };

  const openJob = (job: any) => {
    if (job.jobType === 'delivery') {
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

  const openRecommendations = () => {
    if (role === 'panel_maker' || role === 'repairing_partner') {
      navigation.navigate('Workshop', { mode: role === 'panel_maker' ? 'panel' : 'repair', tab: 'requests' });
      return;
    }
    if (role === 'supplier') {
      navigation.navigate('SupplierCatalog');
      return;
    }
    navigation.navigate('Jobs', { mode: 'open' });
  };

  const refresh = () => {
    void loadDashboard(true);
    void loadNotifications();
  };

  const overviewTitle = role === 'repairing_partner'
    ? 'Workshop overview'
    : role === 'panel_maker'
      ? 'Panel work overview'
      : role === 'supplier'
        ? 'Catalog overview'
        : 'Service work overview';
  const overviewIcon: React.ComponentProps<typeof Ionicons>['name'] = role === 'repairing_partner'
    ? 'construct-outline'
    : role === 'panel_maker'
      ? 'hardware-chip-outline'
      : role === 'supplier'
        ? 'storefront-outline'
        : 'flash-outline';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} colors={[theme.colors.primary]} tintColor={theme.colors.primary} />
        }
      >
        <View style={[styles.hero, { backgroundColor: colors.primary, borderBottomColor: colors.primaryLight }]}>
          <View style={styles.heroTop}>
            <View style={styles.heroCopy}>
              <Text style={styles.greeting}>{greeting}</Text>
              <Text style={styles.partnerName} numberOfLines={1}>{partnerName}</Text>
              <Text style={styles.roleLabel}>{roleTitle}{profile.city ? ` · ${profile.city}` : ''}</Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.notificationButton}
                onPress={() => navigation.navigate('Notifications')}
                accessibilityRole="button"
                accessibilityLabel={`Notifications, ${unreadCount} unread`}
              >
                <PartnerHeaderIcon name="bell" color={theme.colors.white} />
                {unreadCount > 0 ? (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              <ProfileAvatarButton
                uri={avatarUri}
                initial={partnerName.charAt(0).toUpperCase()}
                onPress={() => navigation.navigate('PartnerProfile')}
                accessibilityLabel="Open partner profile"
                backgroundColor={colors.primary}
                initialColor={theme.colors.white}
                iconColor={theme.colors.white}
              />
            </View>
          </View>
          {roleAccounts.length > 1 ? (
            <View style={styles.roleSwitchRow}>
              {roleAccounts.map((account) => {
                const active = account.role === role;
                return (
                  <TouchableOpacity
                    key={`${account.userId}-${account.role}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    disabled={active || !!switchingRole}
                    onPress={() => void switchRole(account.role)}
                    style={[styles.roleChip, active && styles.roleChipActive]}
                  >
                    <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>
                      {switchingRole === account.role ? 'Switching…' : theme.roleLabels[account.role] || account.role}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}
          <View style={styles.availability}>
            <View style={styles.availabilityCopy}>
              <Text style={styles.availabilityTitle}>{isOnline ? 'You are online' : 'You are offline'}</Text>
              <Text style={styles.availabilitySubtitle}>
                {profile.isBusy ? 'On a job · finish current work before changing availability' : 'Tap the status button to switch availability'}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="switch"
              accessibilityLabel={isOnline ? 'Go offline' : 'Go online'}
              accessibilityState={{ checked: isOnline, disabled: working || !!profile.isBusy }}
              activeOpacity={theme.interaction.pressedOpacity}
              disabled={working || !!profile.isBusy}
              onPress={toggleAvailability}
              style={styles.availabilityToggleButton}
            >
              <View style={[styles.toggleTrack, isOnline ? styles.toggleTrackOn : styles.toggleTrackOff]}>
                {working ? (
                  <ActivityIndicator size="small" color={isOnline ? theme.colors.white : colors.primary} />
                ) : (
                  <View style={[styles.toggleThumb, isOnline ? styles.toggleThumbOn : styles.toggleThumbOff]} />
                )}
              </View>
              <Text style={[styles.toggleLabel, isOnline ? styles.toggleLabelOn : styles.toggleLabelOff]}>
                {working ? 'Saving…' : isOnline ? 'Online' : 'Offline'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {previewRole && previewRole !== user?.role ? (
          <View style={styles.previewNotice}>
            <Text style={styles.previewTitle}>Role preview</Text>
            <Text style={styles.previewText}>
              You are viewing {roleTitle}. This is a preview only; log in with an account approved for this role to access its real data and actions.
            </Text>
          </View>
        ) : null}

        {error ? (
          <TouchableOpacity onPress={() => loadDashboard()} style={styles.errorCard} accessibilityRole="button">
            <Text style={styles.errorTitle}>Dashboard could not be refreshed</Text>
            <Text style={styles.errorText}>{error} Tap to try again.</Text>
          </TouchableOpacity>
        ) : null}

        {loading && !dashboard ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading your workspace…</Text>
          </View>
        ) : (
          <>
            {notificationsError ? (
              <Text accessibilityRole="alert" style={styles.notificationLoadError}>
                Unread count could not be refreshed. Open notifications to try again.
              </Text>
            ) : null}

            <SectionHeader title={overviewTitle} subtitle={`${activeJobsCount} active ${activeJobsCount === 1 ? 'item' : 'items'}`} />
            <TouchableOpacity style={styles.overviewCard} onPress={role === 'supplier' ? openRecommendations : openMyWork} accessibilityRole="button">
              <View style={[styles.overviewIcon, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name={overviewIcon} size={22} color={colors.primary} />
              </View>
              <View style={styles.overviewCopy}>
                <Text style={styles.overviewTitle}>
                  {currentJob
                    ? currentJob.title || currentJob.equipment || currentJob.referenceId
                    : role === 'supplier'
                      ? 'Manage products and stock'
                      : 'No work currently active'}
                </Text>
                <Text style={styles.overviewMeta}>
                  {currentJob
                    ? [currentJob.referenceId, currentJob.stage?.replaceAll('_', ' '), currentJob.status].filter(Boolean).join(' · ')
                    : role === 'supplier'
                      ? 'Open your catalog to update listings'
                      : 'Matched recommendations are shown below'}
                </Text>
              </View>
              <Text style={styles.overviewChevron}>›</Text>
            </TouchableOpacity>

            <SectionHeader
              title="Recommended for you"
              subtitle={role === 'supplier' ? 'Your role uses product listings' : `${recommendedJobs.length} matched to your approved expertise`}
              actionLabel={role === 'supplier' ? 'Open catalog' : recommendedJobs.length > 3 ? 'View all' : undefined}
              onAction={openRecommendations}
            />
            {role === 'supplier' ? (
              <TouchableOpacity style={styles.emptyCard} onPress={openRecommendations} accessibilityRole="button">
                <Text style={styles.emptyTitle}>Recommendations come through your catalog</Text>
                <Text style={styles.emptyCopy}>Keep product categories, brands, price and stock updated to receive relevant orders.</Text>
              </TouchableOpacity>
            ) : recommendedJobs.length ? recommendedJobs.slice(0, 3).map((job: any) => (
              <TouchableOpacity key={String(job.id)} style={styles.workCard} onPress={() => openJob(job)} accessibilityRole="button">
                <View style={styles.workCardTop}>
                  <Text style={styles.workCardRef}>{job.referenceId || `JOB-${job.id}`}</Text>
                  <Text style={styles.workCardPay}>₹{Number(job.basePay || job.serviceCharge || 0).toLocaleString('en-IN')}</Text>
                </View>
                <Text style={styles.workCardTitle}>{job.title || job.equipment || 'Matched request'}</Text>
                <Text style={styles.workCardMeta}>{[job.category, job.brand, job.siteArea].filter(Boolean).join(' · ') || 'Details available in the request'}</Text>
              </TouchableOpacity>
            )) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No matched recommendations now</Text>
                <Text style={styles.emptyCopy}>Only work relevant to your approved role and specializations appears here.</Text>
              </View>
            )}

            <SectionHeader
              title="Current & next job"
              subtitle={`Showing up to 3 of ${activeJobsCount}`}
              actionLabel={activeJobsCount > 3 ? 'View all' : undefined}
              onAction={openMyWork}
            />
            {sortedActiveJobs.length ? sortedActiveJobs.slice(0, 3).map((job: any, index: number) => (
              <TouchableOpacity key={String(job.id)} style={styles.currentJobCard} onPress={() => openJob(job)} accessibilityRole="button">
                <Text style={styles.currentJobEyebrow}>{index === 0 ? 'CURRENT JOB' : 'NEXT JOB'}</Text>
                <Text style={styles.currentJobTitle}>{job.title || job.equipment || job.referenceId || `Job ${job.id}`}</Text>
                <Text style={styles.currentJobMeta}>{job.referenceId || `JOB-${job.id}`} · {job.stage?.replaceAll('_', ' ') || job.status}</Text>
                <Text style={styles.currentJobMeta}>{job.scheduledAt ? new Date(job.scheduledAt).toLocaleString() : job.startedAt ? `Started ${new Date(job.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Schedule pending'}</Text>
              </TouchableOpacity>
            )) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No current or upcoming work</Text>
                <Text style={styles.emptyCopy}>Accept a matched request to see it here.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const build_styles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  scroll: { flex: 1 },
  content: { paddingBottom: 112 },
  hero: {
    backgroundColor: theme.colors.primaryDark,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    borderBottomLeftRadius: theme.borderRadius.lg,
    borderBottomRightRadius: theme.borderRadius.lg,
    borderBottomWidth: 3,
    borderBottomColor: theme.colors.accent,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroCopy: { flex: 1, marginRight: theme.spacing.md },
  greeting: { color: theme.colors.onBrandSoft, fontSize: 12 },
  partnerName: { color: theme.colors.white, fontSize: 20, fontWeight: '800', marginTop: 1 },
  roleLabel: { color: theme.colors.onBrandSoft, fontSize: 11, marginTop: 2 },
  roleSwitchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: theme.spacing.sm },
  roleChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.onBrandSoft, backgroundColor: 'rgba(255,255,255,0.12)' },
  roleChipActive: { backgroundColor: theme.colors.white },
  roleChipText: { color: theme.colors.white, fontSize: 11.5, fontWeight: '700' },
  roleChipTextActive: { color: theme.colors.primaryDark },
  previewNotice: { marginHorizontal: theme.spacing.lg, marginTop: theme.spacing.md, padding: theme.spacing.md, backgroundColor: theme.colors.warningLight, borderRadius: theme.borderRadius.md },
  previewTitle: { color: theme.colors.warningDark, fontSize: 12, fontWeight: '700' },
  previewText: { color: theme.colors.warningDark, fontSize: 11, lineHeight: 16, marginTop: 3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  notificationButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  notificationBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.error,
    borderWidth: 1,
    borderColor: theme.colors.primaryDark,
  },
  notificationBadgeText: { color: theme.colors.white, fontSize: 9, lineHeight: 12, fontWeight: '700' },
  availability: {
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  availabilityCopy: { flex: 1 },
  availabilityTitle: { color: theme.colors.mainText, fontSize: 13, fontWeight: '700' },
  availabilitySubtitle: { color: theme.colors.secondaryText, fontSize: 10, lineHeight: 13, marginTop: 1 },
  availabilityToggleButton: { minWidth: 74, flexShrink: 0, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  toggleTrack: { width: 48, height: 28, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center' },
  toggleTrackOn: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  toggleTrackOff: { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.borderStrong },
  toggleThumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10, top: 2.5, backgroundColor: theme.colors.white, ...theme.elevation.low },
  toggleThumbOn: { right: 3 },
  toggleThumbOff: { left: 3 },
  toggleLabel: { fontSize: 10.5, fontWeight: '800', marginTop: 4 },
  toggleLabelOn: { color: theme.colors.successDark },
  toggleLabelOff: { color: theme.colors.secondaryText },
  overviewCard: { marginHorizontal: theme.spacing.lg, padding: theme.spacing.md, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.lg },
  overviewIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing.md },
  overviewCopy: { flex: 1 },
  overviewTitle: { color: theme.colors.mainText, fontSize: 15, fontWeight: '800' },
  overviewMeta: { color: theme.colors.secondaryText, fontSize: 11, lineHeight: 16, marginTop: 3, textTransform: 'capitalize' },
  overviewChevron: { color: theme.colors.secondaryText, fontSize: 24, marginLeft: 8 },
  workCard: { marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.sm, padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.lg },
  workCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  workCardRef: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '700' },
  workCardPay: { color: theme.colors.successDark, fontSize: 13, fontWeight: '800' },
  workCardTitle: { color: theme.colors.mainText, fontSize: 14, fontWeight: '800' },
  workCardMeta: { color: theme.colors.secondaryText, fontSize: 11, lineHeight: 16, marginTop: 4 },
  currentJobCard: { marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.sm, padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.primary, borderLeftWidth: 4, borderRadius: theme.borderRadius.lg },
  currentJobEyebrow: { color: theme.colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
  currentJobTitle: { color: theme.colors.mainText, fontSize: 16, fontWeight: '800', marginTop: 5 },
  currentJobMeta: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 18, marginTop: 5 },
  notificationLoadError: { color: theme.colors.errorDark, fontSize: 11, marginHorizontal: theme.spacing.lg, marginBottom: theme.spacing.sm },
  errorCard: { margin: theme.spacing.md, padding: theme.spacing.md, backgroundColor: theme.colors.errorLight, borderRadius: theme.borderRadius.md },
  errorTitle: { color: theme.colors.errorDark, fontSize: 13, fontWeight: '700' },
  errorText: { color: theme.colors.errorDark, fontSize: 12, marginTop: 4 },
  loading: { paddingVertical: theme.spacing.xl, alignItems: 'center' },
  loadingText: { color: theme.colors.secondaryText, fontSize: 13, marginTop: theme.spacing.sm },
  emptyCard: { marginHorizontal: theme.spacing.lg, padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md },
  emptyTitle: { color: theme.colors.mainText, fontSize: 14, fontWeight: '700' },
  emptyCopy: { color: theme.colors.secondaryText, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
