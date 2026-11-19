import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../components/AppButton';
import { AppHeader, goBackOrHome } from '../../components/AppHeader';
import { AppTextInput } from '../../components/AppTextInput';
import { SignaturePad } from '../../components/SignaturePad';
import { registerThemeStyles, theme } from '../../components/theme';
import { apiService } from '../../services/api';
import { launchImageLibraryAsync } from '../../services/imagePicker';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';

const ISSUE_TAGS = [
  'Output phase fault',
  'IGBT module damaged',
  'Cooling fan failure',
  'Loose terminal',
  'Parameter misconfig',
  'Overcurrent',
];

const CHECKLIST = [
  { id: 'work_completed', label: 'Work completed as agreed' },
  { id: 'customer_satisfied', label: 'Customer satisfied with the work' },
  { id: 'site_cleaned', label: 'Work area cleaned' },
];

interface PartDraft {
  name: string;
  quantity: string;
  unitCost: string;
}

interface PhotoDraft {
  uri: string;
  fileName: string;
}

interface FieldWorkflowScreenProps {
  route: { params: { jobId: number; job?: any } };
  navigation: any;
  embedded?: boolean;
  onJobChange?: (job: any) => void;
}

export const FieldWorkflowScreen: React.FC<FieldWorkflowScreenProps> = ({ route, navigation, embedded = false, onJobChange }) => {
  const { colors } = useUserPreferences();
  const { jobId } = route.params;
  const [job, setJob] = useState<any>(route.params.job || null);
  const [step, setStep] = useState(1);
  const [expandedStep, setExpandedStep] = useState(1);
  const [findings, setFindings] = useState('');
  const [issueTags, setIssueTags] = useState<string[]>([]);
  const [recommendServiceCenter, setRecommendServiceCenter] = useState(false);
  const [parts, setParts] = useState<PartDraft[]>([{ name: '', quantity: '1', unitCost: '0' }]);
  const [beforePhoto, setBeforePhoto] = useState<PhotoDraft | null>(null);
  const [afterPhoto, setAfterPhoto] = useState<PhotoDraft | null>(null);
  const [customerOtp, setCustomerOtp] = useState('');
  const [customerSigned, setCustomerSigned] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(!route.params.job);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [completion, setCompletion] = useState<any>(null);

  const loadJob = async () => {
    setLoading(true);
    try {
      const response = await apiService.getJob(jobId);
      const nextJob = response.data;
      setJob(nextJob);
      onJobChange?.(nextJob);
      const stageSteps: Record<string, number> = {
        accepted: 1,
        checked_in: 2,
        diagnosed: 3,
        parts_used: 4,
        photos_done: 5,
        completed: 6,
      };
      const currentStep = stageSteps[nextJob.stage] || 1;
      setStep(currentStep);
      setExpandedStep(currentStep);
      if (nextJob.status === 'completed') {
        setCompletion({
          referenceId: nextJob.referenceId,
          totalBill: nextJob.totalBill,
          serviceCharge: nextJob.serviceCharge,
          partsTotal: nextJob.partsTotal,
          payoutAmount: nextJob.payoutAmount,
        });
      }
      const diagnosis = nextJob.workflow?.find((item: any) => item.stepNumber === 2);
      if (diagnosis) {
        setFindings(diagnosis.findings || '');
        setIssueTags(diagnosis.issueTags || []);
        setRecommendServiceCenter(!!diagnosis.recommendServiceCenter);
      }
    } catch (loadError: any) {
      setError(loadError.response?.data?.message || 'Could not load this job.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJob();
  }, [jobId]);

  const runAction = async (action: () => Promise<any>, nextStep?: number) => {
    setWorking(true);
    setError('');
    try {
      const response = await action();
      if (nextStep !== undefined) {
        setStep(nextStep);
        setExpandedStep(nextStep);
        const updatedJob = job
          ? { ...job, stage: ['accepted', 'checked_in', 'diagnosed', 'parts_used', 'photos_done', 'completed'][nextStep - 1] }
          : null;
        if (updatedJob) {
          setJob(updatedJob);
          onJobChange?.(updatedJob);
        }
      }
      return response;
    } catch (actionError: any) {
      setError(actionError.response?.data?.message || 'Could not save this workflow step.');
      return null;
    } finally {
      setWorking(false);
    }
  };

  const choosePhoto = async (type: 'before' | 'after') => {
    try {
      const result = await launchImageLibraryAsync({ quality: 0.8 });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        const photo = { uri: asset.uri, fileName: asset.fileName || `${type}-photo.jpg` };
        if (type === 'before') setBeforePhoto(photo);
        else setAfterPhoto(photo);
      }
    } catch (pickerError) {
      setError(pickerError instanceof Error ? pickerError.message : 'Could not select job evidence.');
    }
  };

  const complete = async () => {
    if (!customerSigned) {
      setError('Ask the customer to sign in the signature box to confirm the completed work.');
      return;
    }
    const response = await runAction(() => apiService.completeJob(jobId, {
      customerOtp,
      checklist: CHECKLIST.map((item) => ({ id: item.id, checked: !!checklist[item.id] })),
    }));
    if (response?.success) {
      setCompletion(response.data);
      if (job) onJobChange?.({ ...job, status: 'completed', stage: 'completed' });
    }
  };

  const toggleIssue = (tag: string) => {
    setIssueTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]);
  };

  const updatePart = (index: number, field: keyof PartDraft, value: string) => {
    setParts((current) => current.map((part, partIndex) => partIndex === index ? { ...part, [field]: value } : part));
  };

  const saveParts = async () => {
    const validParts = parts.filter((part) => part.name.trim());
    if (!validParts.length) {
      setError('Add at least one part and enter its name.');
      return;
    }
    await runAction(() => apiService.saveParts(jobId, validParts.map((part) => ({
      name: part.name.trim(),
      quantity: Number(part.quantity) || 1,
      unitCost: Number(part.unitCost) || 0,
    }))), 4);
  };

  const savePhotos = async () => {
    if (!beforePhoto || !afterPhoto) {
      setError('Both before and after photos are required.');
      return;
    }
    await runAction(() => apiService.savePhotos(jobId, [
      { type: 'before', fileName: beforePhoto.fileName, fileRef: beforePhoto.uri },
      { type: 'after', fileName: afterPhoto.fileName, fileRef: afterPhoto.uri },
    ]), 5);
  };

  if (loading) return <View style={[styles.center, embedded && styles.embeddedLoading]}><ActivityIndicator color={theme.colors.primary} /></View>;

  if (completion) {
    const completionContent = (
      <>
        <View style={styles.completion}>
          <Text style={styles.completionTitle}>Work signed off</Text>
          <Metric label="Service charge" value={`₹${Number(completion.serviceCharge || 0).toLocaleString('en-IN')}`} />
          <Metric label="Spare parts" value={`₹${Number(completion.partsTotal || 0).toLocaleString('en-IN')}`} />
          <Metric label="Total bill" value={`₹${Number(completion.totalBill || 0).toLocaleString('en-IN')}`} />
          <Metric label="Your payout" value={`₹${Number(completion.payoutAmount || 0).toLocaleString('en-IN')}`} />
          <AppButton title="Back to dashboard" onPress={() => navigation.navigate('Home')} style={styles.finishButton} />
        </View>
      </>
    );
    return embedded ? completionContent : (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <AppHeader title="Job completed" subtitle={completion.referenceId || job?.referenceId} onBack={() => goBackOrHome(navigation)} />
        {completionContent}
      </View>
    );
  }

  const titles = ['Check-in', 'Diagnosis', 'Parts', 'Photos', 'Sign-off'];
  const jobTitle = job?.title || job?.equipment || 'Service job';
  const jobLocation = [job?.siteArea, job?.siteAddress].filter(Boolean).join(', ');
  const workflowContent = (
    <>
      <View style={styles.jobSummary}>
        <View style={styles.summaryHeading}>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryEyebrow}>SERVICE REQUEST</Text>
            <Text style={styles.summaryTitle}>{jobTitle}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{String(job?.stage || job?.status || 'Active').replace(/_/g, ' ')}</Text>
          </View>
        </View>
        {jobLocation ? <Text style={styles.locationText} numberOfLines={2}>{jobLocation}</Text> : null}
      </View>
      <View style={styles.progressCard}>
        <View style={styles.progressHeading}>
          <Text style={styles.progressTitle}>Job Workflow</Text>
          <Text style={styles.progressCount}>{Math.round(((step - 1) / titles.length) * 100)}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((step - 1) / titles.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressCount}>Step {Math.min(step, titles.length)} of {titles.length}</Text>
      </View>

      {titles.map((title, index) => {
        const number = index + 1;
        const done = step > number;
        const active = step === number;
        const expanded = expandedStep === number;
        return (
          <View key={title} style={styles.workflowStep}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${title}${done ? ', completed' : active ? ', current step' : ''}`}
              accessibilityState={{ expanded, disabled: !done && !active }}
              onPress={() => setExpandedStep(expanded ? 0 : number)}
              style={styles.workflowStepHeader}
            >
              <View style={[styles.stepDot, (active || done) && styles.stepDotActive]}>
                <Text style={[styles.stepNumber, (active || done) && styles.stepNumberActive]}>{done ? '✓' : number}</Text>
              </View>
              <View style={styles.workflowStepCopy}>
                <Text style={[styles.workflowStepTitle, active && styles.workflowStepTitleActive]}>{title}</Text>
                <Text style={styles.workflowStepSubtitle}>{done ? 'Completed' : active ? 'In progress' : 'Upcoming'}</Text>
              </View>
              <Text style={styles.workflowChevron}>{expanded ? '−' : '+'}</Text>
            </Pressable>
            {expanded ? (
              <View style={styles.workflowStepBody}>
                {number === 1 ? (done ? (
                  <View style={styles.checkedIn}>
                    <Text style={styles.checkedInTitle}>Checked in at site</Text>
                    <Text style={styles.bodySmall}>{job?.checkedInAt ? new Date(job.checkedInAt).toLocaleString() : jobLocation || 'Site arrival recorded'}</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.body}>Confirm that you have arrived at {jobLocation || 'the customer site'} before checking in.</Text>
                    <Text style={styles.notice}>GPS verification is not available yet. Check in only when you are at the service location.</Text>
                    <AppButton title="Check in at site" onPress={() => runAction(() => apiService.checkIn(jobId), 2)} loading={working} disabled={!active} />
                  </>
                )) : null}
                {number === 2 ? (
                  <>
                    <AppTextInput label="Findings" value={findings} onChangeText={setFindings} placeholder="What did you find? Describe the root cause of the fault." multiline styleOverride={styles.multiline} />
                    <Text style={styles.fieldLabel}>Confirmed issue tags</Text>
                    <View style={styles.tagGrid}>
                      {ISSUE_TAGS.map((tag) => (
                        <Pressable key={tag} onPress={() => toggleIssue(tag)} style={[styles.issueTag, issueTags.includes(tag) && styles.issueTagSelected]}>
                          <Text style={[styles.issueText, issueTags.includes(tag) && styles.issueTextSelected]}>{tag}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Pressable onPress={() => setRecommendServiceCenter((current) => !current)} style={styles.checkRow}>
                      <View style={[styles.checkbox, recommendServiceCenter && styles.checkboxSelected]}>
                        <Text style={styles.checkmark}>{recommendServiceCenter ? '✓' : ''}</Text>
                      </View>
                      <Text style={styles.checkLabel}>Recommend Service Center to customer</Text>
                    </Pressable>
                    <AppButton
                      title="Save diagnosis"
                      onPress={() => runAction(() => apiService.saveDiagnosis(jobId, { findings, issueTags, recommendServiceCenter }), 3)}
                      loading={working}
                      disabled={!active}
                    />
                  </>
                ) : null}
                {number === 3 ? (
                  <>
                    <Text style={styles.notice}>Field-replaceable only: fuses, fans, cables, contactors, and terminal blocks. Board-level repairs must go to the service centre.</Text>
                    {parts.map((part, partIndex) => (
                      <View key={partIndex} style={styles.partBlock}>
                        <AppTextInput label={`Part ${partIndex + 1}`} value={part.name} onChangeText={(value) => updatePart(partIndex, 'name', value)} placeholder="Part name" />
                        <View style={styles.partNumbers}>
                          <View style={styles.partNumberField}><AppTextInput label="Qty" value={part.quantity} onChangeText={(value) => updatePart(partIndex, 'quantity', value)} keyboardType="number-pad" /></View>
                          <View style={styles.partNumberField}><AppTextInput label="Unit cost (₹)" value={part.unitCost} onChangeText={(value) => updatePart(partIndex, 'unitCost', value)} keyboardType="decimal-pad" /></View>
                          {parts.length > 1 ? <Pressable onPress={() => setParts((current) => current.filter((_, itemIndex) => itemIndex !== partIndex))} style={styles.removePart}><Text style={styles.removePartText}>Remove</Text></Pressable> : null}
                        </View>
                      </View>
                    ))}
                    <Pressable onPress={() => setParts((current) => [...current, { name: '', quantity: '1', unitCost: '0' }])} style={styles.addPart}><Text style={styles.addPartText}>+ Add part</Text></Pressable>
                    <AppButton title="Save parts" onPress={saveParts} loading={working} disabled={!active} />
                  </>
                ) : null}
                {number === 4 ? (
                  <>
                    <Text style={styles.body}>Add the required before and after photos as proof of the work.</Text>
                    <PhotoPicker label="Before" photo={beforePhoto} onPress={() => choosePhoto('before')} />
                    <PhotoPicker label="After" photo={afterPhoto} onPress={() => choosePhoto('after')} />
                    <Text style={styles.notice}>Photo references are saved with the job. Cloud image upload is not configured.</Text>
                    <AppButton title="Save photos" onPress={savePhotos} loading={working} disabled={!active} />
                  </>
                ) : null}
                {number === 5 ? (
                  <>
                    <Text style={styles.body}>Confirm each item with the customer and enter their sign-off OTP to complete the job.</Text>
                    {CHECKLIST.map((item) => (
                      <Pressable key={item.id} onPress={() => setChecklist((current) => ({ ...current, [item.id]: !current[item.id] }))} style={styles.checkRow}>
                        <View style={[styles.checkbox, checklist[item.id] && styles.checkboxSelected]}><Text style={styles.checkmark}>{checklist[item.id] ? '✓' : ''}</Text></View>
                        <Text style={styles.checkLabel}>{item.label}</Text>
                      </Pressable>
                    ))}
                    <AppTextInput label="Customer OTP" value={customerOtp} onChangeText={setCustomerOtp} placeholder="4-digit OTP" keyboardType="number-pad" maxLength={6} />
                    <Text style={styles.sigLabel}>Customer signature</Text>
                    <SignaturePad onChange={setCustomerSigned} />
                    <AppButton title="Complete job" onPress={complete} loading={working} disabled={!active || !customerOtp || !customerSigned || CHECKLIST.some((item) => !checklist[item.id])} />
                  </>
                ) : null}
                {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </>
  );

  if (embedded) {
    return <View style={styles.embeddedContent}>{workflowContent}</View>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader title="Job Details" subtitle={job?.referenceId || `Job ${jobId}`} onBack={() => goBackOrHome(navigation)} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {workflowContent}
      </ScrollView>
    </View>
  );
};

const PhotoPicker = ({ label, photo, onPress }: { label: string; photo: PhotoDraft | null; onPress: () => void }) => (
  <Pressable onPress={onPress} style={styles.photoBox}>
    {photo ? <Image source={{ uri: photo.uri }} style={styles.photoPreview} /> : <View style={styles.photoPlaceholder}><Text style={styles.photoPlus}>+</Text></View>}
    <View style={styles.photoCopy}>
      <Text style={styles.photoTitle}>{label} photo</Text>
      <Text style={styles.bodySmall}>{photo ? photo.fileName : 'Choose from device'}</Text>
    </View>
    <Text style={styles.photoAction}>{photo ? 'Change' : 'Add'}</Text>
  </Pressable>
);

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>
);

const build_styles = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primaryBackground },
  embeddedLoading: { minHeight: 100 },
  embeddedContent: { marginTop: theme.spacing.md },
  jobSummary: { padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, marginBottom: theme.spacing.md, ...theme.elevation.low },
  summaryHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.sm },
  summaryCopy: { flex: 1 },
  summaryEyebrow: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  summaryTitle: { color: theme.colors.mainText, fontSize: 17, lineHeight: 23, fontWeight: '700', marginTop: 4, flexShrink: 1 },
  statusBadge: { backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { color: theme.colors.brandInk, fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  locationText: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 18, marginTop: 10 },
  progressCard: { padding: theme.spacing.md, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, marginBottom: theme.spacing.md, ...theme.elevation.low },
  progressHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  progressTitle: { color: theme.colors.mainText, fontSize: 14, fontWeight: '700' },
  progressCount: { color: theme.colors.secondaryText, fontSize: 11, fontWeight: '600' },
  progressTrack: { height: 5, backgroundColor: theme.colors.mutedSurface, borderRadius: theme.borderRadius.pill, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.pill },
  workflowStep: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.sm, overflow: 'hidden', ...theme.elevation.low },
  workflowStepHeader: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, gap: theme.spacing.sm },
  workflowStepCopy: { flex: 1 },
  workflowStepTitle: { color: theme.colors.mainText, fontSize: 14, fontWeight: '700' },
  workflowStepTitleActive: { color: theme.colors.brandInk },
  workflowStepSubtitle: { color: theme.colors.textMuted, fontSize: 11, marginTop: 3 },
  workflowChevron: { color: theme.colors.secondaryText, fontSize: 21, fontWeight: '600', paddingHorizontal: 4 },
  workflowStepBody: { borderTopWidth: 1, borderTopColor: theme.colors.border, padding: theme.spacing.md },
  checkedIn: { backgroundColor: theme.colors.successLight, borderRadius: theme.borderRadius.md, padding: theme.spacing.md },
  checkedInTitle: { color: theme.colors.successDark, fontSize: 13, fontWeight: '700' },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.mutedSurface, alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: theme.colors.primary },
  stepNumber: { fontSize: 12, color: theme.colors.secondaryText, fontWeight: '700' },
  stepNumberActive: { color: theme.colors.white },
  currentStep: { color: theme.colors.brandInk, fontSize: 12, fontWeight: '700', marginTop: 8 },
  content: { paddingHorizontal: theme.spacing.md, paddingBottom: 112 },
  formCard: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, padding: theme.spacing.md, ...theme.elevation.low },
  sectionTitle: { color: theme.colors.mainText, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  body: { color: theme.colors.secondaryText, fontSize: 14, lineHeight: 21, marginBottom: 14 },
  notice: { color: theme.colors.infoDark, backgroundColor: theme.colors.infoLight, borderRadius: theme.borderRadius.sm, padding: theme.spacing.sm, fontSize: 12, lineHeight: 18, marginBottom: theme.spacing.md },
  bodySmall: { color: theme.colors.secondaryText, fontSize: 12, marginTop: 4 },
  sigLabel: { color: theme.colors.mainText, fontSize: 13, fontWeight: '700', marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
  fieldLabel: { color: theme.colors.mainText, fontSize: 13, fontWeight: '700', marginBottom: 9 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  tagGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  issueTag: { borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: theme.colors.white },
  issueTagSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.softBrand },
  issueText: { color: theme.colors.secondaryText, fontSize: 12 },
  issueTextSelected: { color: theme.colors.brandInk, fontWeight: '700' },
  partBlock: { borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingTop: 8, marginBottom: 12 },
  partNumbers: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  partNumberField: { flex: 1 },
  removePart: { paddingVertical: 15, paddingHorizontal: 4 },
  removePartText: { color: theme.colors.error, fontSize: 12, fontWeight: '600' },
  addPart: { paddingVertical: 12, marginBottom: 12 },
  addPartText: { color: theme.colors.brandInk, fontWeight: '700' },
  photoBox: { minHeight: 82, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  photoPlaceholder: { height: 56, width: 68, borderRadius: 6, backgroundColor: theme.colors.softBrand, alignItems: 'center', justifyContent: 'center' },
  photoPreview: { height: 56, width: 68, borderRadius: 6 },
  photoPlus: { color: theme.colors.primary, fontSize: 24 },
  photoCopy: { flex: 1, marginLeft: 12 },
  photoTitle: { color: theme.colors.mainText, fontSize: 14, fontWeight: '700' },
  photoAction: { color: theme.colors.brandInk, fontSize: 12, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'center', minHeight: 54, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  checkbox: { width: 23, height: 23, borderRadius: 4, borderWidth: 1.5, borderColor: theme.colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  checkboxSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  checkmark: { color: theme.colors.white, fontSize: 14, fontWeight: '700' },
  checkLabel: { flex: 1, color: theme.colors.mainText, fontSize: 14 },
  error: { color: theme.colors.error, marginTop: 14 },
  completion: { margin: theme.spacing.lg, padding: theme.spacing.md, paddingTop: 24, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, ...theme.elevation.low },
  completionTitle: { color: theme.colors.brandInk, fontSize: 24, fontWeight: '700', marginBottom: 18 },
  metric: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border, flexDirection: 'row', justifyContent: 'space-between' },
  metricLabel: { color: theme.colors.secondaryText, fontSize: 14 },
  metricValue: { color: theme.colors.mainText, fontSize: 17, fontWeight: '700' },
  finishButton: { marginTop: 24 },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
