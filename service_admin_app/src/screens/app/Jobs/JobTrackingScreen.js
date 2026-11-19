import { useCallback, useState } from 'react';
import { Alert, Linking, Share } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { fieldApi } from '../../../api/resources';
import { supportPhoneFromEnv } from '../../../constants/supportContact';
import { googleMapsUrl, openLiveMap, siteCoords } from '../../../utils/liveMap';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { LiveTrackCard, personFrom } from '../../../components/tracking/LiveTrackCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import {
  isActiveJob,
  jobStatusLabel,
  jobTimeline,
  jobTrackMeta,
  loadJobRecord,
  minutesLeft,
  specialistLine,
} from './jobsView';

const SUPPORT_PHONE = supportPhoneFromEnv();

export function JobTrackingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const fromEmergency = route.name === 'EmergencyTracking';
  const jobId = route.params && route.params.jobId;

  function goBack() {
    if (fromEmergency) navigation.navigate('Dashboard');
    else navigation.goBack();
  }
  const fallback = route.params && route.params.job;
  const [job, setJob] = useState(fallback || null);
  const [loading, setLoading] = useState(!fallback);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!jobId) {
      setError('This job could not be tracked.');
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

  async function shareTracking() {
    if (!job) return;
    try {
      await Share.share({
        message: `Gravity Hub job ${job.code || job.id}: ${job.title}. Status: ${jobStatusLabel(job.status)}.`,
      });
      setNotice('Tracking details are ready to share with your team.');
    } catch (_error) {
      setError('Tracking could not be shared right now.');
    }
  }

  function cancelRequest() {
    if (!job) return;
    Alert.alert('Cancel request', 'Cancel this live request? The specialist will be notified.', [
      { text: 'Keep request', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          setError('');
          try {
            await fieldApi.setJobStatus(job.id, { status: 'cancelled' });
            setNotice('Request cancelled.');
            await load();
          } catch (err) {
            setError(getErrorMessage(err));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  function callSpecialist() {
    const phone = (job && (job.engineerPhone || job.phone)) || SUPPORT_PHONE;
    if (!phone) {
      setError('A call number is not available yet.');
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => setError('Unable to start the call.'));
  }

  async function openJobMap() {
    setError('');
    try {
      const coords = siteCoords(job) || siteCoords(job && job.site);
      const label = (job && (job.location || job.address || job.siteName)) || '';
      await openLiveMap({ coords, label });
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function messageSpecialist() {
    const phone = String((job && (job.engineerPhone || job.phone)) || SUPPORT_PHONE).replace(/[^\d]/g, '');
    if (!phone) {
      setError('A chat number is not available yet.');
      return;
    }
    Linking.openURL(`https://wa.me/${phone}`).catch(() => setError('Unable to open chat.'));
  }

  if (loading && !job) {
    return (
      <Screen header={<AppBar title="Live Tracking" onBack={goBack} />}>
        <SkeletonStack rows={4} />
      </Screen>
    );
  }

  const meta = job ? jobTrackMeta(job) : {};
  const assigned = Boolean(job && job.engineerName);
  const left = minutesLeft(job);
  const jobCoords = siteCoords(job) || siteCoords(job && job.site);
  const jobLabel = (job && (job.location || job.address || job.siteName)) || '';
  const jobMapUrl = (jobCoords || jobLabel) ? googleMapsUrl({ coords: jobCoords, label: jobLabel }) : '';

  return (
    <Screen
      header={(
        <AppBar
          title="Live Tracking"
          onBack={goBack}
          right={job ? (
            <StatusBadge
              label={left ? `⏰ ${left} min left` : meta.statusLabel}
              status={left ? 'emergency' : job.status}
            />
          ) : null}
        />
      )}
      headerColor={colors.background}
      refreshing={!busy}
      onRefresh={load}
    >
      <Banner message={error} />
      <Banner message={notice} tone="success" />
      {job ? (
        <LiveTrackCard
          etaLabel={meta.etaLabel}
          distanceLabel={meta.distanceLabel}
          person={personFrom(job.engineerName, specialistLine(job) || 'Specialist assignment pending')}
          title={job.title}
          locationLabel={jobLabel || undefined}
          liveLabel={jobCoords ? 'JOB LOCATION' : 'LOCATION UNAVAILABLE'}
          mapCoords={jobCoords || undefined}
          mapLabel={jobLabel || undefined}
          mapUrl={jobMapUrl || undefined}
          onOpenMap={openJobMap}
          steps={jobTimeline(job)}
          onCall={assigned || SUPPORT_PHONE ? callSpecialist : undefined}
          onChat={assigned || SUPPORT_PHONE ? messageSpecialist : undefined}
          onShare={shareTracking}
          onCancel={isActiveJob(job) && !busy ? cancelRequest : undefined}
        />
      ) : null}
    </Screen>
  );
}
