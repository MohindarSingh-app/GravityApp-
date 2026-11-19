import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { AppHeader, goBackOrHome } from '../../components/AppHeader';
import { registerThemeStyles, theme } from '../../components/theme';
import { apiService } from '../../services/api';
import { launchImageLibraryAsync } from '../../services/imagePicker';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';

interface DeliveryJob {
  id: number;
  referenceId?: string;
  title?: string;
  equipment?: string;
  siteArea?: string;
  siteAddress?: string;
  stage?: string;
  status?: string;
  basePay?: number;
  customerName?: string;
}

interface PhotoChoice {
  uri: string;
  fileName: string;
}

interface DeliveryScreenProps {
  route: { params: { jobId: number; job?: DeliveryJob } };
  navigation: any;
}

export const DeliveryScreen: React.FC<DeliveryScreenProps> = ({ route, navigation }) => {
  const { colors } = useUserPreferences();
  const { jobId } = route.params;
  const [job, setJob] = useState<DeliveryJob | null>(route.params.job || null);
  const [pickupPhoto, setPickupPhoto] = useState<PhotoChoice | null>(null);
  const [dropPhoto, setDropPhoto] = useState<PhotoChoice | null>(null);
  const [loading, setLoading] = useState(!route.params.job);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState<any>(null);

  const loadJob = async () => {
    setLoading(true);
    try {
      const response = await apiService.getJob(jobId);
      setJob(response.data);
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || 'Could not load delivery details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const selectPhoto = async (leg: 'pickup' | 'drop') => {
    try {
      const result = await launchImageLibraryAsync({ quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const selected = { uri: asset.uri, fileName: asset.fileName || `${leg}-photo.jpg` };
        if (leg === 'pickup') setPickupPhoto(selected);
        else setDropPhoto(selected);
      }
    } catch (pickerError) {
      setError(pickerError instanceof Error ? pickerError.message : 'Could not select a delivery photo.');
    }
  };

  const run = async (action: () => Promise<any>) => {
    setWorking(true);
    setError('');
    try {
      return await action();
    } catch (actionError: any) {
      setError(actionError.response?.data?.message || 'Delivery action failed.');
      return null;
    } finally {
      setWorking(false);
    }
  };

  const accept = async () => {
    const response = await run(() => apiService.acceptDelivery(jobId));
    if (response?.success) setJob(response.data);
  };

  const confirmArrival = async (leg: 'pickup' | 'drop') => {
    const photo = leg === 'pickup' ? pickupPhoto : dropPhoto;
    if (!photo) {
      setError(`Add a ${leg} photo before confirming arrival.`);
      return;
    }
    const response = await run(() => apiService.confirmDeliveryArrival(jobId, {
      leg,
      photo: photo.uri,
      fileName: photo.fileName,
      fileRef: photo.uri,
    }));
    if (response?.success) await loadJob();
  };

  const complete = async () => {
    const response = await run(() => apiService.completeDelivery(jobId));
    if (response?.success) setCompleted(response.data);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (!job) return <View style={[styles.screen, { backgroundColor: colors.background }]}><AppHeader title="Delivery" onBack={() => goBackOrHome(navigation)} /><Text style={styles.error}>{error || 'Delivery not found.'}</Text></View>;

  const stage = job.stage || 'pickup';
  const isOpen = job.status === 'open';

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Workshop delivery" subtitle={job.referenceId || `DEL-${job.id}`} onBack={() => goBackOrHome(navigation)} />
      {completed ? (
        <View style={styles.content}>
          <Text style={styles.doneTitle}>Delivery complete</Text>
          <Text style={styles.body}>Workshop handoff is recorded.</Text>
          <Metric label="Your payout" value={`₹${Number(completed.payoutAmount || 0).toLocaleString('en-IN')}`} />
          <AppButton title="Back to dashboard" onPress={() => navigation.navigate('Home')} style={styles.mainAction} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.jobTitle}>{job.title || job.equipment || 'Equipment delivery'}</Text>
          <Text style={styles.body}>{job.customerName ? `Pickup contact: ${job.customerName}` : 'Move the item from the customer site to the workshop.'}</Text>
          <View style={styles.feeRow}><Text style={styles.body}>Delivery fee</Text><Text style={styles.fee}>₹{Number(job.basePay || 0).toLocaleString('en-IN')}</Text></View>

          {isOpen ? <AppButton title="Accept delivery" onPress={accept} loading={working} style={styles.mainAction} /> : null}

          <Text style={styles.sectionTitle}>1 · Customer pickup</Text>
          <Text style={styles.body}>{job.siteArea || job.siteAddress || 'Pickup location from request'}</Text>
          <PhotoPicker label="Pickup evidence" photo={pickupPhoto} onPress={() => selectPhoto('pickup')} />
          {stage === 'pickup' && !isOpen ? <AppButton title="Confirm pickup and head to workshop" onPress={() => confirmArrival('pickup')} loading={working} style={styles.mainAction} /> : null}
          {stage !== 'pickup' && stage !== 'accepted' ? <Text style={styles.doneLabel}>Pickup recorded</Text> : null}

          <Text style={styles.sectionTitle}>2 · Workshop drop-off</Text>
          <Text style={styles.body}>Hand the equipment to workshop staff and record the drop photo.</Text>
          <PhotoPicker label="Drop-off evidence" photo={dropPhoto} onPress={() => selectPhoto('drop')} />
          {stage === 'to_workshop' ? <AppButton title="Confirm drop-off" onPress={() => confirmArrival('drop')} loading={working} style={styles.mainAction} /> : null}
          {stage === 'delivered' ? <AppButton title="Mark delivered" onPress={complete} loading={working} style={styles.mainAction} /> : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.note}>Photo references are saved to the backend. Cloud storage and live GPS are not configured in this build.</Text>
        </ScrollView>
      )}
    </View>
  );
};

const PhotoPicker = ({ label, photo, onPress }: { label: string; photo: PhotoChoice | null; onPress: () => void }) => (
  <Pressable onPress={onPress} style={styles.photoRow}>
    {photo ? <Image source={{ uri: photo.uri }} style={styles.photo} /> : <View style={styles.photoPlaceholder}><Text style={styles.plus}>+</Text></View>}
    <View style={styles.photoText}><Text style={styles.photoTitle}>{label}</Text><Text numberOfLines={1} style={styles.bodySmall}>{photo?.fileName || 'Add a photo from your device'}</Text></View>
    <Text style={styles.photoAction}>{photo ? 'Change' : 'Add'}</Text>
  </Pressable>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metric}><Text style={styles.body}>{label}</Text><Text style={styles.fee}>{value}</Text></View>
);

const build_styles = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primaryBackground },
  content: { paddingHorizontal: theme.spacing.lg, paddingBottom: 112 },
  jobTitle: { color: theme.colors.mainText, fontSize: 22, fontWeight: '700', marginBottom: 8 },
  sectionTitle: { color: theme.colors.mainText, fontSize: 16, fontWeight: '700', marginTop: 25, marginBottom: 6 },
  body: { color: theme.colors.secondaryText, fontSize: 14, lineHeight: 20 },
  bodySmall: { color: theme.colors.secondaryText, fontSize: 12, marginTop: 4 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderColor: theme.colors.border },
  fee: { color: theme.colors.brandInk, fontSize: 18, fontWeight: '700' },
  photoRow: { flexDirection: 'row', minHeight: 78, alignItems: 'center', borderBottomWidth: 1, borderColor: theme.colors.border },
  photo: { width: 60, height: 52, borderRadius: 5 },
  photoPlaceholder: { width: 60, height: 52, borderRadius: 5, backgroundColor: theme.colors.softBrand, alignItems: 'center', justifyContent: 'center' },
  plus: { color: theme.colors.primary, fontSize: 24 },
  photoText: { flex: 1, marginLeft: 12 },
  photoTitle: { color: theme.colors.mainText, fontWeight: '700', fontSize: 13 },
  photoAction: { color: theme.colors.brandInk, fontWeight: '700', fontSize: 12 },
  mainAction: { marginTop: 14 },
  doneTitle: { color: theme.colors.brandInk, fontSize: 25, fontWeight: '700', marginBottom: 8 },
  doneLabel: { color: theme.colors.success, fontWeight: '700', paddingTop: 10 },
  error: { color: theme.colors.error, marginTop: 14 },
  note: { color: theme.colors.textMuted, fontSize: 11, marginTop: 20, lineHeight: 16 },
  metric: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderColor: theme.colors.border },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
