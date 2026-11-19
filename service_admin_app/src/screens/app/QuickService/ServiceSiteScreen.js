import { useCallback, useRef, useState } from 'react';
import {
  AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Button } from '../../../components/Button';
import { DatePickerField } from '../../../components/DatePickerField';
import { EmptyState } from '../../../components/EmptyState';
import { FlowScreen } from '../../../components/FlowScreen';
import { SkeletonStack } from '../../../components/Skeleton';
import { Select } from '../../../components/ui/Select';
import { ErrorState } from '../../../components/ui/ErrorState';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useCompanySites } from '../../../flows/useCompanySites';
import { phaseProgress, SERVICE_TIME_SLOTS, siteErrors } from '../../../flows/serviceFlow';
import { useTheme } from '../../../theme/ThemeContext';
import { useFormNavigationField } from '../../../components/forms/FormNavigation';

export function ServiceSiteScreen() {
  const navigation = useNavigation();
  const { colors, radius, type } = useTheme();
  const { draft, patch } = useFlowDraft();
  const { sites, loading, error, reload } = useCompanySites();
  const [errors, setErrors] = useState({});
  const siteFieldRef = useRef(null);
  const firstSiteRef = useRef(null);
  const progress = phaseProgress(draft.trail, 'site');
  const activeSites = sites.filter((site) => !site.status || site.status === 'active');
  const focusSiteField = useCallback(() => {
    const target = firstSiteRef.current && findNodeHandle(firstSiteRef.current);
    if (target != null) AccessibilityInfo.setAccessibilityFocus(target);
  }, []);
  const siteField = useFormNavigationField(focusSiteField, activeSites.length > 0, siteFieldRef);

  useFocusEffect(useCallback(() => {
    reload();
  }, [reload]));

  function goBack() {
    const trail = draft.trail || [];
    if (trail.length) patch({ trail: trail.slice(0, -1) });
    navigation.goBack();
  }

  function choose(site) {
    const address = site.fullAddress || [site.address, site.city].filter(Boolean).join(', ');
    patch({
      siteId: site.id,
      siteName: site.siteName,
      siteAddress: address,
      siteType: site.siteTypeLabel || site.siteType || '',
    });
    setErrors((current) => ({ ...current, siteId: '' }));
    siteField.advance();
  }

  function continueNext() {
    const next = siteErrors(draft);
    if (next) {
      setErrors(next);
      return;
    }
    navigation.navigate('ServiceReview');
  }

  return (
    <FlowScreen
      title="Select site"
      steps={progress.labels}
      step={progress.index}
      onBack={goBack}
      error={errors.form || ''}
      refreshing={loading && sites.length > 0}
      onRefresh={reload}
      footer={<Button title="Review" onPress={continueNext} />}
    >
      <Text style={type.display} accessibilityRole="header">Which site is this for?</Text>
      <Text style={type.muted}>Sites are loaded from your company. The request is not sent yet.</Text>
      <View
        ref={siteFieldRef}
        collapsable={false}
        accessibilityRole="radiogroup"
        accessibilityLabel="Which site is this for?"
      >
        {loading && sites.length === 0 ? <SkeletonStack rows={3} /> : null}
        {!loading && error ? (
          <ErrorState title="Unable to load sites" message={error} onRetry={reload} />
        ) : null}
        {!loading && !error && activeSites.length === 0 ? (
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
        {activeSites.map((site, index) => {
          const selected = site.id === draft.siteId;
          const address = site.fullAddress || [site.address, site.city, site.state].filter(Boolean).join(', ');
          const kind = site.siteTypeLabel || site.siteType;
          return (
            <Pressable
              key={site.id}
              ref={index === 0 ? firstSiteRef : undefined}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={site.siteName}
              onPress={() => choose(site)}
              style={[
                styles.site,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primaryLight : colors.surface,
                  borderRadius: radius.md,
                },
              ]}
            >
              <Text style={[type.heading, { color: selected ? colors.primary : colors.text }]}>{site.siteName}</Text>
              {address ? <Text style={type.body}>{address}</Text> : null}
              <Text style={type.small}>{[kind, site.isPrimary ? 'Primary' : ''].filter(Boolean).join(' · ')}</Text>
            </Pressable>
          );
        })}
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
      </View>
      {errors.siteId ? <Text style={[type.small, { color: colors.danger }]}>{errors.siteId}</Text> : null}
      <DatePickerField
        label="Preferred date"
        value={draft.preferredDate || ''}
        onChange={(value) => patch({ preferredDate: value })}
        hint="Optional"
        error={errors.preferredDate}
      />
      <Select
        label="Preferred time"
        value={draft.preferredTime || ''}
        onChange={(preferredTime) => patch({ preferredTime })}
        options={SERVICE_TIME_SLOTS}
        placeholder="Optional"
        helper="Optional"
        error={errors.preferredTime}
      />
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  site: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
});
