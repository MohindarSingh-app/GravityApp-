import { useCallback, useRef, useState } from 'react';
import {
  AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Button } from '../../../components/Button';
import { DatePickerField } from '../../../components/DatePickerField';
import { Glyph } from '../../../components/Glyph';
import { FlowScreen } from '../../../components/FlowScreen';
import { SitePicker } from '../../../components/SitePicker';
import { TextField } from '../../../components/TextField';
import {
  PROJECT_FIELD_LABELS,
  projectTypeDetailFields,
  projectTypePresentation,
  validateProjectDetails,
} from '../../../flows/customerFlow';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useTheme } from '../../../theme/ThemeContext';
import { pickAttachmentPhotos } from '../../../utils/pickAttachments';
import { getErrorMessage } from '../../../utils/errors';
import { useFormNavigationField } from '../../../components/forms/FormNavigation';

const ORDER = ['description', 'requirements', 'estimatedScope', 'preferredTimeline', 'budgetAmount'];
const PROJECT_TIMES = [
  { value: '09:00', label: '9:00 AM' },
  { value: '12:00', label: '12:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '18:00', label: '6:00 PM' },
];
const CONSULTATION_OPTIONS = [
  {
    value: 'free_call',
    title: 'Free Call Discussion',
    detail: 'Our expert will call you within 2 hours',
    note: 'Always Free',
    glyph: 'call',
  },
  {
    value: 'site_visit',
    title: 'Site Visit & Assessment',
    detail: 'Expert visits your site, assesses and quotes',
    note: '₹500 visit · adjusted in invoice',
    glyph: 'pin',
  },
  {
    value: 'requirements_only',
    title: 'Submit Requirements Only',
    detail: 'We review documents and send quote',
    note: 'Free · 24hr response',
    glyph: 'document',
  },
];

export function ProjectDetailsScreen() {
  const navigation = useNavigation();
  const { type, colors, radius } = useTheme();
  const { draft, patch } = useFlowDraft();
  const { sites, loading, error: siteError, reload } = useCompanySites();
  const [errors, setErrors] = useState({});
  const [photoError, setPhotoError] = useState('');
  const timeFieldRef = useRef(null);
  const firstTimeRef = useRef(null);
  const focusTimeField = useCallback(() => {
    const target = firstTimeRef.current && findNodeHandle(firstTimeRef.current);
    if (target != null) AccessibilityInfo.setAccessibilityFocus(target);
  }, []);
  const timeField = useFormNavigationField(focusTimeField, PROJECT_TIMES.length > 0, timeFieldRef);
  const fields = draft.fields || [];
  const projectPresentation = projectTypePresentation(draft.projectTypeCode);
  const projectDetails = projectTypeDetailFields(draft.projectTypeCode);

  useFocusEffect(useCallback(() => {
    reload();
  }, [reload]));

  async function addPhotos() {
    setPhotoError('');
    try {
      const selected = await pickAttachmentPhotos();
      const pendingAttachments = [...(draft.pendingAttachments || []), ...selected];
      if (pendingAttachments.length > 5) {
        setPhotoError('Choose no more than 5 photos.');
        return;
      }
      if (selected.length) patch({ pendingAttachments });
    } catch (error) {
      setPhotoError(getErrorMessage(error));
    }
  }

  function removePhoto(index) {
    patch({
      pendingAttachments: (draft.pendingAttachments || []).filter((_, current) => current !== index),
    });
  }

  function onContinue() {
    const local = validateProjectDetails(fields, draft);
    if (local || !draft.consultationType) {
      setErrors({
        ...(local || {}),
        ...(!draft.consultationType ? { consultationType: 'Choose how you would like to proceed.' } : {}),
      });
      return;
    }
    setErrors({});
    navigation.navigate('ProjectReview');
  }

  return (
    <FlowScreen
      title="Project details"
      steps={['Category', 'Type', 'Details', 'Confirm', 'Done']}
      step={2}
      onBack={() => navigation.goBack()}
      error={siteError}
      refreshing={loading && sites.length > 0}
      onRefresh={reload}
      footer={fields.length ? <Button title="Review" onPress={onContinue} /> : null}
    >
      <Text style={type.display} accessibilityRole="header">{draft.projectTypeName || 'Project details'}</Text>
      <Text style={type.muted}>{draft.categoryName}</Text>
      {projectPresentation ? <Text style={type.body}>{projectPresentation.intro}</Text> : null}
      {!draft.projectTypeCode ? (
        <Text style={type.muted}>Choose a project type before entering details.</Text>
      ) : null}
      {fields.includes('title') ? (
        <TextField
          label={PROJECT_FIELD_LABELS.title}
          value={draft.title || ''}
          onChangeText={(title) => patch({ title })}
          error={errors.title}
        />
      ) : null}
      <Text style={type.heading}>Date &amp; Time</Text>
      <DatePickerField
        label="Preferred date"
        value={draft.preferredDate || ''}
        onChange={(preferredDate) => patch({ preferredDate })}
        hint="Optional"
      />
      <Text style={type.label}>Preferred time</Text>
      <View
        ref={timeFieldRef}
        collapsable={false}
        style={styles.scheduleGrid}
        accessibilityRole="radiogroup"
        accessibilityLabel="Preferred time"
      >
        {PROJECT_TIMES.map((slot, index) => {
          const selected = draft.preferredTime === slot.value;
          return (
            <Pressable
              key={slot.value}
              ref={index === 0 ? firstTimeRef : undefined}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                patch({ preferredTime: slot.value });
                timeField.advance();
              }}
              style={[
                styles.scheduleOption,
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
      {fields.includes('siteId') ? (
        <SitePicker
          label="Site"
          sites={sites}
          value={draft.siteId}
          error={errors.siteId}
          onChange={(siteId, siteName) => patch({ siteId, siteName })}
          onAddSite={() => {
            const parent = navigation.getParent();
            if (parent) parent.navigate('SitesList');
          }}
        />
      ) : null}
      {projectDetails.length ? (
        <>
          <Text style={type.label}>Project requirements</Text>
          {projectDetails.map((field) => (
            <TextField
              key={field.key}
              label={field.label}
              value={(draft.projectDetailValues && draft.projectDetailValues[field.key]) || ''}
              onChangeText={(value) => patch({
                projectDetailValues: {
                  ...(draft.projectDetailValues || {}),
                  [field.key]: value,
                },
              })}
              placeholder={field.placeholder}
              multiline={Boolean(field.multiline)}
              maxLength={4000}
            />
          ))}
        </>
      ) : null}
      {ORDER.filter((key) => key !== 'title' && fields.includes(key)).map((key) => (
        <TextField
          key={key}
          label={PROJECT_FIELD_LABELS[key]}
          value={draft[key] || ''}
          onChangeText={(value) => patch({ [key]: value })}
          error={errors[key]}
          multiline={key === 'description' || key === 'requirements' || key === 'estimatedScope'}
        />
      ))}
      <Text style={type.label}>How would you like to proceed?</Text>
      <View style={styles.consultationOptions}>
        {CONSULTATION_OPTIONS.map((option) => {
          const selected = draft.consultationType === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => {
                patch({
                  consultationType: option.value,
                  consultationTypeLabel: option.title,
                });
                setErrors((current) => ({ ...current, consultationType: '' }));
              }}
              style={[
                styles.consultationCard,
                {
                  backgroundColor: selected ? colors.primaryLight : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                  borderRadius: radius.card,
                },
              ]}
            >
              <View style={[styles.consultationIcon, { backgroundColor: selected ? colors.primary : colors.primaryLight, borderRadius: radius.md }]}>
                <Glyph name={option.glyph} color={selected ? colors.onAccent : colors.primary} size={18} />
              </View>
              <View style={styles.consultationCopy}>
                <Text style={[type.heading, { color: colors.text }]}>{option.title}</Text>
                <Text style={[type.small, { color: colors.textSecondary }]}>{option.detail}</Text>
                <Text style={[type.small, styles.consultationNote, { color: colors.success }]}>{option.note}</Text>
              </View>
              <View style={[styles.consultationCheck, { borderColor: selected ? colors.primary : colors.border, borderRadius: radius.pill }]}>
                {selected ? (
                  <View style={[styles.consultationCheckFill, { backgroundColor: colors.primary, borderRadius: radius.pill }]}>
                    <Glyph name="check" color={colors.onAccent} size={12} />
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      {errors.consultationType ? <Text style={[type.small, { color: colors.danger }]}>{errors.consultationType}</Text> : null}
      <Text style={type.body}>Project photos (up to 5)</Text>
      <Button title="Add photos" variant="secondary" onPress={addPhotos} />
      {photoError ? <Text style={[type.body, { color: colors.danger }]}>{photoError}</Text> : null}
      {(draft.pendingAttachments || []).map((photo, index) => (
        <View key={`${photo.fileName}-${index}`}>
          <Text style={type.muted}>{photo.fileName}</Text>
          <Button title="Remove photo" variant="ghost" onPress={() => removePhoto(index)} />
        </View>
      ))}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  consultationOptions: {
    gap: 8,
  },
  scheduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scheduleOption: {
    width: '47%',
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  consultationCard: {
    minHeight: 88,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  consultationIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  consultationCopy: {
    flex: 1,
    gap: 3,
  },
  consultationNote: {
    fontWeight: '700',
  },
  consultationCheck: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  consultationCheckFill: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
