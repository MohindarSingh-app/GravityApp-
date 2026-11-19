import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AppHeader } from '../../components/AppHeader';
import { registerThemeStyles, theme } from '../../components/theme';
import { useAuth } from '../../providers/AuthProvider';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import { apiService } from '../../services/api';

interface ScheduleRow {
  id: number;
  title?: string;
  referenceId?: string;
  jobType?: string;
  status?: string;
  stage?: string;
  siteArea?: string;
  assignedPartnerName?: string;
  assignedPartnerBusinessName?: string;
  scheduledAt?: string | null;
}

interface ScheduleInput {
  date: string;
  time: string;
}

const toInputValue = (value?: string | null): ScheduleInput => {
  if (!value) return { date: '', time: '' };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: '', time: '' };
  const pad = (part: number) => String(part).padStart(2, '0');
  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
};

const toIsoDateTime = ({ date, time }: ScheduleInput) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const parsed = new Date(year, month - 1, day, hour, minute);
  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
    || parsed.getHours() !== hour
    || parsed.getMinutes() !== minute
  ) return null;
  return parsed.toISOString();
};

export const AdminScheduleScreen: React.FC = () => {
  const { colors } = useUserPreferences();
  const { logout } = useAuth();
  const [jobs, setJobs] = useState<ScheduleRow[]>([]);
  const [inputs, setInputs] = useState<Record<string, ScheduleInput>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expertiseReviews, setExpertiseReviews] = useState<any[]>([]);
  const [reviewingId, setReviewingId] = useState<string | number | null>(null);

  const loadSchedule = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    setNotice('');
    try {
      const [scheduleResult, reviewsResult] = await Promise.all([
        apiService.listAdminSchedule(),
        apiService.listExpertiseReviews(),
      ]);
      const rows: ScheduleRow[] = scheduleResult.data || [];
      setJobs(rows);
      setExpertiseReviews(reviewsResult.data || []);
      setInputs(Object.fromEntries(rows.map((job) => [String(job.id), toInputValue(job.scheduledAt)])));
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || 'Could not load active assignments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSchedule();
  }, [loadSchedule]);

  const reviewExpertise = async (registrationId: string | number, decision: 'approved' | 'rejected') => {
    setReviewingId(registrationId);
    setError('');
    try {
      await apiService.reviewPartnerExpertise(registrationId, decision);
      setExpertiseReviews((current) => current.filter((application) => String(application.id) !== String(registrationId)));
      setNotice(`Expertise ${decision} successfully.`);
    } catch (reviewError: any) {
      setError(reviewError.response?.data?.message || 'Could not review expertise.');
    } finally {
      setReviewingId(null);
    }
  };

  const updateInput = (jobId: number, field: keyof ScheduleInput, value: string) => {
    setInputs((current) => ({
      ...current,
      [String(jobId)]: { ...(current[String(jobId)] || { date: '', time: '' }), [field]: value },
    }));
  };

  const saveSchedule = async (job: ScheduleRow) => {
    const value = toIsoDateTime(inputs[String(job.id)] || { date: '', time: '' });
    if (!value) {
      setError('Enter a valid local date (YYYY-MM-DD) and time (HH:mm).');
      setNotice('');
      return;
    }
    setSavingId(job.id);
    setError('');
    setNotice('');
    try {
      await apiService.setJobSchedule(job.id, value);
      setJobs((current) => current.map((item) => item.id === job.id ? { ...item, scheduledAt: value } : item));
      setNotice(`Appointment saved for ${job.referenceId || `job ${job.id}`}.`);
    } catch (saveError: any) {
      setError(saveError.response?.data?.message || 'Could not save this appointment.');
    } finally {
      setSavingId(null);
    }
  };

  const clearSchedule = async (job: ScheduleRow) => {
    setSavingId(job.id);
    setError('');
    setNotice('');
    try {
      await apiService.setJobSchedule(job.id, null);
      setInputs((current) => ({ ...current, [String(job.id)]: { date: '', time: '' } }));
      setJobs((current) => current.map((item) => item.id === job.id ? { ...item, scheduledAt: null } : item));
      setNotice(`Appointment cleared for ${job.referenceId || `job ${job.id}`}.`);
    } catch (saveError: any) {
      setError(saveError.response?.data?.message || 'Could not clear this appointment.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader title="Dispatcher schedule" subtitle="Set appointment times for active assignments" />
      <View style={styles.accountRow}>
        <Text style={[styles.accountLabel, { color: colors.secondaryText }]}>Administrator access</Text>
        <Pressable onPress={() => void logout()} accessibilityRole="button">
          <Text style={[styles.logout, { color: colors.primary }]}>Sign out</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadSchedule(true)} tintColor={colors.primary} />}
        >
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {notice ? <Text accessibilityRole="status" style={styles.notice}>{notice}</Text> : null}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Expertise approvals</Text>
          {expertiseReviews.length ? expertiseReviews.map((application) => (
            <View key={String(application.id)} style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>{application.personalDetails?.fullName || application.mobile} · {application.partnerRole?.replaceAll('_', ' ')}</Text>
              <Text style={[styles.copy, { color: colors.secondaryText }]}>Qualification: {application.professionalDetails?.qualification || 'Not provided'} · Experience: {application.professionalDetails?.experience || 'Not provided'}</Text>
              <Text style={[styles.copy, { color: colors.secondaryText }]}>{Object.entries(application.specializations?.categories || {}).flatMap(([category, value]: [string, any]) => value?.enabled ? [category, ...(value.skills || [])] : []).join(' · ') || 'Expertise selection submitted'}</Text>
              <View style={styles.actionRow}>
                <Pressable disabled={reviewingId === application.id} onPress={() => void reviewExpertise(application.id, 'approved')} style={[styles.saveButton, { backgroundColor: theme.colors.success }, reviewingId === application.id && styles.disabled]}><Text style={styles.saveText}>Approve</Text></Pressable>
                <Pressable disabled={reviewingId === application.id} onPress={() => void reviewExpertise(application.id, 'rejected')} style={[styles.clearButton, { borderColor: theme.colors.error }, reviewingId === application.id && styles.disabled]}><Text style={[styles.clearText, { color: theme.colors.error }]}>Reject</Text></Pressable>
              </View>
            </View>
          )) : <Text style={[styles.copy, { color: colors.secondaryText }]}>No expertise selections are waiting for review.</Text>}
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Partner schedules</Text>
          {!jobs.length && !error ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No active assigned jobs</Text>
              <Text style={[styles.copy, { color: colors.secondaryText }]}>Accepted work will appear here for appointment scheduling.</Text>
            </View>
          ) : null}
          {jobs.map((job) => {
            const input = inputs[String(job.id)] || { date: '', time: '' };
            const saving = savingId === job.id;
            return (
              <View key={String(job.id)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.jobHeader}>
                  <View style={styles.flex}>
                    <Text style={[styles.title, { color: colors.text }]}>{job.title || job.referenceId || `Job ${job.id}`}</Text>
                    <Text style={[styles.copy, { color: colors.secondaryText }]}>
                      {[job.referenceId, job.assignedPartnerBusinessName || job.assignedPartnerName, job.siteArea, job.stage?.replaceAll('_', ' ')].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <Text style={[styles.status, { color: colors.primary }]}>{job.status || 'active'}</Text>
                </View>
                {job.scheduledAt ? (
                  <Text style={[styles.currentTime, { color: colors.secondaryText }]}>
                    Current appointment: {new Date(job.scheduledAt).toLocaleString()}
                  </Text>
                ) : (
                  <Text style={[styles.currentTime, { color: colors.secondaryText }]}>Appointment not set</Text>
                )}
                <View style={styles.inputRow}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.secondaryText }]}>Date</Text>
                    <TextInput
                      accessibilityLabel={`Appointment date for ${job.referenceId || job.id}`}
                      value={input.date}
                      onChangeText={(value) => updateInput(job.id, 'date', value)}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.secondaryText}
                      keyboardType="numbers-and-punctuation"
                      autoCapitalize="none"
                      style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.secondaryText }]}>Time</Text>
                    <TextInput
                      accessibilityLabel={`Appointment time for ${job.referenceId || job.id}`}
                      value={input.time}
                      onChangeText={(value) => updateInput(job.id, 'time', value)}
                      placeholder="HH:mm"
                      placeholderTextColor={colors.secondaryText}
                      keyboardType="numbers-and-punctuation"
                      autoCapitalize="none"
                      style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                    />
                  </View>
                </View>
                <Text style={[styles.hint, { color: colors.secondaryText }]}>Times are entered in this device’s local timezone.</Text>
                <View style={styles.actionRow}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => void saveSchedule(job)}
                    style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.disabled]}
                  >
                    <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save appointment'}</Text>
                  </Pressable>
                  {job.scheduledAt ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      onPress={() => void clearSchedule(job)}
                      style={[styles.clearButton, { borderColor: colors.border }, saving && styles.disabled]}
                    >
                      <Text style={[styles.clearText, { color: colors.secondaryText }]}>Clear</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
};

const build_styles = () => StyleSheet.create({
  screen: { flex: 1 },
  accountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.md },
  accountLabel: { fontSize: 12, fontWeight: '600' },
  logout: { fontSize: 13, fontWeight: '700' },
  loader: { flex: 1 },
  content: { paddingHorizontal: theme.spacing.lg, paddingBottom: 120, gap: theme.spacing.md },
  sectionTitle: { ...theme.typography.titleSmall, color: theme.colors.mainText, marginTop: theme.spacing.sm },
  reviewCard: { borderWidth: 1, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, ...theme.elevation.low },
  card: { borderWidth: 1, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, ...theme.elevation.low },
  jobHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm },
  flex: { flex: 1 },
  title: { fontSize: 16, fontWeight: '700' },
  copy: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  status: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  currentTime: { fontSize: 12, marginTop: theme.spacing.sm },
  inputRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  inputGroup: { flex: 1 },
  label: { fontSize: 11, fontWeight: '600', marginBottom: 5 },
  input: { borderWidth: 1, borderRadius: theme.borderRadius.md, paddingHorizontal: 10, paddingVertical: 9, fontSize: 14 },
  hint: { fontSize: 11, marginTop: 6 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  saveButton: { borderRadius: theme.borderRadius.md, paddingHorizontal: 14, paddingVertical: 11 },
  saveText: { color: theme.colors.white, fontSize: 12, fontWeight: '700' },
  clearButton: { borderWidth: 1, borderRadius: theme.borderRadius.md, paddingHorizontal: 14, paddingVertical: 10 },
  clearText: { fontSize: 12, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  error: { color: theme.colors.error, padding: theme.spacing.sm, fontSize: 13 },
  notice: { color: theme.colors.success, padding: theme.spacing.sm, fontSize: 13 },
  emptyCard: { borderWidth: 1, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });

