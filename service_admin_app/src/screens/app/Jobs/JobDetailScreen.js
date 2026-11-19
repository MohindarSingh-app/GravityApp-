import { useCallback, useState } from 'react';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { Card } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { formatWhen } from '../../../utils/format';
import {
  isActiveJob,
  isDoneJob,
  jobCost,
  jobStatusLabel,
  jobWhen,
  loadJobRecord,
  specialistLine,
} from './jobsView';

function Row({ label, value, trailing }) {
  const { colors, type } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <Text style={[type.small, { color: colors.textTertiary }]}>{label}</Text>
      {trailing || (
        <Text style={[type.heading, styles.value, { color: colors.text }]}>{value || '—'}</Text>
      )}
    </View>
  );
}

export function JobDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, type } = useTheme();
  const jobId = route.params && route.params.jobId;
  const fallback = route.params && route.params.job;
  const [job, setJob] = useState(fallback || null);
  const [loading, setLoading] = useState(!fallback);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!jobId) {
      setError('This job could not be opened.');
      setLoading(false);
      return;
    }
    setError('');
    try {
      const record = await loadJobRecord(jobId, fallback);
      setJob(record);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fallback, jobId]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  async function openInvoice() {
    setNotice('');
    const url = job && (job.invoiceUrl || job.gstInvoiceUrl);
    if (url) {
      try {
        await Linking.openURL(url);
        return;
      } catch (_error) {
        setError('The invoice link could not be opened.');
        return;
      }
    }
    Alert.alert(
      'GST Invoice',
      'The GST invoice is generated after the job is closed. It will appear here as soon as accounts publish it.',
    );
  }

  if (loading && !job) {
    return (
      <Screen header={<AppBar title="Job Details" onBack={() => navigation.goBack()} />}>
        <SkeletonStack rows={4} />
      </Screen>
    );
  }

  const cost = job ? jobCost(job) : '';

  return (
    <Screen
      header={<AppBar title="Job Details" onBack={() => navigation.goBack()} />}
      headerColor={colors.background}
      refreshing={Boolean(job)}
      onRefresh={() => { setLoading(true); load(); }}
    >
      <Banner message={error} />
      <Banner message={notice} tone="success" />

      {job ? (
        <>
          <Card style={styles.card}>
            <Row label="Job" value={job.title} />
            <Row label="Job ID" value={job.code || String(job.id).slice(0, 8)} />
            <Row
              label="Status"
              trailing={<StatusBadge label={jobStatusLabel(job.status)} status={job.status} />}
            />
            <Row label="Specialist" value={specialistLine(job) || 'Assignment pending'} />
            <Row label="Location" value={job.location || 'Company site'} />
            <View style={styles.lastRow}>
              <Text style={[type.small, { color: colors.textTertiary }]}>Date</Text>
              <Text style={[type.heading, styles.value, { color: colors.text }]}>
                {formatWhen(jobWhen(job)) || '—'}
              </Text>
            </View>
          </Card>

          <Card style={styles.card}>
            <View style={styles.lastRow}>
              <Text style={[type.small, { color: colors.textTertiary }]}>
                {isDoneJob(job) ? 'Final cost' : 'Estimated cost'}
              </Text>
              <Text style={[type.heading, { color: colors.success }]}>{cost || 'GST invoice on completion'}</Text>
            </View>
          </Card>

          {isActiveJob(job) ? (
            <Button
              title="Track Live"
              onPress={() => navigation.navigate('JobTracking', { jobId: job.id, job })}
            />
          ) : null}
          {isDoneJob(job) ? (
            <Button title="Download GST Invoice" variant="outline" onPress={openInvoice} />
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 4,
    gap: 0,
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  lastRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
  },
  value: {
    flex: 1,
    textAlign: 'right',
  },
});
