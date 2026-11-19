import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { AppHeader, goBackOrHome } from '../../components/AppHeader';
import { AppTextInput } from '../../components/AppTextInput';
import { registerThemeStyles, theme } from '../../components/theme';
import { apiService } from '../../services/api';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';

const WORKSHOP_FLOWS: Record<'repair' | 'panel', string[]> = {
  repair: ['received', 'diagnosing', 'repairing', 'ready', 'dispatched'],
  panel: ['received', 'design_quote', 'fabricating', 'qc', 'dispatched'],
};

interface WorkshopJobDetailScreenProps {
  route: { params: { jobId: number; mode: 'repair' | 'panel'; job?: any } };
  navigation: any;
}

export const WorkshopJobDetailScreen: React.FC<WorkshopJobDetailScreenProps> = ({ route, navigation }) => {
  const { colors } = useUserPreferences();
  const { jobId, mode } = route.params;
  const [job, setJob] = useState<any>(route.params.job || null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(!route.params.job);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [completion, setCompletion] = useState<any>(null);
  const flow = WORKSHOP_FLOWS[mode];

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiService.getJob(jobId);
      setJob(response.data);
      if (response.data?.serviceCharge !== undefined && response.data?.serviceCharge !== null) {
        setAmount(String(response.data.serviceCharge));
      }
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || 'Could not load this workshop ticket.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [jobId]);

  const run = async (action: () => Promise<any>, refresh = true) => {
    setWorking(true);
    setError('');
    try {
      const response = await action();
      if (refresh) await load();
      return response;
    } catch (actionError: any) {
      setError(actionError.response?.data?.message || 'Could not update this workshop ticket.');
      return null;
    } finally {
      setWorking(false);
    }
  };

  const accept = async () => {
    await run(() => apiService.acceptJob(jobId));
  };

  const decline = async () => {
    const response = await run(() => apiService.declineJob(jobId, 'Partner unavailable'), false);
    if (response) navigation.goBack();
  };

  const advance = async () => {
    if (mode === 'panel' && job.stage === 'received' && !amount.trim()) {
      setError('Enter the project quote before moving to the design and quote stage.');
      return;
    }
    if ((needsQuote || needsRepairPrice) && (!Number.isFinite(Number(amount)) || Number(amount) < 0)) {
      setError('Enter a valid, non-negative amount.');
      return;
    }
    await run(() => apiService.advanceJobStage(jobId, {
      note: mode === 'panel' && job.stage === 'received' ? 'Project quote submitted' : undefined,
      ...(amount.trim() ? { repairCost: Number(amount) } : {}),
    }));
  };

  const complete = async () => {
    const response = await run(
      () => apiService.completeWorkshopJob(jobId, { repairCost: Number(amount) || 0 }),
      false
    );
    if (response?.success) setCompletion(response.data);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  }

  if (!job) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Workshop ticket" onBack={() => goBackOrHome(navigation)} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton title="Try again" onPress={load} style={styles.retry} />
      </View>
    );
  }

  const isOpen = job.status === 'open';
  const isCompleted = job.status === 'completed';
  const currentIndex = flow.indexOf(job.stage);
  const atFinalStage = currentIndex === flow.length - 1;
  const nextStage = currentIndex >= 0 ? flow[currentIndex + 1] : undefined;
  const needsQuote = mode === 'panel' && job.stage === 'received';
  const needsRepairPrice = mode === 'repair' && job.stage === 'repairing';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title={mode === 'panel' ? 'Panel project details' : 'Repair ticket details'}
        subtitle={job.referenceId || `Job ${job.id}`}
        onBack={() => goBackOrHome(navigation)}
      />
      {completion || isCompleted ? (
        <View style={styles.content}>
          <Text style={styles.completionTitle}>Workshop job completed</Text>
          <Text style={styles.body}>The handoff and partner payout have been recorded.</Text>
          <Fact label="Total bill" value={`₹${Number(completion?.totalBill ?? job.totalBill ?? 0).toLocaleString('en-IN')}`} />
          <Fact label="Your payout" value={`₹${Number(completion?.payoutAmount ?? job.payoutAmount ?? 0).toLocaleString('en-IN')}`} />
          <AppButton title="Back to workshop queue" onPress={() => navigation.navigate('Workshop', { mode, tab: 'queue' })} style={styles.action} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heading}>
            <View style={styles.headingCopy}>
              <Text style={styles.jobTitle}>{job.title || job.equipment || (mode === 'panel' ? 'Panel project' : 'Repair request')}</Text>
              <Text style={styles.reference}>{job.referenceId || `JOB-${job.id}`}</Text>
            </View>
            <Text style={styles.status}>{(job.stage || job.status || 'Open').replaceAll('_', ' ')}</Text>
          </View>
          <Text style={styles.body}>{job.description || 'No additional job notes were provided.'}</Text>

          <View style={styles.facts}>
            <Fact label="Equipment" value={[job.brand, job.equipment, job.equipmentModel].filter(Boolean).join(' · ')} />
            <Fact label="Category" value={job.category} />
            {job.slaDueAt ? <Fact label={mode === 'panel' ? 'Quote SLA due' : 'Repair SLA due'} value={new Date(job.slaDueAt).toLocaleString()} /> : null}
            <Fact label="Partner payout estimate" value={`₹${Number(job.basePay || job.serviceCharge || 0).toLocaleString('en-IN')}`} />
          </View>

          {Array.isArray(job.issueTags) && job.issueTags.length ? (
            <View style={styles.tags}>
              <Text style={styles.sectionTitle}>Reported requirements</Text>
              <Text style={styles.body}>{job.issueTags.join(' · ')}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>Workshop stages</Text>
          {flow.map((stage, index) => (
            <View key={stage} style={styles.stageRow}>
              <View style={[styles.stageDot, currentIndex >= index && styles.stageDotDone]} />
              <Text style={[styles.stageText, job.stage === stage && styles.currentStage]}>
                {stage.replaceAll('_', ' ')}
              </Text>
              {job.stage === stage ? <Text style={styles.currentLabel}>Current</Text> : null}
            </View>
          ))}

          {needsQuote || needsRepairPrice || atFinalStage ? (
            <AppTextInput
              label={needsQuote ? 'Project quote (₹)' : mode === 'panel' ? 'Project amount (₹)' : 'Repair amount (₹)'}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0"
            />
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {isOpen ? (
            <View style={styles.actions}>
              <AppButton title="Decline ticket" onPress={decline} variant="outline" loading={working} style={styles.secondaryAction} />
              <AppButton title="Accept ticket" onPress={accept} loading={working} style={styles.primaryAction} />
            </View>
          ) : atFinalStage ? (
            <AppButton title="Complete and record payout" onPress={complete} loading={working} style={styles.action} />
          ) : nextStage ? (
            <AppButton
              title={`Move to ${nextStage.replaceAll('_', ' ')}`}
              onPress={advance}
              loading={working}
              disabled={(needsQuote || needsRepairPrice) && !amount.trim()}
              style={styles.action}
            />
          ) : (
            <Text style={styles.error}>This ticket is not at a valid workshop stage.</Text>
          )}
        </ScrollView>
      )}
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
  content: { paddingHorizontal: theme.spacing.lg, paddingBottom: 112 },
  retry: { marginHorizontal: theme.spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.sm },
  headingCopy: { flex: 1 },
  jobTitle: { color: theme.colors.mainText, fontSize: 22, fontWeight: '800' },
  reference: { color: theme.colors.secondaryText, fontSize: 12, marginTop: 5 },
  status: { color: theme.colors.brandInk, backgroundColor: theme.colors.softBrand, borderRadius: theme.borderRadius.pill, paddingHorizontal: 10, paddingVertical: 6, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  body: { color: theme.colors.secondaryText, fontSize: 13, lineHeight: 20, marginTop: theme.spacing.md },
  facts: { borderTopWidth: 1, borderTopColor: theme.colors.border, marginTop: theme.spacing.lg },
  fact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  factLabel: { color: theme.colors.secondaryText, fontSize: 12, flex: 0.8 },
  factValue: { color: theme.colors.mainText, fontSize: 12, fontWeight: '600', flex: 1.2, textAlign: 'right' },
  tags: { marginTop: theme.spacing.md },
  sectionTitle: { color: theme.colors.mainText, fontSize: 15, fontWeight: '700', marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm },
  stageRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  stageDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.borderStrong },
  stageDotDone: { backgroundColor: theme.colors.success },
  stageText: { color: theme.colors.secondaryText, fontSize: 12, textTransform: 'capitalize', flex: 1 },
  currentStage: { color: theme.colors.mainText, fontWeight: '700' },
  currentLabel: { color: theme.colors.brandInk, fontSize: 10, fontWeight: '700' },
  error: { color: theme.colors.error, fontSize: 13, lineHeight: 18, marginTop: theme.spacing.md, marginHorizontal: theme.spacing.lg },
  actions: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  action: { marginTop: theme.spacing.md },
  primaryAction: { flex: 1 },
  secondaryAction: { flex: 1 },
  completionTitle: { color: theme.colors.successDark, fontSize: 23, fontWeight: '800' },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });

