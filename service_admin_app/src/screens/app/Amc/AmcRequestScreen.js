import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { FlowScreen } from '../../../components/FlowScreen';
import { Glyph } from '../../../components/Glyph';
import { SkeletonStack } from '../../../components/Skeleton';
import { TextField } from '../../../components/TextField';
import { Banner } from '../../../components/Banner';
import { amcQuoteErrors, buildAmcQuote, submittedAmc } from '../../../flows/customerFlow';
import { useCatalog } from '../../../flows/useCatalog';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useSubmit } from '../../../flows/useSubmit';
import { useTheme } from '../../../theme/ThemeContext';
import { fieldErrors, getErrorMessage } from '../../../utils/errors';
import { useFormNavigationField } from '../../../components/forms/FormNavigation';
import { ServiceOptionCard, SiteOption } from '../QuickService/ServiceFields';

function CompleteCard({ offer, selected, onPress }) {
  const { colors, radius, type } = useTheme();
  const meta = offer.meta || {};
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${offer.label}. ${offer.summary}`}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <View style={[styles.complete, selected && styles.completeOn, {
        backgroundColor: colors.primaryLight,
        borderColor: colors.primary,
        borderRadius: radius.card,
      }]}
      >
        {meta.ribbon ? (
          <View style={[styles.ribbon, { backgroundColor: colors.primary }]}>
            <Text style={[styles.ribbonText, styles.flex, { color: colors.onAccent }]}>{`★ ${meta.ribbon}`}</Text>
            {meta.ribbonNote ? <Text style={[styles.ribbonText, { color: colors.onAccent }]}>{meta.ribbonNote}</Text> : null}
          </View>
        ) : null}
        <View style={styles.completeBody}>
          <View style={[styles.completeIcon, { backgroundColor: colors.primary, borderRadius: radius.chip }]}>
            <Glyph name={offer.glyph || 'plant'} color={colors.onAccent} size={22} />
          </View>
          <View style={styles.flex}>
            <Text style={[type.heading, { color: colors.primary }]}>{offer.label}</Text>
            {offer.summary ? <Text style={[type.small, styles.completeSummary]}>{offer.summary}</Text> : null}
            <View style={styles.tags}>
              {(meta.tags || []).map((tag) => (
                <View key={tag} style={[styles.tag, { backgroundColor: colors.surface, borderRadius: radius.pill }]}>
                  <Text style={[styles.tagText, { color: colors.primary }]}>{`✓ ${tag}`}</Text>
                </View>
              ))}
            </View>
            {(meta.benefits || []).length ? (
              <View style={[styles.benefits, { backgroundColor: colors.surface, borderRadius: radius.md }]}>
                {meta.benefits.map((line) => (
                  <Text key={line} style={[type.small, { color: colors.text }]}>{`✓ ${line}`}</Text>
                ))}
              </View>
            ) : null}
          </View>
          <View style={[
            styles.check,
            { borderColor: colors.primary, borderRadius: radius.pill },
            selected && { backgroundColor: colors.primary },
          ]}
          >
            {selected ? <Glyph name="check" color={colors.onAccent} size={13} /> : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function AmcRequestScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const scrollRef = useRef(null);
  const sectionY = useRef({});
  const equipmentFieldRef = useRef(null);
  const contractFieldRef = useRef(null);
  const firstContractRef = useRef(null);
  const focusEquipmentField = useCallback(() => {}, []);
  const focusContractField = useCallback(() => {
    const target = firstContractRef.current && findNodeHandle(firstContractRef.current);
    if (target != null) AccessibilityInfo.setAccessibilityFocus(target);
  }, []);
  const { colors, radius, type } = useTheme();
  const { draft, patch, clear } = useFlowDraft();
  const { sites, loading: sitesLoading, reload } = useCompanySites();
  const { phase, submit } = useSubmit();
  const catalogState = useCatalog('amc_offer', 'amc_equipment', 'amc_contract_type', 'amc_plant_field');
  const catalog = {
    offer: catalogState.groups.amc_offer[0] || null,
    equipment: catalogState.groups.amc_equipment,
    contractTypes: catalogState.groups.amc_contract_type,
    plantFields: catalogState.groups.amc_plant_field,
  };
  const equipmentField = useFormNavigationField(
    focusEquipmentField,
    catalog.equipment.length > 0,
    equipmentFieldRef,
  );
  const allEquipment = catalog.equipment.map((item) => item.code);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const equipment = draft.equipment || [];
  const complete = Boolean(draft.complete);
  const activeSites = sites.filter((site) => !site.status || site.status === 'active');
  const showContract = complete || equipment.length > 0;
  const showPlant = showContract && Boolean(draft.contractType);
  const showSites = showPlant && activeSites.length > 1;
  const contractField = useFormNavigationField(
    focusContractField,
    showContract && catalog.contractTypes.length > 0,
    contractFieldRef,
  );
  const ready = showPlant && !amcQuoteErrors(draft, catalog);
  const stage = (showContract ? 1 : 0) + (showPlant ? 1 : 0);
  const lastStage = useRef(stage);

  useEffect(() => {
    if (!route.params || !route.params.newRequest) return;
    clear();
    navigation.setParams({ newRequest: undefined });
  }, [clear, navigation, route.params]);

  useFocusEffect(useCallback(() => {
    reload();
  }, [reload]));

  const onlySiteId = activeSites.length === 1 ? activeSites[0].id : '';
  useEffect(() => {
    if (!draft.siteId && onlySiteId) patch({ siteId: onlySiteId });
  }, [onlySiteId, draft.siteId, patch]);

  useEffect(() => {
    const grew = stage > lastStage.current;
    lastStage.current = stage;
    if (!grew) return undefined;
    const timer = setTimeout(() => scrollTo(stage === 1 ? 'contractType' : 'plant'), 160);
    return () => clearTimeout(timer);
  }, [stage]);

  function clearError(key) {
    if (errors[key]) setErrors((current) => ({ ...current, [key]: '' }));
  }

  function toggleComplete() {
    if (complete) patch({ complete: false });
    else patch({ complete: true, equipment: allEquipment });
    clearError('equipment');
    equipmentField.activate(true);
  }

  function toggleEquipment(value) {
    const next = equipment.includes(value) ? equipment.filter((item) => item !== value) : [...equipment, value];
    patch({ equipment: next, complete: complete && next.length === allEquipment.length });
    clearError('equipment');
    equipmentField.activate(true);
  }

  function scrollTo(key) {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, (sectionY.current[key] || 0) - 12), animated: true });
    }
  }

  async function onSubmit() {
    const local = amcQuoteErrors(draft, catalog);
    if (local) {
      setErrors(local);
      const first = ['equipment', 'contractType', ...catalog.plantFields.map((field) => field.code), 'siteId']
        .find((key) => local[key]);
      scrollTo(first);
      return;
    }
    setErrors({});
    setFormError('');
    const { result, error } = await submit(() => customerApi.createAmcRequest(buildAmcQuote(draft, catalog)));
    if (error) {
      setErrors(fieldErrors(error));
      setFormError(getErrorMessage(error));
      if (scrollRef.current) scrollRef.current.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!submittedAmc(result)) {
      setFormError('The service did not confirm this request.');
      return;
    }
    clear();
    navigation.navigate('AmcConfirmation', { kind: 'new', confirmation: result.confirmation, request: result.request });
  }

  function onLayout(key) {
    return (event) => { sectionY.current[key] = event.nativeEvent.layout.y; };
  }

  return (
    <FlowScreen
      title="New AMC Contract"
      onBack={() => navigation.goBack()}
      error={formError}
      scrollRef={scrollRef}
      footer={ready ? (
        <Button title="Request AMC Quote ›" loading={phase === 'submitting'} onPress={onSubmit} />
      ) : null}
    >
      <View style={[styles.intro, { backgroundColor: colors.primaryLight, borderRadius: radius.card }]}>
        <View style={[styles.introIcon, { backgroundColor: colors.primary, borderRadius: radius.chip }]}>
          <Glyph name="document" color={colors.onAccent} size={18} />
        </View>
        <View style={styles.flex}>
          <Text style={[type.heading, { color: colors.primary }]}>Annual Maintenance Contract</Text>
          <Text style={type.small}>
            Select the equipment, plant size and coverage needs for a customised AMC quote.
          </Text>
        </View>
      </View>

      {catalogState.error ? (
        <>
          <Banner message={catalogState.error} />
          <Button title="Retry loading AMC options" variant="secondary" onPress={() => catalogState.reload()} />
        </>
      ) : null}
      {catalogState.loading ? <SkeletonStack rows={4} /> : null}
      {!catalogState.loading && !catalogState.error && !catalog.offer
        && !catalog.equipment.length && !catalog.contractTypes.length && !catalog.plantFields.length ? (
          <EmptyState
            title="AMC options are not configured"
            message="Add active AMC catalog options to the database before requesting a quote."
            action={<Button title="Reload AMC options" variant="secondary" onPress={() => catalogState.reload()} />}
          />
        ) : null}

      {catalog.equipment.length ? (
        <View ref={equipmentFieldRef} collapsable={false} style={styles.section} onLayout={onLayout('equipment')}>
          {catalog.offer ? <CompleteCard offer={catalog.offer} selected={complete} onPress={toggleComplete} /> : null}

          {catalog.offer ? (
            <View style={styles.orRow}>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.muted }]}>OR SELECT SPECIFIC EQUIPMENT</Text>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            </View>
          ) : null}

          <Text style={type.label} accessibilityRole="header">STEP 1 — WHAT EQUIPMENT TO COVER?</Text>
          <View style={styles.optionGrid}>
            {catalog.equipment.map((item) => (
              <View key={item.code} style={styles.optionCell}>
                <ServiceOptionCard
                  compact
                  option={{ code: item.code, name: item.label, summary: item.summary, iconKey: item.glyph }}
                  selected={equipment.includes(item.code)}
                  onPress={() => toggleEquipment(item.code)}
                />
              </View>
            ))}
          </View>
          {errors.equipment ? <Text style={[type.small, { color: colors.danger }]}>{errors.equipment}</Text> : null}
        </View>
      ) : null}

      {showContract ? (
        <View
          ref={contractFieldRef}
          collapsable={false}
          style={styles.section}
          onLayout={onLayout('contractType')}
        >
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={type.label} accessibilityRole="header">STEP 2 — CONTRACT TYPE</Text>
          <View style={styles.optionGrid}>
            {catalog.contractTypes.map((item, index) => (
              <View key={item.code} style={styles.optionCell}>
                <ServiceOptionCard
                  compact
                  option={{ code: item.code, name: item.label, summary: item.summary, iconKey: item.glyph }}
                  optionRef={index === 0 ? firstContractRef : undefined}
                  selected={draft.contractType === item.code}
                  onPress={() => {
                    patch({ contractType: item.code });
                    clearError('contractType');
                    if (showPlant) contractField.advance();
                    else contractField.activate();
                  }}
                />
              </View>
            ))}
          </View>
          {errors.contractType ? <Text style={[type.small, { color: colors.danger }]}>{errors.contractType}</Text> : null}
        </View>
      ) : null}

      {showPlant ? (
        <View style={styles.section} onLayout={onLayout('plant')}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={type.label} accessibilityRole="header">STEP 3 — PLANT DETAILS</Text>
          {catalog.plantFields.map((field) => (
            <View key={field.code} onLayout={(event) => {
              sectionY.current[field.code] = (sectionY.current.plant || 0) + event.nativeEvent.layout.y;
            }}
            >
              <TextField
                label={field.label}
                value={draft[field.code] || ''}
                placeholder={(field.meta && field.meta.placeholder) || ''}
                onChangeText={(value) => {
                  patch({ [field.code]: value });
                  clearError(field.code);
                }}
                error={errors[field.code]}
                multiline={Boolean(field.meta && field.meta.multiline)}
              />
            </View>
          ))}
        </View>
      ) : null}

      {showPlant && sitesLoading && sites.length === 0 ? <SkeletonStack rows={2} /> : null}
      {showPlant && !sitesLoading && activeSites.length === 0 ? (
        <EmptyState
          title="No sites available"
          message="Add a site for this company before requesting an AMC quote."
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
      {showSites ? (
        <View style={styles.section} onLayout={onLayout('siteId')}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={type.label} accessibilityRole="header">STEP 4 — WHICH SITE?</Text>
          {activeSites.map((site) => (
            <SiteOption
              key={site.id}
              site={site}
              selected={site.id === draft.siteId}
              onPress={() => {
                patch({ siteId: site.id });
                clearError('siteId');
              }}
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
          {errors.siteId ? <Text style={[type.small, { color: colors.danger }]}>{errors.siteId}</Text> : null}
        </View>
      ) : null}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.9,
  },
  intro: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  introIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: 10,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  optionCell: {
    width: '48%',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 6,
  },
  complete: {
    overflow: 'hidden',
    borderWidth: 2,
  },
  completeOn: {
    borderWidth: 2.5,
  },
  ribbon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  ribbonText: {
    fontSize: 10,
    fontWeight: '800',
  },
  completeBody: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
  },
  completeIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeSummary: {
    marginTop: 3,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  benefits: {
    marginTop: 8,
    padding: 8,
    gap: 2,
  },
  check: {
    width: 22,
    height: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
