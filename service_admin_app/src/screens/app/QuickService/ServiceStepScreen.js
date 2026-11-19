import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { catalogApi } from '../../../api/resources';
import { Button } from '../../../components/Button';
import { DatePickerField } from '../../../components/DatePickerField';
import { EmptyState } from '../../../components/EmptyState';
import { FlowScreen } from '../../../components/FlowScreen';
import { Glyph } from '../../../components/Glyph';
import { SkeletonStack } from '../../../components/Skeleton';
import { TextField } from '../../../components/TextField';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useAuth } from '../../../hooks/useAuth';
import { Select } from '../../../components/ui/Select';
import { pickAttachmentPhotos } from '../../../utils/pickAttachments';
import { pickServiceDocuments } from '../../../utils/pickServiceDocuments';
import { getErrorMessage } from '../../../utils/errors';
import {
  activeStep,
  applyAnswer,
  pathFromTrail,
  phaseProgress,
  SERVICE_TIME_SLOTS,
  siteErrors,
  stepFieldErrors,
  stepProgress,
  trailError,
  trailSteps,
  unsupportedField,
  visibleFields,
} from '../../../flows/serviceFlow';
import { useTheme } from '../../../theme/ThemeContext';
import { ServiceFieldInput, ServiceOptionCard, SiteOption } from './ServiceFields';

function categoryPresentation(draft) {
  return {
    title: draft.categoryName || '',
    detail: draft.categoryIntro || draft.categorySummary || '',
    glyph: draft.categoryGlyph || 'spark',
  };
}

function showsPhotoUpload(categoryCode, stepCode) {
  if (categoryCode === 'electrician') return stepCode.startsWith('details_electrician_') || stepCode.startsWith('issue_');
  if (categoryCode === 'panel_mcc') {
    return stepCode.startsWith('panel_detail_')
      || ['mcc_details', 'vfd_panel_details', 'busbar_details', 'capacitor_details', 'control_details'].includes(stepCode);
  }
  if (categoryCode === 'cabling') return stepCode.startsWith('scope_');
  if (categoryCode === 'vfd_servo') {
    return stepCode.startsWith('details_')
      || stepCode.startsWith('vfd_detail_')
      || stepCode.startsWith('motor_detail_')
      || stepCode === 'motor_rewind_details';
  }
  if (categoryCode === 'plc') return stepCode.startsWith('plc_issue_');
  return false;
}

function sectionTitle(index, title) {
  const clean = String(title || '').replace(/^Step \d+\s*[—-]\s*/i, '');
  return `STEP ${index + 1} — ${clean.toUpperCase()}`;
}

export function ServiceStepScreen() {
  const navigation = useNavigation();
  const scrollRef = useRef(null);
  const { colors, radius, type } = useTheme();
  const { company } = useAuth();
  const { draft, patch } = useFlowDraft();
  const { sites, loading: sitesLoading, error: sitesError, reload: reloadSites } = useCompanySites();
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [addingMakeStep, setAddingMakeStep] = useState('');
  const [newMake, setNewMake] = useState('');
  const [savingMake, setSavingMake] = useState(false);
  const [makeError, setMakeError] = useState('');
  const steps = draft.steps || [];
  const trail = draft.trail || [];
  const answers = draft.answers || {};
  const doneSteps = trailSteps(steps, trail);
  const current = activeStep(steps, pathFromTrail(trail));
  const finished = !current;
  const currentStepId = current ? current.id : '';
  const categoryCode = draft.categoryCode || '';
  const presentation = categoryPresentation(draft);
  const progress = finished ? phaseProgress(trail, 'site') : stepProgress(trail, current.title);
  const activeSites = sites.filter((site) => !site.status || site.status === 'active');
  const sectionY = useRef({});
  const fieldY = useRef({});
  const dependentScrollTimer = useRef(null);

  const scrollToSpot = useCallback((sectionKey, fieldId) => {
    const y = (sectionY.current[sectionKey] || 0) + (fieldId ? (fieldY.current[fieldId] || 0) : 0);
    if (scrollRef.current) scrollRef.current.scrollTo({ y: Math.max(0, y - 16), animated: true });
  }, []);

  function firstError(step, nextErrors) {
    return visibleFields(step, answers).find((field) => nextErrors[field.id]);
  }

  useFocusEffect(useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: false });
    reloadSites();
  }, [reloadSites]));

  useEffect(() => {
    const activeSection = currentStepId || (finished ? 'site' : '');
    if (!activeSection) return undefined;
    const timer = setTimeout(() => {
      scrollToSpot(activeSection);
    }, 180);
    return () => clearTimeout(timer);
  }, [currentStepId, finished, scrollToSpot, trail.length]);

  useEffect(() => () => {
    if (dependentScrollTimer.current) clearTimeout(dependentScrollTimer.current);
  }, []);

  function choose(index, step, option) {
    if (option.nextAction === 'repair_center') {
      const parent = navigation.getParent();
      if (parent) parent.navigate('RepairCenter');
      else navigation.navigate('RepairCenter');
      return;
    }
    if (option.nextAction === 'projects') {
      const parent = navigation.getParent();
      if (parent) parent.navigate('Projects', { screen: 'ProjectCategory' });
      else navigation.navigate('Projects', { screen: 'ProjectCategory' });
      return;
    }
    if (trail[index] && trail[index].optionId === option.id) return;
    patch({
      trail: [...trail.slice(0, index), {
        type: 'choice',
        stepId: step.id,
        optionId: option.id,
        stepTitle: step.title,
        optionName: option.name,
        optionSummary: option.summary || '',
        nextAction: option.nextAction || null,
        nextActionLabel: option.nextActionLabel || null,
      }],
    });
    setErrors({});
    setFormError('');
  }

  function setAnswer(step, fieldId, value) {
    const nextAnswers = applyAnswer(step.fields, answers, fieldId, value);
    patch({ answers: nextAnswers });
    if (errors[fieldId]) setErrors((existing) => ({ ...existing, [fieldId]: '' }));
    const changedField = (step.fields || []).find((field) => field.id === fieldId);
    const dependentKeys = changedField && changedField.key === 'make'
      ? (value === 'other' ? ['specify_make'] : ['drive_model', 'model'])
      : changedField && changedField.key === 'screen_size' && value === 'other'
        ? ['screen_size_other']
        : changedField && changedField.key === 'problem_type' && value === 'error_code'
          ? ['error_code']
          : [];
    const target = visibleFields(step, nextAnswers).find((field) => dependentKeys.includes(field.key));
    if (target) {
      if (dependentScrollTimer.current) clearTimeout(dependentScrollTimer.current);
      dependentScrollTimer.current = setTimeout(() => scrollToSpot(step.id, target.id), 180);
    }
  }

  function addManufacturerFieldOption(step, field, manufacturer) {
    const option = { value: manufacturer.value, label: manufacturer.label, status: 'active' };
    patch({
      steps: steps.map((item) => (
        item.id !== step.id ? item : {
          ...item,
          fields: item.fields.map((currentField) => (
            currentField.id !== field.id ? currentField : {
              ...currentField,
              options: [
                ...(currentField.options || []).filter((existingOption) => existingOption.value !== option.value),
                option,
              ],
            }
          )),
        }
      )),
    });
  }

  function isMakeChoice(step) {
    return step.kind === 'choice' && /make|brand/i.test(`${step.code || ''} ${step.title || ''}`);
  }

  async function saveChoiceManufacturer(index, step) {
    setMakeError('');
    const name = newMake.trim().replace(/\s+/g, ' ');
    if (!name) {
      setMakeError('Enter a make or brand name.');
      return;
    }
    setSavingMake(true);
    try {
      const result = await catalogApi.addManufacturer(name);
      const manufacturer = result && result.manufacturer;
      const option = (result && result.options || []).find((item) => item.stepId === step.id);
      if (!manufacturer || !option) {
        throw new Error('The service did not add this make to the selected service step.');
      }
      const nextSteps = steps.map((item) => (
        item.id !== step.id ? item : {
          ...item,
          options: [...(item.options || []).filter((existingOption) => existingOption.id !== option.id), option],
        }
      ));
      patch({ steps: nextSteps });
      choose(index, { ...step, options: [...(step.options || []), option] }, option);
      setNewMake('');
      setAddingMakeStep('');
    } catch (err) {
      setMakeError(err && err.message ? err.message : 'Unable to save this make or brand.');
    } finally {
      setSavingMake(false);
    }
  }

  function completeForm(step) {
    const nextErrors = stepFieldErrors(visibleFields(step, answers), answers);
    if (nextErrors) {
      setErrors(nextErrors);
      const field = firstError(step, nextErrors);
      scrollToSpot(step.id, field && field.id);
      return;
    }
    patch({ trail: [...trail, { type: 'form', stepId: step.id, stepTitle: step.title }] });
    setErrors({});
  }

  function chooseSite(site) {
    patch({
      siteId: site.id,
      siteName: site.siteName,
      siteAddress: site.fullAddress || [site.address, site.city].filter(Boolean).join(', '),
      siteType: site.siteTypeLabel || site.siteType || '',
    });
    setErrors((existing) => ({ ...existing, siteId: '' }));
  }

  function review() {
    for (const step of doneSteps) {
      if (step.kind !== 'form') continue;
      const stepErrors = stepFieldErrors(visibleFields(step, answers), answers);
      if (stepErrors) {
        setErrors(stepErrors);
        const field = firstError(step, stepErrors);
        scrollToSpot(step.id, field && field.id);
        return;
      }
    }
    const siteProblem = siteErrors(draft);
    if (siteProblem && siteProblem.siteId) {
      setErrors({ siteId: siteProblem.siteId });
      scrollToSpot('site');
      return;
    }
    const pathProblem = trailError(draft);
    if (pathProblem) {
      setFormError(pathProblem);
      if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: true });
      return;
    }
    setFormError('');
    navigation.navigate('ServiceReview');
  }

  async function addPhotos() {
    setPhotoError('');
    try {
      const maxPhotos = categoryCode === 'vfd_servo' ? 3 : 5;
      const alreadySelected = (draft.pendingAttachments || [])
        .filter((attachment) => !attachment.attachmentKind || attachment.attachmentKind === 'photo').length
        + (draft.attachmentIds || []).length;
      if (alreadySelected >= maxPhotos) {
        setPhotoError(`Choose no more than ${maxPhotos} photos.`);
        return;
      }
      const selected = await pickAttachmentPhotos(maxPhotos - alreadySelected);
      if (selected.length) {
        patch({
          pendingAttachments: [
            ...(draft.pendingAttachments || []),
            ...selected.map((attachment) => ({ ...attachment, attachmentKind: 'photo' })),
          ],
        });
      }
    } catch (error) {
      setPhotoError(getErrorMessage(error));
    }
  }

  async function addDocuments(kind) {
    setPhotoError('');
    try {
      const pending = draft.pendingAttachments || [];
      const total = pending.length + (draft.attachmentIds || []).length;
      if (total >= 10) {
        setPhotoError('Choose no more than 10 attachments.');
        return;
      }
      const selected = await pickServiceDocuments(kind, 10 - total);
      if (selected.length) patch({ pendingAttachments: [...pending, ...selected] });
    } catch (error) {
      setPhotoError(getErrorMessage(error));
    }
  }

  function removeAttachment(index) {
    patch({
      pendingAttachments: (draft.pendingAttachments || []).filter((_, position) => position !== index),
    });
  }

  if (!draft.categoryId || !Array.isArray(draft.steps)) {
    return (
      <FlowScreen title="Quick services" onBack={() => navigation.goBack()}>
        <EmptyState
          title="Choose a category"
          message="Open quick services and pick a category before the service steps."
          action={<Button title="Back" variant="secondary" onPress={() => navigation.goBack()} />}
        />
      </FlowScreen>
    );
  }

  function renderPhotos(stepCode) {
    const attachments = draft.pendingAttachments || [];
    const isMccDetail = categoryCode === 'panel_mcc' && stepCode === 'mcc_details';
    const documentCards = [
      { kind: 'photo', label: 'Photos', detail: 'Site / equipment' },
      { kind: 'pdf', label: 'PDF / Layout', detail: 'SLD / drawings' },
      { kind: 'cad', label: 'CAD Drawings', detail: 'DWG / DXF' },
      { kind: 'documents', label: 'Documents', detail: 'Spec / datasheet' },
    ];
    return (
      <View style={styles.group}>
        {isMccDetail ? (
          <View style={[styles.documentBox, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
            <Text style={type.heading}>Upload documents — faster, better quote</Text>
            <Text style={type.small}>
              Site layout / SLD, motor nameplates, existing panel photos, and equipment datasheets help the engineer prepare.
            </Text>
            <View style={styles.documentGrid}>
              {documentCards.map((document) => (
                <Pressable
                  key={document.kind}
                  accessibilityRole="button"
                  onPress={() => (document.kind === 'photo' ? addPhotos() : addDocuments(document.kind))}
                  style={({ pressed }) => [
                    styles.documentCard,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      borderRadius: radius.card,
                    },
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Glyph name={document.kind === 'photo' ? 'camera' : 'document'} color={colors.primary} size={20} />
                  <Text style={[type.label, styles.documentTitle]} numberOfLines={2}>{document.label}</Text>
                  <Text style={[type.small, styles.documentDetail]} numberOfLines={2}>{document.detail}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <>
            <Text style={type.label}>Photos (optional)</Text>
            <Text style={type.muted}>
              Add up to {categoryCode === 'vfd_servo' ? 3 : 5} photos to help the specialist prepare.
            </Text>
            <Button title="Add photos" variant="secondary" onPress={addPhotos} />
          </>
        )}
        {photoError ? <Text style={[type.small, { color: colors.danger }]}>{photoError}</Text> : null}
        {attachments.map((attachment, index) => (
          <View key={`${attachment.fileName}-${index}`} style={styles.photoRow}>
            <Text style={[type.small, styles.photoName]}>{attachment.fileName}</Text>
            <Button title="Remove" variant="ghost" onPress={() => removeAttachment(index)} />
          </View>
        ))}
      </View>
    );
  }

  function renderSection(step, index) {
    const unknown = step.kind === 'form' ? unsupportedField(step.fields) : null;
    const chosen = trail[index];
    return (
      <View
        key={step.id}
        style={styles.section}
        onLayout={(event) => { sectionY.current[step.id] = event.nativeEvent.layout.y; }}
      >
        {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
        <Text style={type.label} accessibilityRole="header">
          {index === 0 && step.kind === 'choice'
            ? (categoryCode === 'panel_mcc'
              ? 'STEP 1 — SELECT PANEL TYPE'
              : categoryCode === 'cabling'
                ? 'STEP 1 — SELECT CABLE TYPE'
                : categoryCode === 'vfd_servo'
                  ? 'STEP 1 — WHAT WORK IS NEEDED?'
                  : 'STEP 1 — SELECT WORK TYPE')
            : sectionTitle(index, step.title)}
        </Text>
        {index > 0 && step.summary ? <Text style={type.muted}>{step.summary}</Text> : null}
        {unknown ? (
          <EmptyState
            title="This service form needs attention"
            message={`${(unknown && (unknown.label || unknown.key)) || 'A service field'} is missing or incorrectly configured. Please choose another service or contact support while this form is fixed.`}
          />
        ) : null}
        {step.kind === 'choice' && (step.options || []).length === 0 ? (
          <EmptyState title="No services available" message={`Nothing is available for ${step.title}.`} />
        ) : null}
        {step.kind === 'choice' && step.code === 'vfd_panel_make' && (step.options || []).length > 0 ? (
          <Select
            label="VFD Panel Make/Brand"
            value={chosen ? chosen.optionId : ''}
            placeholder="Select Make/Brand..."
            options={(step.options || []).map((option) => ({ value: option.id, label: option.name }))}
            onChange={(optionId) => {
              const option = (step.options || []).find((item) => item.id === optionId);
              if (option) choose(index, step, option);
            }}
          />
        ) : null}
        {step.kind === 'choice' && step.code !== 'vfd_panel_make' ? (
          <View style={styles.choiceGrid}>
            {(step.options || []).map((option, optionIndex) => (
              <View
                key={option.id}
                style={[
                  styles.choiceCell,
                  optionIndex === step.options.length - 1 && step.options.length % 2 === 1
                    ? styles.choiceLastCell
                    : null,
                ]}
              >
                <ServiceOptionCard
                  categoryCode={categoryCode}
                  option={option}
                  compact
                  selected={Boolean(chosen && chosen.optionId === option.id)}
                  onPress={() => choose(index, step, option)}
                />
              </View>
            ))}
          </View>
        ) : null}
        {isMakeChoice(step) ? (
          addingMakeStep === step.id ? (
            <>
              <TextField
                label="New make / brand name"
                value={newMake}
                onChangeText={setNewMake}
                error={makeError}
                placeholder="Enter manufacturer name"
                autoCapitalize="words"
              />
              <Button
                title="Save and select"
                loading={savingMake}
                onPress={() => saveChoiceManufacturer(index, step)}
              />
              <Button
                title="Cancel"
                variant="ghost"
                disabled={savingMake}
                onPress={() => {
                  setAddingMakeStep('');
                  setNewMake('');
                  setMakeError('');
                }}
              />
            </>
          ) : (
            <Button
              title="+ Add a new make / brand"
              variant="secondary"
              onPress={() => {
                setMakeError('');
                setAddingMakeStep(step.id);
              }}
            />
          )
        ) : null}
        {step.kind === 'form' && !unknown ? visibleFields(step, answers).map((field) => (
          <View key={field.id} onLayout={(event) => { fieldY.current[field.id] = event.nativeEvent.layout.y; }}>
            <ServiceFieldInput
              categoryCode={categoryCode}
              field={field}
              fields={step.fields}
              answers={answers}
              error={errors[field.id]}
              onChange={(fieldId, value) => setAnswer(step, fieldId, value)}
              onManufacturerSaved={(savedField, manufacturer) => addManufacturerFieldOption(step, savedField, manufacturer)}
            />
          </View>
        )) : null}
        {step.kind === 'form' && showsPhotoUpload(categoryCode, step.code || '')
          ? renderPhotos(step.code || '')
          : null}
      </View>
    );
  }

  const sections = current ? [...doneSteps, current] : doneSteps;
  const nextAfterForm = current && current.kind === 'form'
    ? activeStep(steps, pathFromTrail([...trail, { type: 'form', stepId: current.id }]))
    : null;
  const formLabel = nextAfterForm
    ? `Next — ${String(nextAfterForm.title || '').replace(/^Step \d+\s*[—-]\s*/i, '')}`
    : 'Next — Select Site';

  const formReady = Boolean(current && current.kind === 'form'
    && !unsupportedField(current.fields)
    && !stepFieldErrors(visibleFields(current, answers), answers));

  let footer = null;
  if (finished && draft.siteId) footer = <Button title="Review request" onPress={review} />;
  else if (formReady) {
    footer = <Button title={formLabel} onPress={() => completeForm(current)} />;
  }

  return (
    <FlowScreen
      title={presentation.title || draft.categoryName}
      steps={progress.labels}
      step={progress.index < 0 ? 0 : progress.index}
      onBack={() => navigation.goBack()}
      error={formError}
      footer={footer}
      scrollRef={scrollRef}
    >
      <View style={[styles.banner, {
        backgroundColor: colors.primaryLight,
        borderColor: colors.primary,
        borderRadius: radius.card,
      }]}
      >
        <View style={[styles.bannerIcon, { backgroundColor: colors.primary, borderRadius: radius.chip }]}>
          <Glyph name={presentation.glyph} color={colors.onAccent} size={20} />
        </View>
        <View style={styles.bannerCopy}>
          <Text style={[type.heading, { color: colors.primary }]}>{presentation.title}</Text>
          {presentation.detail ? <Text style={type.small}>{presentation.detail}</Text> : null}
        </View>
      </View>

      {sections.map((step, index) => renderSection(step, index))}

      {finished ? (
        <View
          style={styles.section}
          onLayout={(event) => { sectionY.current.site = event.nativeEvent.layout.y; }}
        >
          <Text style={type.heading}>Date &amp; Time</Text>
          <DatePickerField
            label="Preferred date"
            value={draft.preferredDate || ''}
            onChange={(preferredDate) => patch({ preferredDate })}
            hint="Optional"
          />
          <Text style={type.label}>Preferred time</Text>
          <View style={styles.timeGrid}>
            {SERVICE_TIME_SLOTS.map((slot) => {
              const selected = draft.preferredTime === slot.value;
              return (
                <Pressable
                  key={slot.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => patch({ preferredTime: slot.value })}
                  style={[
                    styles.timeSlot,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primaryLight : colors.surface,
                      borderRadius: radius.md,
                    },
                  ]}
                >
                  <Text style={[type.body, { color: selected ? colors.primary : colors.text }]}>{slot.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={type.label} accessibilityRole="header">
            {`STEP ${sections.length + 1} — WHICH SITE?`}
          </Text>
          {sitesLoading && sites.length === 0 ? <SkeletonStack rows={2} /> : null}
          {!sitesLoading && sitesError ? (
            <ErrorState title="Unable to load sites" message={sitesError} onRetry={reloadSites} />
          ) : null}
          {!sitesLoading && !sitesError && activeSites.length === 0 ? (
            <EmptyState
              title="No sites available"
              message="Add a site for this company before booking a service."
              action={(
                <Button
                  title="Add a site"
                  variant="secondary"
                  onPress={() => {
                    const parent = navigation.getParent();
                    if (parent) parent.navigate('SitesList');
                  }}
                />
              )}
            />
          ) : null}
          {activeSites.map((site) => (
            <SiteOption
              key={site.id}
              site={site}
              selected={site.id === draft.siteId}
              onPress={() => chooseSite(site)}
            />
          ))}
          {activeSites.length ? (
            <Button
              title="+ Add New Site"
              variant="secondary"
              onPress={() => {
                const parent = navigation.getParent();
                if (parent) parent.navigate('SitesList');
              }}
            />
          ) : null}
          {company && (company.companyName || company.gstNumber || company.gst) ? (
            <View style={[styles.companyCard, {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.card,
            }]}
            >
              <Text style={type.label}>COMPANY DETAILS</Text>
              {company.companyName ? <Text style={type.body}>{company.companyName}</Text> : null}
              {company.gstNumber || company.gst ? (
                <Text style={type.small}>{`GSTIN: ${company.gstNumber || company.gst}`}</Text>
              ) : null}
            </View>
          ) : null}
          {errors.siteId ? <Text style={[type.small, { color: colors.danger }]}>{errors.siteId}</Text> : null}
        </View>
      ) : null}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 76,
    padding: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bannerIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCopy: {
    flex: 1,
    gap: 2,
  },
  section: {
    gap: 10,
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  choiceCell: {
    width: '48%',
  },
  choiceLastCell: {
    width: '100%',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlot: {
    width: '47%',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  companyCard: {
    borderWidth: 1,
    gap: 4,
    padding: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
  },
  group: {
    gap: 8,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  photoName: {
    flex: 1,
  },
  documentBox: {
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  documentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  documentCard: {
    width: '48%',
    minHeight: 92,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  documentTitle: {
    flexShrink: 1,
  },
  documentDetail: {
    flexShrink: 1,
  },
});
