import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { fieldApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { JobCard } from '../../../components/ui/JobCard';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { toneInk } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { jobStatusLabel } from '../Dashboard/dashboardView';
import { totalJobSavings } from './savings';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'done', label: 'Done' },
];

function filterRows(rows, tab) {
  if (tab === 'active') {
    return rows.filter((job) => ['open', 'pending', 'in_progress', 'on_the_way'].includes(job.status));
  }
  if (tab === 'done') {
    return rows.filter((job) => job.status === 'completed' || job.status === 'done');
  }
  return rows;
}

function HistoryMetric({ glyph, label, value, tone, valueColor }) {
  const { colors, radius, type } = useTheme();
  const ink = toneInk(colors, tone);

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={[
        styles.metricCard,
        {
          backgroundColor: ink.bg,
          borderColor: ink.fg,
          borderRadius: radius.card,
        },
      ]}
    >
      <View style={[styles.metricIcon, { backgroundColor: colors.surface, borderRadius: radius.chip }]}>
        <Glyph name={glyph} color={ink.fg} size={17} />
      </View>
      <View style={styles.metricCopy}>
        <Text style={[type.heading, styles.metricValue, { color: valueColor || colors.text }]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={[type.small, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View pointerEvents="none" style={[styles.metricCorner, styles.metricCornerTop, { borderColor: ink.fg }]} />
      <View pointerEvents="none" style={[styles.metricCorner, styles.metricCornerBottom, { borderColor: ink.fg }]} />
    </View>
  );
}

export function JobsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const initialTab = route.params ? route.params.initialTab : undefined;
  const { colors, space } = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await fieldApi.jobs();
      setRows(data.jobs || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!TABS.some((item) => item.id === initialTab)) return;
    setTab(initialTab);
    navigation.setParams({ initialTab: undefined });
  }, [initialTab, navigation]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const savings = totalJobSavings(rows);
  const thisYear = useMemo(() => {
    const year = new Date().getFullYear();
    return rows.filter((job) => new Date(job.createdAt).getFullYear() === year).length;
  }, [rows]);
  const tabCounts = useMemo(() => ({
    all: rows.length,
    active: filterRows(rows, 'active').length,
    done: filterRows(rows, 'done').length,
  }), [rows]);
  const visible = useMemo(() => filterRows(rows, tab), [rows, tab]);

  return (
    <Screen
      header={<AppBar title="Job History" onBack={() => navigation.goBack()} />}
      headerColor={colors.background}
      refreshing={!loading && rows.length > 0}
      onRefresh={() => { setLoading(true); load(); }}
      contentGap={space.section}
    >
      <View style={styles.metrics}>
        <HistoryMetric glyph="calendar" label="This year" value={String(thisYear)} tone="transit" />
        <HistoryMetric
          glyph="spark"
          label="Total savings"
          value={savings === null ? '—' : `₹${savings.toLocaleString('en-IN')}`}
          tone="transit"
          valueColor={colors.success}
        />
      </View>

      <SectionHeader title="Bookings" />
      <SegmentedControl
        tabs={TABS.map((item) => ({ ...item, count: tabCounts[item.id] }))}
        value={tab}
        onChange={setTab}
        scrollable
      />

      {error ? <Banner message={error} /> : null}
      {loading && rows.length === 0 ? <SkeletonStack rows={4} /> : null}
      {!loading && visible.length === 0 ? (
        <EmptyState
          glyph="jobs"
          title="No jobs in this view"
          message="Book a service or raise an emergency to see jobs here."
          action={<Button title="Request service" onPress={() => navigation.navigate('QuickServices')} />}
        />
      ) : visible.map((job) => (
        <JobCard
          key={job.id}
          title={job.title}
          code={[job.code, job.priority, job.category].filter(Boolean).join(' · ')}
          status={job.status}
          statusLabel={jobStatusLabel(job.status)}
          technician={[job.engineerName, job.engineerTrade, job.estimateAmount ? `₹${job.estimateAmount}` : ''].filter(Boolean).join(' · ')}
          location={job.location}
          onPress={() => navigation.navigate('JobDetail', { jobId: job.id, job })}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    height: 70,
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  metricIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  metricValue: {
    fontSize: 18,
    lineHeight: 22,
  },
  metricCorner: {
    position: 'absolute',
    width: 11,
    height: 11,
    borderWidth: 1.5,
  },
  metricCornerTop: {
    top: 4,
    right: 4,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    transform: [{ rotate: '45deg' }],
  },
  metricCornerBottom: {
    bottom: 4,
    left: 4,
    borderRightWidth: 0,
    borderTopWidth: 0,
    transform: [{ rotate: '45deg' }],
  },
});
