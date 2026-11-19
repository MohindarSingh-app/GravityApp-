import { useState } from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { Button } from '../../../components/Button';
import { Facts } from '../../../components/Facts';
import { FlowScreen } from '../../../components/FlowScreen';
import {
  PROJECT_FIELD_LABELS,
  buildProject,
  projectTypeDetailFields,
  submittedProject,
  validateProjectDetails,
} from '../../../flows/customerFlow';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useSubmit } from '../../../flows/useSubmit';
import { useTheme } from '../../../theme/ThemeContext';
import { fieldErrors, getErrorMessage } from '../../../utils/errors';
import { uploadPendingAttachments } from '../../../flows/uploadAttachments';

export function ProjectReviewScreen() {
  const navigation = useNavigation();
  const { colors, type } = useTheme();
  const { draft, patch, clear } = useFlowDraft();
  const { sites } = useCompanySites();
  const { phase, submit } = useSubmit();
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const site = sites.find((item) => item.id === draft.siteId);
  const siteName = site
    ? [site.siteName, site.city].filter(Boolean).join(', ')
    : (draft.siteName || '');

  async function onSubmit() {
    const local = validateProjectDetails(draft.fields, draft);
    if (local) {
      setErrors(local);
      setFormError('Check the project details before submitting.');
      return;
    }
    setErrors({});
    setFormError('');
    const { result, error } = await submit(async () => {
      const attachmentIds = await uploadPendingAttachments(draft, patch);
      return customerApi.createProject(buildProject({ ...draft, attachmentIds }));
    });
    if (error) {
      setErrors(fieldErrors(error));
      setFormError(getErrorMessage(error));
      return;
    }
    if (!submittedProject(result)) {
      setFormError('The service did not confirm this project request.');
      return;
    }
    const projectRequest = result.projectRequest;
    const confirmation = result.confirmation;
    clear();
    navigation.replace('ProjectDone', { projectRequest, confirmation });
  }

  const detailRows = ['title', 'description', 'requirements', 'estimatedScope', 'preferredTimeline', 'budgetAmount']
    .filter((key) => (draft.fields || []).includes(key))
    .map((key) => ({ label: PROJECT_FIELD_LABELS[key], value: draft[key] }));
  const projectDetailRows = projectTypeDetailFields(draft.projectTypeCode)
    .filter((field) => String((draft.projectDetailValues || {})[field.key] || '').trim())
    .map((field) => ({
      label: field.label,
      value: draft.projectDetailValues[field.key],
    }));

  return (
    <FlowScreen
      title="Review"
      steps={['Category', 'Type', 'Details', 'Confirm', 'Done']}
      step={3}
      onBack={() => navigation.goBack()}
      error={formError}
      footer={(
        <View style={styles.footer}>
          <Button title="Edit" variant="secondary" onPress={() => navigation.goBack()} />
          <Button title="Submit" loading={phase === 'submitting'} onPress={onSubmit} />
        </View>
      )}
    >
      <Text style={type.display} accessibilityRole="header">Confirm the project</Text>
      <Text style={type.muted}>Nothing is sent until you submit.</Text>
      <Facts
        rows={[
          { label: 'Category', value: draft.categoryName },
          { label: 'Project type', value: draft.projectTypeName },
          { label: 'Site', value: siteName },
          { label: 'Preferred date', value: draft.preferredDate },
          { label: 'Preferred time', value: draft.preferredTime },
          { label: 'Consultation', value: draft.consultationTypeLabel },
          ...detailRows,
          ...projectDetailRows,
        ]}
      />
      {(draft.pendingAttachments || []).map((photo, index) => (
        <Text key={`${photo.fileName}-${index}`} style={type.muted}>
          Attachment: {photo.fileName}
        </Text>
      ))}
      {Object.entries(errors).map(([key, message]) => (
        <Text key={key} style={[type.body, { color: colors.danger }]}>{message}</Text>
      ))}
    </FlowScreen>
  );
}

const styles = {
  footer: {
    gap: 8,
  },
};
