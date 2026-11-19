import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { AppHeader, goBackOrHome } from '../../components/AppHeader';
import { registerThemeStyles, theme } from '../../components/theme';
import { apiService } from '../../services/api';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';

interface PartnerScreensProps {
  navigation: any;
  route?: { params?: { mode?: string; tab?: 'requests' | 'queue' } };
}

export const WorkshopScreen: React.FC<PartnerScreensProps> = ({ navigation, route }) => {
  const { colors } = useUserPreferences();
  const mode = route?.params?.mode === 'panel' ? 'panel' : 'repair';
  const [tab, setTab] = useState<'requests' | 'queue'>(route?.params?.tab || 'requests');
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const title = mode === 'panel' ? 'Panel project queue' : 'Workshop repairs';

  useEffect(() => {
    if (route?.params?.tab) setTab(route.params.tab);
  }, [route?.params?.tab]);

  const load = async (nextTab: 'requests' | 'queue' = tab === 'requests' ? 'requests' : 'queue') => {
    setLoading(true);
    setError('');
    try {
      const response = nextTab === 'requests' ? await apiService.listOpenJobs() : await apiService.listMyJobs();
      setJobs((response.data || []).filter((job: any) =>
        job.jobType === mode && (nextTab === 'requests' ? job.status === 'open' : job.status !== 'completed')
      ));
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || 'Could not load workshop work.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(tab);
  }, [tab, mode]);

  const accept = async (job: any) => {
    setWorkingId(job.id);
    setError('');
    try {
      await apiService.acceptJob(job.id);
      await load('queue');
      setTab('queue');
    } catch (acceptError: any) {
      setError(acceptError.response?.data?.message || 'Could not accept this ticket.');
    } finally {
      setWorkingId(null);
    }
  };

  const decline = async (job: any) => {
    setWorkingId(job.id);
    setError('');
    try {
      await apiService.declineJob(job.id, 'Partner unavailable');
      await load('requests');
    } catch (declineError: any) {
      setError(declineError.response?.data?.message || 'Could not decline this ticket.');
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader
        title={tab === 'requests' ? title : mode === 'panel' ? 'Fabrication Queue' : 'Workshop'}
        subtitle={tab === 'requests' ? 'Requests matched to your approved expertise' : mode === 'panel' ? 'Currently fabricating' : 'Current repair queue'}
        onBack={() => goBackOrHome(navigation)}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : (
        <FlatList
          data={jobs}
          keyExtractor={(job) => String(job.id)}
          contentContainerStyle={styles.page}
          ListEmptyComponent={<Text style={styles.body}>No {mode === 'panel' ? 'panel projects' : 'repair tickets'} in this list.</Text>}
          renderItem={({ item }) => {
            return (
              <View style={styles.workRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => navigation.navigate('WorkshopJobDetail', {
                    jobId: item.id,
                    job: item,
                    mode,
                  })}
                >
                <Text style={styles.rowSub}>{item.referenceId || `JOB-${item.id}`}</Text>
                <Text style={styles.rowTitle}>{item.title || item.equipment || 'Workshop request'}</Text>
                <Text style={styles.body}>{[item.brand, item.equipmentModel, item.category].filter(Boolean).join(' · ')}</Text>
                <Text style={styles.stageLabel}>Stage: {(item.stage || 'unassigned').replaceAll('_', ' ')}</Text>
                <Text style={styles.body}>{item.description || 'Requirements available in ticket details.'}</Text>
                <Text style={styles.rowAction}>View ticket details ›</Text>
                </Pressable>
                {tab === 'requests' ? (
                  <View style={styles.requestActions}>
                    <Pressable onPress={() => decline(item)} disabled={workingId === item.id} style={styles.declineButton}>
                      <Text style={styles.declineText}>Decline</Text>
                    </Pressable>
                    <View style={styles.acceptWrap}>
                      <AppButton title="Accept ticket" onPress={() => accept(item)} loading={workingId === item.id} />
                    </View>
                  </View>
                ) : (
                  <AppButton
                    title={mode === 'panel' ? 'Open project workflow' : 'Open repair workflow'}
                    onPress={() => navigation.navigate('WorkshopJobDetail', { jobId: item.id, job: item, mode })}
                    style={styles.workAction}
                  />
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

const build_styles = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  page: { paddingHorizontal: theme.spacing.lg, paddingBottom: 112 },
  loader: { marginTop: 60 },
  body: { color: theme.colors.secondaryText, fontSize: 13, lineHeight: 19, marginTop: 5 },
  error: { color: theme.colors.error, paddingHorizontal: theme.spacing.lg, marginBottom: 10 },
  rowTitle: { color: theme.colors.mainText, fontSize: 14, fontWeight: '700' },
  rowSub: { color: theme.colors.secondaryText, fontSize: 12 },
  rowAction: { color: theme.colors.brandInk, fontWeight: '700' },
  workRow: { paddingVertical: 16, borderBottomWidth: 1, borderColor: theme.colors.border },
  stageLabel: { color: theme.colors.brandInk, fontWeight: '700', fontSize: 12, marginTop: 9, textTransform: 'capitalize' },
  workAction: { marginTop: 13 },
  requestActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 13 },
  declineButton: { borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14 },
  declineText: { color: theme.colors.secondaryText, fontSize: 12, fontWeight: '700' },
  acceptWrap: { flex: 1 },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
