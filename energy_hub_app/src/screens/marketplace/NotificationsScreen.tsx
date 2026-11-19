import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { AppHeader, goBackOrHome } from '../../components/AppHeader';
import { registerThemeStyles, theme } from '../../components/theme';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import { apiService } from '../../services/api';

interface Notification {
  id: string | number;
  title?: string;
  body?: string;
  isRead?: boolean;
  createdAt?: string;
  jobId?: number | string;
}

interface NotificationsScreenProps {
  navigation: any;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({ navigation }) => {
  const { colors } = useUserPreferences();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | number | null>(null);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiService.listNotifications();
      setNotifications(response.data || []);
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || 'Could not load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const unreadCount = notifications.filter((item) => !item.isRead).length;
  const visibleNotifications = filter === 'unread'
    ? notifications.filter((item) => !item.isRead)
    : notifications;

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

  const openNotification = async (item: Notification) => {
    setWorkingId(item.id);
    setError('');
    try {
      if (!item.isRead) {
        await apiService.markNotificationRead(item.id);
        setNotifications((current) => current.map((notification) => (
          notification.id === item.id ? { ...notification, isRead: true } : notification
        )));
      }
      if (item.jobId) {
        const response = await apiService.getJob(item.jobId);
        if (response.data) openJob(response.data);
      }
    } catch (openError: any) {
      setError(openError.response?.data?.message || 'Could not open this notification. Please try again.');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title="Notifications"
        subtitle={unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'You are all caught up'}
        onBack={() => goBackOrHome(navigation)}
      />
      <View style={styles.filterRow}>
        {(['all', 'unread'] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === value }}
            onPress={() => setFilter(value)}
            style={[
              styles.filter,
              { borderColor: filter === value ? colors.primary : colors.border, backgroundColor: filter === value ? colors.primaryLight : colors.surface },
            ]}
          >
            <Text style={[styles.filterText, { color: filter === value ? colors.primary : colors.secondaryText }]}>
              {value === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
            </Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh notifications"
          onPress={() => { void loadNotifications(); }}
          style={styles.refresh}
        >
          <Ionicons name="refresh-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>
      {error ? (
        <Pressable onPress={() => { void loadNotifications(); }} style={[styles.errorCard, { backgroundColor: colors.surface }]}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={[styles.retryText, { color: colors.primary }]}>Tap to retry</Text>
        </Pressable>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {visibleNotifications.length ? visibleNotifications.map((item) => {
            const busy = workingId === item.id;
            return (
              <Pressable
                key={String(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`${item.isRead ? 'Read' : 'Unread'} notification: ${item.title || item.body || 'Partner update'}`}
                onPress={() => { void openNotification(item); }}
                disabled={workingId !== null}
                style={[
                  styles.notification,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  !item.isRead && { borderLeftColor: colors.primary, borderLeftWidth: 4 },
                ]}
              >
                <View style={[styles.icon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name={item.isRead ? 'notifications-outline' : 'notifications'} size={19} color={colors.primary} />
                </View>
                <View style={styles.copy}>
                  <Text style={[styles.title, { color: colors.text }]}>{item.title || 'Partner account update'}</Text>
                  {item.body ? <Text style={[styles.body, { color: colors.secondaryText }]}>{item.body}</Text> : null}
                  <Text style={[styles.date, { color: colors.secondaryText }]}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recent'}
                    {item.jobId ? ' · View job' : ''}
                  </Text>
                </View>
                {busy ? <ActivityIndicator size="small" color={colors.primary} /> : (
                  <Ionicons name="chevron-forward" size={18} color={colors.secondaryText} />
                )}
              </Pressable>
            );
          }) : (
            <View style={[styles.empty, { backgroundColor: colors.surface }]}>
              <Ionicons name="checkmark-done-outline" size={30} color={colors.primary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </Text>
              <Text style={[styles.emptyCopy, { color: colors.secondaryText }]}>
                Updates about jobs and payouts will appear here.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const build_styles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
  filter: { borderWidth: 1, borderRadius: theme.borderRadius.pill, paddingHorizontal: 14, paddingVertical: 8 },
  filterText: { fontSize: 12, fontWeight: '700' },
  refresh: { marginLeft: 'auto', padding: 8 },
  list: { paddingHorizontal: theme.spacing.lg, paddingBottom: 112, gap: theme.spacing.sm },
  notification: { flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, gap: theme.spacing.sm },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  date: { fontSize: 11, marginTop: 7 },
  empty: { alignItems: 'center', borderRadius: theme.borderRadius.lg, padding: theme.spacing.xl, marginTop: theme.spacing.xl },
  emptyTitle: { fontSize: 15, fontWeight: '700', marginTop: theme.spacing.md },
  emptyCopy: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  loader: { marginTop: 56 },
  errorCard: { marginHorizontal: theme.spacing.lg, padding: theme.spacing.md, borderRadius: theme.borderRadius.md },
  errorText: { color: theme.colors.error, fontSize: 13 },
  retryText: { fontSize: 12, fontWeight: '700', marginTop: 5 },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
