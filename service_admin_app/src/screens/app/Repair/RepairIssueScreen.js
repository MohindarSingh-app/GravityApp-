import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../../components/Button';
import { FlowScreen } from '../../../components/FlowScreen';
import { Select } from '../../../components/ui/Select';
import { TextField } from '../../../components/TextField';
import { Card } from '../../../components/ui/Card';
import {
  REPAIR_FAULT_FREQUENCIES,
  siteLabel,
} from '../../../flows/customerFlow';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { captureAttachmentPhoto, pickAttachmentPhotos } from '../../../utils/pickAttachments';
import { REPAIR_STEPS } from './repairFlow';

const WARRANTY_OPTIONS = [
  { value: 'In Warranty', label: 'In Warranty' },
  { value: 'Out of Warranty', label: 'Out of Warranty' },
  { value: 'Not Sure', label: 'Not Sure' },
];

export function RepairIssueScreen() {
  const navigation = useNavigation();
  const { colors, type } = useTheme();
  const { draft, patch } = useFlowDraft();
  const { sites } = useCompanySites();
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const pendingAttachments = draft.pendingAttachments || [];

  async function addPhotos() {
    setPhotoError('');
    try {
      const remaining = 5 - pendingAttachments.length;
      if (remaining < 1) {
        setPhotoError('You can attach up to 5 photos.');
        return;
      }
      const selected = await pickAttachmentPhotos(remaining);
      if (selected.length) patch({ pendingAttachments: [...pendingAttachments, ...selected] });
    } catch (pickerError) {
      setPhotoError(getErrorMessage(pickerError));
    }
  }

  async function takePhoto() {
    setPhotoError('');
    if (pendingAttachments.length >= 5) {
      setPhotoError('You can attach up to 5 photos.');
      return;
    }
    try {
      const photo = await captureAttachmentPhoto();
      if (photo) patch({ pendingAttachments: [...pendingAttachments, photo] });
    } catch (pickerError) {
      setPhotoError(getErrorMessage(pickerError));
    }
  }

  function removePhoto(index) {
    patch({ pendingAttachments: pendingAttachments.filter((_, current) => current !== index) });
  }

  function valuesForSubmission() {
    return {
      ...draft,
      issueDescription: draft.issueDescription || draft.faultDescription || '',
      symptoms: draft.symptoms
        || (draft.selectedFaultTags || []).join(', ')
        || draft.faultDescription
        || draft.issueDescription
        || '',
      faultInformation: draft.faultInformation || draft.faultDescription || draft.issueDescription || '',
      priority: draft.priority || 'normal',
    };
  }

  function continueToSite() {
    const values = valuesForSubmission();
    if (String(values.issueDescription).trim().length < 2) {
      setErrors({ issueDescription: 'Describe the issue.' });
      setFormError('Enter the issue description before selecting a site.');
      return;
    }
    setErrors({});
    setFormError('');
    patch(values);
    navigation.navigate('RepairBookingSite');
  }

  return (
    <FlowScreen
      title="Issue Details"
      steps={draft.recommendedRepairFlow
        ? ['Recommendation', 'Service Scope', 'Issue Details', 'Select Site', 'Confirm Booking']
        : REPAIR_STEPS}
      step={draft.recommendedRepairFlow ? 2 : 6}
      onBack={() => navigation.goBack()}
      error={formError}
      footer={(
        <Button
          title="Next — Select Site ›"
          onPress={continueToSite}
        />
      )}
    >
      <Text style={type.display} accessibilityRole="header">Issue Details</Text>
      <Text style={type.muted}>
        {[draft.manufacturer, draft.model, draft.serialNumber, siteLabel(sites, draft.siteId)].filter(Boolean).join(' · ')}
      </Text>
      <Card style={{ backgroundColor: colors.primaryLight, borderColor: colors.primarySoft }}>
        <Text style={[type.heading, { color: colors.primary }]}>
          AI — {draft.repairDeviceLabel || 'Repair Request'}
        </Text>
        <Text style={type.body}>
          Provide as much detail as possible — this helps our technicians diagnose the fault faster and prepare a more accurate repair quote.
        </Text>
      </Card>
      <Text style={type.muted}>
        Service scope: {draft.repairScopeLabel || 'Not selected'} · {draft.repairLogisticsLabel || 'Logistics not selected'}
      </Text>
      <TextField
        label={draft.recommendedRepairFlow ? 'Issue Description *' : 'Issue Description'}
        value={draft.issueDescription || draft.faultDescription || ''}
        onChangeText={(issueDescription) => patch({ issueDescription })}
        error={errors.issueDescription}
        placeholder="Describe the fault — symptoms, error messages, when it started..."
        multiline
        maxLength={4000}
      />
      <TextField
        label="Error Code (if any)"
        value={draft.errorCode || draft.faultErrorCode || ''}
        onChangeText={(errorCode) => patch({ errorCode })}
        placeholder="e.g. E.OC1, AL.37, F0001"
        autoCapitalize="characters"
      />
      <Select
        label="Fault Frequency"
        value={draft.faultFrequency || ''}
        placeholder="— Select —"
        options={REPAIR_FAULT_FREQUENCIES}
        onChange={(faultFrequency) => patch({ faultFrequency })}
      />
      <TextField
        label="Downtime Loss (₹/hr)"
        value={draft.downtimeLoss || ''}
        onChangeText={(downtimeLoss) => patch({ downtimeLoss })}
        placeholder="Estimated production loss per hour"
        keyboardType="numeric"
        maxLength={12}
        error={errors.downtimeLoss}
      />
      <TextField
        label="Fault Type / Symptoms"
        value={draft.symptoms || (draft.selectedFaultTags || []).join(', ') || draft.faultDescription || ''}
        onChangeText={(symptoms) => patch({ symptoms })}
        error={errors.symptoms}
        placeholder="Choose fault tags or describe the symptoms"
        multiline
        maxLength={2000}
      />
      <TextField
        label="Fault details"
        value={draft.faultInformation || draft.faultDescription || ''}
        onChangeText={(faultInformation) => patch({ faultInformation })}
        error={errors.faultInformation}
        multiline
        maxLength={2000}
      />
      <Select
        label="Warranty Status"
        value={draft.warrantyStatus || ''}
        placeholder="— Select —"
        options={WARRANTY_OPTIONS}
        onChange={(warrantyStatus) => patch({ warrantyStatus })}
      />
      <View>
        <Text style={type.label}>Photos (nameplate, fault display, damage)</Text>
        <Text style={type.muted}>Camera or gallery — max 5 photos</Text>
        <View style={styles.photoButtons}>
          <View style={styles.photoButton}>
            <Button title="Take Photo" variant="secondary" onPress={takePhoto} />
          </View>
          <View style={styles.photoButton}>
            <Button title="Choose Photos" variant="secondary" onPress={addPhotos} />
          </View>
        </View>
        {photoError ? <Text style={[type.body, { color: colors.danger }]}>{photoError}</Text> : null}
        {pendingAttachments.map((photo, index) => (
          <View key={`${photo.fileName}-${index}`} style={styles.photoRow}>
            <Text style={type.small} numberOfLines={1}>{photo.fileName}</Text>
            <Button title="Remove" variant="ghost" onPress={() => removePhoto(index)} />
          </View>
        ))}
        {!pendingAttachments.length ? <Text style={type.muted}>No photos attached (optional).</Text> : null}
      </View>
      {errors.deviceId ? <Text style={[type.body, { color: colors.danger }]}>{errors.deviceId}</Text> : null}
      {errors.repairScope ? <Text style={[type.body, { color: colors.danger }]}>{errors.repairScope}</Text> : null}
      {errors.serviceType ? <Text style={[type.body, { color: colors.danger }]}>{errors.serviceType}</Text> : null}
      {errors.priority ? <Text style={[type.body, { color: colors.danger }]}>{errors.priority}</Text> : null}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  photoButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  photoButton: {
    flex: 1,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
