import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Button } from '../../../components/Button';
import { DatePickerField } from '../../../components/DatePickerField';
import { EmptyState } from '../../../components/EmptyState';
import { FlowScreen } from '../../../components/FlowScreen';
import { SkeletonStack } from '../../../components/Skeleton';
import { Card } from '../../../components/ui/Card';
import { useAuth } from '../../../hooks/useAuth';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useTheme } from '../../../theme/ThemeContext';
import { siteLabel } from '../../../flows/customerFlow';
import { REPAIR_STEPS } from './repairFlow';
import { useFormNavigationField } from '../../../components/forms/FormNavigation';

const TIMES = ['9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM', '5:00 PM', 'Emergency'];

export function RepairBookingSiteScreen() {
  const navigation = useNavigation();
  const { company } = useAuth();
  const { colors, radius, type } = useTheme();
  const { draft, patch } = useFlowDraft();
  const { sites, loading, error, reload } = useCompanySites();
  const [siteError, setSiteError] = useState('');
  const activeSites = sites.filter((site) => !site.status || site.status === 'active');
  const siteFieldRef = useRef(null);
  const firstSiteRef = useRef(null);
  const focusSiteField = useCallback(() => {
    const target = firstSiteRef.current && findNodeHandle(firstSiteRef.current);
    if (target != null) AccessibilityInfo.setAccessibilityFocus(target);
  }, []);
  const siteField = useFormNavigationField(focusSiteField, activeSites.length > 0, siteFieldRef);

  useFocusEffect(useCallback(() => {
    reload();
  }, [reload]));

  useEffect(() => {
    if (!draft.siteId && activeSites.length) {
      const primary = activeSites.find((site) => site.isPrimary) || activeSites[0];
      patch({ siteId: primary.id });
    }
  }, [activeSites, draft.siteId, patch]);

  function selectSite(site) {
    const deviceSiteId = draft.deviceSiteId || draft.siteId;
    if (draft.deviceId && deviceSiteId && site.id !== deviceSiteId) {
      setSiteError('The selected site must match the registered device site.');
      return false;
    }
    patch({
      siteId: site.id,
      installationLocation: draft.installationLocation || site.siteName,
    });
    setSiteError('');
    return true;
  }

  function continueToConfirm() {
    const deviceSiteId = draft.deviceSiteId || draft.siteId;
    if (!activeSites.some((site) => site.id === draft.siteId)) {
      setSiteError('Select a site for this repair booking.');
      return;
    }
    if (draft.deviceId && deviceSiteId && draft.siteId !== deviceSiteId) {
      setSiteError('The selected site must match the registered device site.');
      return;
    }
    setSiteError('');
    navigation.navigate('RepairBookingConfirm');
  }

  return (
    <FlowScreen
      title="Select Site"
      steps={draft.recommendedRepairFlow
        ? ['Recommendation', 'Service Scope', 'Issue Details', 'Select Site', 'Confirm Booking']
        : REPAIR_STEPS}
      step={draft.recommendedRepairFlow ? 3 : 7}
      onBack={() => navigation.goBack()}
      error={siteError || error}
      refreshing={loading && sites.length > 0}
      onRefresh={reload}
      footer={<Button title="Review & Confirm ›" onPress={continueToConfirm} />}
    >
      <View
        ref={siteFieldRef}
        collapsable={false}
        accessibilityRole="radiogroup"
        accessibilityLabel="Which site is this for?"
      >
        <Text style={type.label}>Which site is this for?</Text>
        {loading && sites.length === 0 ? <SkeletonStack rows={3} /> : null}
        {!loading && !error && activeSites.length === 0 ? (
          <EmptyState
            title="No sites available"
            message="Add a site for this company before booking the repair."
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
          return (
            <Pressable
              key={site.id}
              ref={index === 0 ? firstSiteRef : undefined}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={site.siteName}
              onPress={() => {
                if (selectSite(site)) siteField.advance();
              }}
              style={[
                styles.site,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primaryLight : colors.surface,
                  borderRadius: radius.md,
                },
              ]}
            >
              <View style={styles.siteContent}>
                <View style={styles.siteText}>
                  <Text style={[type.heading, { color: selected ? colors.primary : colors.text }]}>
                    {site.siteName}
                  </Text>
                  {address ? <Text style={type.small}>{address}</Text> : null}
                  {site.isPrimary ? <Text style={[type.small, { color: colors.primary }]}>Primary</Text> : null}
                </View>
                <Text style={[type.heading, { color: selected ? colors.primary : colors.textSecondary }]}>
                  {selected ? '✓' : '○'}
                </Text>
              </View>
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
      <Card style={[styles.company, { backgroundColor: colors.successSurface, borderColor: colors.success }]}>
        <Text style={[type.small, { color: colors.success }]}>
          {company && (company.companyName || company.name) || 'Company'}{company && (company.gstNumber || company.gst)
            ? ` · GST ✓ ${company.gstNumber || company.gst}`
            : ''}
        </Text>
      </Card>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Text style={type.heading}>Date & Time</Text>
      <DatePickerField
        label="Preferred Date"
        value={draft.preferredDate || ''}
        onChange={(preferredDate) => patch({ preferredDate })}
        hint="Optional"
      />
      <Text style={type.label}>Preferred Time</Text>
      <View style={styles.timeGrid}>
        {TIMES.map((time) => {
          const selected = draft.preferredTime === time;
          return (
            <Pressable
              key={time}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => patch({
                preferredTime: time,
                priority: time === 'Emergency' ? 'urgent' : 'normal',
              })}
              style={[
                styles.time,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primaryLight : colors.surface,
                  borderRadius: radius.md,
                },
              ]}
            >
              <Text style={[type.small, { color: selected ? colors.primary : colors.text }]}>{time}</Text>
            </Pressable>
          );
        })}
      </View>
      {draft.siteId ? (
        <Text style={type.muted}>Selected: {siteLabel(sites, draft.siteId)}</Text>
      ) : null}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  site: {
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  siteContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  siteText: {
    flex: 1,
    gap: 3,
  },
  company: {
    borderWidth: 1,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  time: {
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderWidth: 1,
  },
});
