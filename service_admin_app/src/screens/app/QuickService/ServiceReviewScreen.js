import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { Button } from '../../../components/Button';
import { FlowScreen } from '../../../components/FlowScreen';
import { Glyph } from '../../../components/Glyph';
import { BottomSheet } from '../../../components/ui/BottomSheet';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useSubmit } from '../../../flows/useSubmit';
import { uploadPendingAttachments } from '../../../flows/uploadAttachments';
import {
  activeStep,
  applyAnswer,
  buildServiceRequest,
  fieldGroup,
  pathFromTrail,
  phaseProgress,
  reviewRows,
  siteErrors,
  stepFieldErrors,
  submittedService,
  trailError,
  trailSteps,
  visibleFields,
} from '../../../flows/serviceFlow';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { ServiceFieldInput, ServiceOptionCard, SiteOption } from './ServiceFields';

function ReviewRow({ row, onEdit }) {
  const { colors, type } = useTheme();
  const content = (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.rowCopy}>
        <Text style={type.small}>{row.label}</Text>
        <Text style={[type.body, !row.value && { color: colors.muted }]}>{row.value || 'Not set'}</Text>
      </View>
      {onEdit ? <Glyph name="edit" color={colors.primary} size={16} /> : null}
    </View>
  );
  if (!onEdit) return content;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${row.label}`}
      onPress={onEdit}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

export function ServiceReviewScreen() {
  const navigation = useNavigation();
  const { colors, radius, type } = useTheme();
  const { company } = useAuth();
  const { draft, patch, clear } = useFlowDraft();
  const { sites, reload: reloadSites } = useCompanySites();
  const { phase, submit } = useSubmit();
  const [formError, setFormError] = useState('');
  const [editing, setEditing] = useState(null);
  const [local, setLocal] = useState({});
  const [errors, setErrors] = useState({});
  const steps = draft.steps || [];
  const trail = draft.trail || [];
  const categoryCode = draft.categoryCode || '';
  const progress = phaseProgress(trail, 'review');
  const site = sites.find((item) => item.id === draft.siteId) || null;
  const activeSites = sites.filter((item) => !item.status || item.status === 'active');
  const rows = [
    { label: 'Company', value: company && company.companyName },
    { label: 'Category', value: draft.categoryName },
    ...reviewRows(draft, site || {
      siteName: draft.siteName,
      address: draft.siteAddress,
      siteType: draft.siteType,
    }),
  ];

  useFocusEffect(useCallback(() => {
    reloadSites();
  }, [reloadSites]));

  function openEditor(edit) {
    setErrors({});
    if (edit.kind === 'field') setLocal({ ...(draft.answers || {}) });
    setEditing(edit);
  }

  function closeEditor() {
    setEditing(null);
    setErrors({});
  }

  function chooseOption(step, option) {
    const index = editing.index;
    if (trail[index] && trail[index].optionId === option.id) {
      closeEditor();
      return;
    }
    const nextTrail = [...trail.slice(0, index), {
      type: 'choice',
      stepId: step.id,
      optionId: option.id,
      stepTitle: step.title,
      optionName: option.name,
      optionSummary: option.summary || '',
      nextAction: option.nextAction || null,
      nextActionLabel: option.nextActionLabel || null,
    }];
    patch({ trail: nextTrail });
    closeEditor();
    if (activeStep(steps, pathFromTrail(nextTrail))) navigation.navigate('ServiceStep');
  }

  function saveField() {
    const step = steps.find((item) => item.id === editing.stepId);
    const group = fieldGroup(step, editing.fieldId);
    const visible = visibleFields(step, local).filter((field) => group.some((item) => item.id === field.id));
    const nextErrors = stepFieldErrors(visible, local);
    if (nextErrors) {
      setErrors(nextErrors);
      return;
    }
    patch({ answers: local });
    closeEditor();
  }

  function chooseSite(item) {
    patch({
      siteId: item.id,
      siteName: item.siteName,
      siteAddress: item.fullAddress || [item.address, item.city].filter(Boolean).join(', '),
      siteType: item.siteTypeLabel || item.siteType || '',
    });
    closeEditor();
  }

  async function onSubmit() {
    const pathProblem = trailError(draft);
    const siteProblem = siteErrors(draft);
    if (pathProblem || siteProblem) {
      setFormError(pathProblem || siteProblem.siteId);
      return;
    }
    setFormError('');
    const { result, error } = await submit(async () => {
      const attachmentIds = await uploadPendingAttachments(draft, patch);
      return customerApi.createServiceRequest(buildServiceRequest({ ...draft, attachmentIds }));
    });
    if (error) {
      setFormError(getErrorMessage(error));
      return;
    }
    if (!submittedService(result)) {
      setFormError('The service did not confirm this request.');
      return;
    }
    const serviceRequest = result.serviceRequest;
    const confirmation = result.confirmation;
    clear();
    navigation.navigate('ServiceDone', { serviceRequest, confirmation });
  }

  function renderEditor() {
    if (!editing) return null;
    if (editing.kind === 'choice') {
      const step = trailSteps(steps, trail)[editing.index];
      if (!step) return null;
      const chosen = trail[editing.index];
      return (step.options || [])
        .filter((option) => !option.nextAction)
        .map((option) => (
          <ServiceOptionCard
            key={option.id}
            categoryCode={categoryCode}
            option={option}
            selected={Boolean(chosen && chosen.optionId === option.id)}
            onPress={() => chooseOption(step, option)}
          />
        ));
    }
    if (editing.kind === 'field') {
      const step = steps.find((item) => item.id === editing.stepId);
      const group = fieldGroup(step, editing.fieldId);
      const visible = visibleFields(step, local).filter((field) => group.some((item) => item.id === field.id));
      return visible.map((field) => (
        <ServiceFieldInput
          key={field.id}
          categoryCode={categoryCode}
          field={field}
          fields={step.fields}
          answers={local}
          error={errors[field.id]}
          onChange={(fieldId, value) => {
            setLocal((current) => applyAnswer(step.fields, current, fieldId, value));
            setErrors((current) => ({ ...current, [fieldId]: '' }));
          }}
          onManufacturerSaved={(savedField, manufacturer) => {
            patch({
              steps: steps.map((item) => (
                item.id !== step.id ? item : {
                  ...item,
                  fields: item.fields.map((currentField) => (
                    currentField.id !== savedField.id ? currentField : {
                      ...currentField,
                      options: [
                        ...(currentField.options || []).filter((option) => option.value !== manufacturer.value),
                        { value: manufacturer.value, label: manufacturer.label, status: 'active' },
                      ],
                    }
                  )),
                }
              )),
            });
          }}
        />
      ));
    }
    return (
      <>
        {activeSites.map((item) => (
          <SiteOption
            key={item.id}
            site={item}
            selected={item.id === draft.siteId}
            onPress={() => chooseSite(item)}
          />
        ))}
        <Button
          title="+ Add New Site"
          variant="secondary"
          onPress={() => {
            closeEditor();
            const parent = navigation.getParent();
            if (parent) parent.navigate('SitesList');
          }}
        />
      </>
    );
  }

  const editorTitle = !editing ? '' : {
    choice: `Change ${String((trail[editing.index] || {}).stepTitle || '').replace(/^Step \d+\s*[—-]\s*/i, '')}`,
    field: (() => {
      const step = steps.find((item) => item.id === editing.stepId);
      const field = step && (step.fields || []).find((item) => item.id === editing.fieldId);
      return field ? `Edit ${field.label}` : 'Edit';
    })(),
    site: 'Change site',
  }[editing.kind];
  const needsSave = editing && editing.kind === 'field';

  return (
    <FlowScreen
      title="Review"
      steps={progress.labels}
      step={progress.index}
      onBack={() => navigation.goBack()}
      error={formError}
      footer={<Button title="Submit request" loading={phase === 'submitting'} onPress={onSubmit} />}
    >
      <Text style={type.display} accessibilityRole="header">Confirm the request</Text>
      <Text style={type.muted}>Tap any detail to change it. Nothing is saved until you submit.</Text>
      <View style={[styles.card, {
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderRadius: radius.card,
      }]}
      >
        {rows.map((row, index) => (
          <ReviewRow
            key={`${row.label}-${index}`}
            row={row}
            onEdit={row.edit && phase !== 'submitting' ? () => openEditor(row.edit) : null}
          />
        ))}
      </View>

      <BottomSheet
        visible={Boolean(editing)}
        title={editorTitle}
        onClose={closeEditor}
        footer={needsSave ? <Button title="Save" onPress={saveField} /> : null}
      >
        <View style={styles.sheetBody}>{renderEditor()}</View>
      </BottomSheet>
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  sheetBody: {
    gap: 10,
    paddingBottom: 8,
  },
});
