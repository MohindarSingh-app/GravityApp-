import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '../../components/AppHeader';
import { registerThemeStyles, theme } from '../../components/theme';
import { apiService } from '../../services/api';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import { useAuth } from '../../providers/AuthProvider';

type Earning = {
  id: string | number;
  jobId?: string | number;
  source?: string;
  netAmount?: number;
  status?: string;
  payoutDate?: string | null;
  createdAt?: string;
  bankReference?: string;
};

type EarningsSummary = {
  totalNet?: number;
  pendingAmount?: number;
  paidAmount?: number;
  counts?: { total?: number; pending?: number; paid?: number };
};

const money = (value: number) => `₹${Math.round(value).toLocaleString('en-IN')}`;

const isWithinDays = (dateValue: string | undefined, days: number, now: number) => {
  if (!dateValue) return false;
  const date = new Date(dateValue).getTime();
  return Number.isFinite(date) && date <= now && date >= now - days * 24 * 60 * 60 * 1000;
};

export const EarningsScreen: React.FC<{ navigation: any }> = () => {
  const { colors } = useUserPreferences();
  const { user, previewRole } = useAuth();
  const role = previewRole || user?.role || 'service_partner';
  const supportsDelivery = role === 'service_partner';
  const workLabel = role === 'repairing_partner'
    ? 'Repair'
    : role === 'panel_maker'
      ? 'Fabrication'
      : role === 'supplier'
        ? 'Product sale'
        : 'Service';
  const [tab, setTab] = useState<'service' | 'delivery'>('service');
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [summary, setSummary] = useState<EarningsSummary>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryResponse, earningsResponse] = await Promise.all([
        apiService.getEarningsSummary(),
        apiService.listEarnings(),
      ]);
      setSummary(summaryResponse.data || {});
      setEarnings(earningsResponse.data || []);
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || 'Could not load earnings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visibleEarnings = useMemo(
    () => earnings.filter((item) => tab === 'delivery' ? item.source === 'delivery' : item.source !== 'delivery'),
    [earnings, tab],
  );
  const now = Date.now();
  const today = visibleEarnings.filter((item) => isWithinDays(item.createdAt, 1, now))
    .reduce((total, item) => total + Number(item.netAmount || 0), 0);
  const week = visibleEarnings.filter((item) => isWithinDays(item.createdAt, 7, now))
    .reduce((total, item) => total + Number(item.netAmount || 0), 0);
  const month = visibleEarnings.filter((item) => isWithinDays(item.createdAt, 30, now))
    .reduce((total, item) => total + Number(item.netAmount || 0), 0);
  const metrics = [
    { label: 'Today', value: money(today), bg: theme.colors.successLight, color: theme.colors.successDark },
    { label: 'This week', value: money(week), bg: theme.colors.primaryLight, color: theme.colors.brandInk },
    { label: 'This month', value: money(month), bg: theme.colors.accentLight, color: theme.colors.accentDark },
    {
      label: tab === 'service' ? 'Pending' : 'Deliveries',
      value: tab === 'service'
        ? money(summary.pendingAmount || 0)
        : String(visibleEarnings.length),
      bg: theme.colors.warningLight,
      color: theme.colors.warningDark,
    },
  ];
  const recent = [...visibleEarnings].sort(
    (left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime(),
  );
  const paid = recent.filter((item) => item.status === 'paid');

  if (loading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} style={styles.loader} /></SafeAreaView>;
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Earnings" subtitle={`${workLabel} payout ledger`} />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        {error ? (
          <TouchableOpacity onPress={load} style={styles.errorCard} accessibilityRole="button">
            <Text style={styles.error}>{error}</Text>
            <Text style={styles.retry}>Tap to retry</Text>
          </TouchableOpacity>
        ) : null}

        {supportsDelivery ? (
          <View style={styles.tabBar}>
            <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: tab === 'service' }} style={[styles.tabBtn, tab === 'service' && styles.tabActive]} onPress={() => setTab('service')}>
              <Text style={[styles.tabLabel, tab === 'service' && styles.tabLabelActive]}>Service</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: tab === 'delivery' }} style={[styles.tabBtn, tab === 'delivery' && styles.tabActive]} onPress={() => setTab('delivery')}>
              <Text style={[styles.tabLabel, tab === 'delivery' && styles.tabLabelActive]}>Delivery</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.metricsGrid}>
          {metrics.map((metric) => (
            <View key={metric.label} style={[styles.metricCard, { backgroundColor: metric.bg }]}>
              <View style={[styles.metricRing, { borderTopColor: metric.color }]} />
              <Text style={[styles.metricValue, { color: metric.color }]} numberOfLines={1}>{metric.value}</Text>
              <Text style={[styles.metricLabel, { color: metric.color }]}>{metric.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>{tab === 'delivery' ? 'RECENT DELIVERIES' : `RECENT ${workLabel.toUpperCase()} PAYOUTS`}</Text>
        <View style={styles.listCard}>
          {recent.length ? recent.map((item, index) => (
            <View key={String(item.id)} style={[styles.listRow, index === recent.length - 1 && styles.lastRow]}>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>{item.source === 'delivery' ? 'Delivery payout' : `${workLabel} payout`}</Text>
                <Text style={styles.listSub}>
                  {item.jobId ? `Job #${item.jobId}` : 'Job payout'}
                  {item.createdAt ? ` · ${new Date(item.createdAt).toLocaleDateString()}` : ''}
                </Text>
              </View>
              <Text style={styles.listAmount}>+{money(Number(item.netAmount || 0))}</Text>
            </View>
          )) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No {tab === 'delivery' ? 'delivery' : workLabel.toLowerCase()} earnings yet</Text>
              <Text style={styles.emptyCopy}>Completed work and its payout will appear here.</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>PAYOUT HISTORY</Text>
        <View style={styles.listCard}>
          {paid.length ? paid.map((item, index) => (
            <View key={String(item.id)} style={[styles.listRow, index === paid.length - 1 && styles.lastRow]}>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>Payout transferred</Text>
                <Text style={styles.listSub}>
                  {item.payoutDate ? new Date(item.payoutDate).toLocaleDateString() : 'Date pending'}
                  {item.bankReference ? ` · ${item.bankReference}` : ''}
                </Text>
              </View>
              <View style={styles.paidPill}><Text style={styles.paidText}>Paid</Text></View>
            </View>
          )) : (
            <View style={styles.empty}>
              <Text style={styles.emptyCopy}>Paid transfers will appear here after they are processed.</Text>
            </View>
          )}
        </View>

        <View style={styles.note}>
          <Text style={styles.noteIcon}>i</Text>
          <Text style={styles.noteText}>Payouts are transferred to the bank account saved in your partner profile.</Text>
        </View>
        <Text style={styles.total}>All-time net earnings: {money(summary.totalNet || 0)}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const build_styles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  page: { paddingHorizontal: theme.spacing.md, paddingBottom: 112 },
  loader: { marginTop: 60 },
  tabBar: { flexDirection: 'row', gap: 4, padding: 4, marginBottom: theme.spacing.md, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surfaceVariant },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: theme.borderRadius.sm },
  tabActive: { backgroundColor: theme.colors.surface, ...theme.elevation.low },
  tabLabel: { color: theme.colors.secondaryText, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: theme.colors.brandInk, fontWeight: '800' },
  metricsGrid: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing.lg },
  metricCard: { flex: 1, minWidth: 0, minHeight: 100, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, paddingVertical: 10, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.border },
  metricRing: { width: 22, height: 22, borderRadius: 11, borderWidth: 2.5, borderColor: theme.colors.borderStrong, marginBottom: 6 },
  metricValue: { fontSize: 13, fontWeight: '800' },
  metricLabel: { fontSize: 10, fontWeight: '600', marginTop: 3, textAlign: 'center' },
  sectionTitle: { color: theme.colors.secondaryText, fontSize: 12, fontWeight: '800', marginBottom: theme.spacing.sm, textTransform: 'uppercase' },
  listCard: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, paddingHorizontal: theme.spacing.md, marginBottom: theme.spacing.md },
  listRow: { minHeight: 65, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  lastRow: { borderBottomWidth: 0 },
  listCopy: { flex: 1 },
  listTitle: { color: theme.colors.mainText, fontSize: 13, fontWeight: '700' },
  listSub: { color: theme.colors.secondaryText, fontSize: 11, marginTop: 4 },
  listAmount: { color: theme.colors.successDark, fontSize: 13, fontWeight: '800' },
  paidPill: { backgroundColor: theme.colors.successLight, borderRadius: theme.borderRadius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  paidText: { color: theme.colors.successDark, fontSize: 11, fontWeight: '800' },
  empty: { paddingVertical: theme.spacing.lg, alignItems: 'center' },
  emptyTitle: { color: theme.colors.mainText, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  emptyCopy: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  note: { flexDirection: 'row', gap: 9, alignItems: 'center', backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginTop: theme.spacing.xs },
  noteIcon: { color: theme.colors.brandInk, fontSize: 14, fontWeight: '800' },
  noteText: { flex: 1, color: theme.colors.secondaryText, fontSize: 11, lineHeight: 16 },
  total: { color: theme.colors.secondaryText, fontSize: 12, fontWeight: '700', textAlign: 'right', marginTop: theme.spacing.md },
  errorCard: { backgroundColor: theme.colors.errorLight, borderWidth: 1, borderColor: theme.colors.error, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  error: { color: theme.colors.errorDark, fontSize: 13 },
  retry: { color: theme.colors.errorDark, fontSize: 11, fontWeight: '700', marginTop: 4 },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });

