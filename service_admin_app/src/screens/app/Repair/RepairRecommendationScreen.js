import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppBar } from '../../../components/AppBar';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Facts } from '../../../components/Facts';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { Card } from '../../../components/ui/Card';
import { config } from '../../../config/env';
import { getAccessToken } from '../../../api/client';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useTheme } from '../../../theme/ThemeContext';
import { formatWhen } from '../../../utils/format';
import { REPAIR_DEVICE_OPTIONS } from './repairFlow';

const SCOPES = [
  {
    id: 'repair_only',
    label: 'Repair Only',
    summary: 'You send hardware. We repair & return.',
    details: '✓ Inspection & Diagnosis   ✓ Component repair   ✓ Testing\n× No installation   × No on-site visit',
    glyph: 'wrench',
  },
  {
    id: 'repair_install',
    label: 'Repair + Install',
    summary: 'We repair & install back at your site.',
    details: '✓ Everything in Repair Only   ✓ Engineer site visit\n✓ Reinstallation   × No dismantling (you remove unit)',
    glyph: 'settings',
  },
  {
    id: 'full_service',
    label: 'Full Service',
    summary: 'Gravity Hub handles everything.',
    details: '✓ Engineer visit   ✓ Dismantling   ✓ Repair   ✓ Reinstall\n✓ Complete end-to-end service',
    glyph: 'plant',
  },
  {
    id: 'replacement',
    label: 'New Replacement Unit',
    summary: 'Request a new replacement unit instead of repairing this device.',
    details: '✓ Brand new unit   ✓ Full manufacturer warranty\n✓ Old unit taken back   × Higher upfront cost',
    glyph: 'sync',
  },
];

export function RepairRecommendationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, radius, space, type } = useTheme();
  const { clear, patch } = useFlowDraft();
  const recommendation = route.params && route.params.recommendation;
  const recommendationId = recommendation ? recommendation.id : null;
  const [error, setError] = useState('');
  const [scopeId, setScopeId] = useState('repair_only');
  useEffect(() => {
    setScopeId('repair_only');
    setError('');
  }, [recommendationId]);
  const deviceType = String(recommendation && recommendation.deviceType || '').toLowerCase();
  const deviceOption = REPAIR_DEVICE_OPTIONS.find((option) => option.value === deviceType)
    || (deviceType === 'drive'
      ? REPAIR_DEVICE_OPTIONS.find((option) => option.apiType === deviceType)
      : null);
  const equipment = deviceOption ? deviceOption.label : '';
  const manufacturer = recommendation && recommendation.manufacturer || '';
  const model = recommendation && recommendation.model || '';
  const serialNumber = recommendation && recommendation.serialNumber || '';
  const specialist = recommendation && (
    recommendation.jobEngineerName || recommendation.actorName
  ) || '';
  const specialistDetail = [
    recommendation && recommendation.jobEngineerTrade,
    recommendation && recommendation.jobEngineerRating != null
      ? `★ ${recommendation.jobEngineerRating}`
      : '',
  ].filter(Boolean).join(' · ');
  const issues = recommendation && Array.isArray(recommendation.issuesFound)
    ? recommendation.issuesFound.filter(Boolean).map((issue) => (
      typeof issue === 'string'
        ? { description: issue, status: 'open' }
        : issue
    ))
    : [];
  const selectedScope = SCOPES.find((scope) => scope.id === scopeId) || SCOPES[0];
  const scopeCost = recommendation && recommendation.scopeCosts
    && recommendation.scopeCosts[scopeId] || '';
  const hasEquipment = Boolean(
    recommendation
    && recommendation.deviceId
    && manufacturer
    && recommendation.deviceSiteId === recommendation.siteId,
  );

  function acceptRecommendation() {
    clear();
    const faultSummary = String(recommendation.detail || issues.map((issue) => issue.description).join(', ')).trim();
    const deviceKind = deviceType === 'drive' ? 'dc' : deviceType;
    patch({
      recommendedRepairFlow: true,
      repairRecommendationScopeId: scopeId,
      repairRecommendationScopeLabel: selectedScope.label,
      repairRecommendationCost: scopeCost,
      repairScope: scopeId === 'repair_install'
        ? 'pickup_and_return'
        : scopeId === 'full_service' ? 'on_site' : 'workshop',
      repairScopeId: scopeId,
      repairScopeLabel: selectedScope.label,
      serviceType: scopeId === 'replacement' ? 'replacement' : 'component_repair',
      deviceId: recommendation && recommendation.deviceId || '',
      deviceSiteId: recommendation && recommendation.deviceSiteId || '',
      deviceType,
      repairDeviceKind: deviceKind,
      repairDeviceLabel: equipment,
      powerRating: recommendation && recommendation.powerRating || '',
      manufacturer,
      repairMake: manufacturer,
      model,
      serialNumber,
      installationLocation: recommendation && recommendation.installationLocation || '',
      issueDescription: faultSummary,
      priority: 'normal',
      selectedFaultTags: issues
        .filter((issue) => issue.status !== 'resolved')
        .map((issue) => issue.description),
      symptoms: issues.map((issue) => issue.description).join(', '),
      faultDescription: faultSummary,
      faultInformation: faultSummary,
      faultErrorCode: recommendation && recommendation.errorCode || '',
      errorCode: recommendation && recommendation.errorCode || '',
      warrantyStatus: '',
      pendingAttachments: [],
      repairLogistics: '',
      repairLogisticsLabel: '',
      siteId: recommendation && recommendation.siteId || '',
      recommendationSpecialist: specialist,
    });
    if (!hasEquipment) {
      navigation.navigate('RepairDevice', {
        fromRecommendation: true,
        recommendedScope: scopeId,
      });
      return;
    }
    navigation.navigate('RepairScope');
  }

  function backToDashboard() {
    const parent = navigation.getParent();
    if (parent) parent.navigate('Dashboard');
    else navigation.goBack();
  }

  return (
    <Screen
      header={<AppBar title="Repair Recommendation" onBack={backToDashboard} />}
      headerColor={colors.background}
      contentGap={space.section}
    >
      {error ? (
        <Card style={[styles.notice, { backgroundColor: colors.warningSurface, borderColor: colors.warning }]}>
          <Text style={[type.body, { color: colors.warning }]}>{error}</Text>
        </Card>
      ) : null}
      {!recommendation ? (
        <EmptyState
          glyph="wrench"
          title="No active repair recommendation"
          message="When a specialist recommends component-level repair, the job findings will appear here."
        />
      ) : null}
      {recommendation ? (
        <>
          <Card style={[styles.notice, { backgroundColor: colors.warningSurface, borderColor: colors.warning }]}>
            <Text style={[type.body, { color: colors.warning }]}>
              While completing your on-site job, our specialist found an issue that needs component-level repair beyond what can be fixed on-site.
            </Text>
          </Card>

          <Card style={styles.card}>
            <Text style={[type.heading, { color: colors.text }]}>From your recent job</Text>
            <Facts rows={[
              { label: 'Job', value: [recommendation.jobCode, recommendation.jobTitle].filter(Boolean).join(' · ') },
              { label: 'Specialist', value: [specialist, specialistDetail].filter(Boolean).join(' · ') },
              { label: 'Date', value: (recommendation.jobCreatedAt || recommendation.createdAt)
                ? formatWhen(recommendation.jobCreatedAt || recommendation.createdAt)
                : '' },
            ]} />
          </Card>

          <Text style={type.heading}>Hardware Details</Text>
          <Card style={styles.card}>
            {hasEquipment ? (
              <Facts rows={[
                { label: 'Equipment', value: equipment },
                { label: 'Make', value: manufacturer },
                { label: 'Model', value: model },
                { label: 'Power Rating', value: recommendation && recommendation.powerRating },
              ]} />
            ) : (
              <Text style={[type.small, { color: colors.danger }]}>
                No registered device is linked yet. Continue through the existing device registration steps before booking.
              </Text>
            )}
          </Card>

          {issues.length ? (
            <>
              <Text style={type.heading}>Issues Found On-Site</Text>
              <Card style={styles.card}>
                {issues.map((issue, index) => {
                  const resolved = issue.status === 'resolved';
                  return (
                    <View key={`${issue.description}-${index}`} style={styles.issueRow}>
                      <Text style={[styles.issueMark, { color: resolved ? colors.success : colors.danger }]}>
                        {resolved ? '✓' : '×'}
                      </Text>
                      <View style={styles.issueCopy}>
                        <Text style={type.body}>{issue.description}</Text>
                        {issue.errorCode ? (
                          <Text style={[type.small, { color: colors.danger }]}>{issue.errorCode}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
                {recommendation.errorCode && !issues.some((issue) => issue.errorCode) ? (
                  <Text style={[type.small, { color: colors.danger }]}>
                    Error code: {recommendation.errorCode}
                  </Text>
                ) : null}
              </Card>
            </>
          ) : null}

          {recommendation.detail || recommendation.riskNote ? (
            <>
              <Text style={type.heading}>Specialist's Notes</Text>
              <Card style={[styles.card, styles.notes, { borderLeftColor: colors.danger }]}>
                {recommendation.riskNote ? (
                  <Text style={[type.small, { color: colors.danger }]}>RISK — {recommendation.riskNote}</Text>
                ) : null}
                {recommendation.detail ? <Text style={type.body}>{recommendation.detail}</Text> : null}
              </Card>
            </>
          ) : null}

          {recommendation.attachments && recommendation.attachments.length ? (
            <>
              <Text style={type.heading}>Photos from Specialist</Text>
              <View style={styles.photos}>
                {recommendation.attachments.map((attachment) => {
                  const accessToken = getAccessToken();
                  const path = attachment.contentUrl || attachment.fileReference || '';
                  const uri = path.startsWith('http')
                    ? path
                    : path.startsWith('/')
                      ? `${config.apiBaseUrl}${path}`
                      : '';
                  return (
                    <View key={attachment.id} style={[styles.photo, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}>
                      {uri ? (
                        <Image
                          source={{
                            uri,
                            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
                          }}
                          style={styles.photoImage}
                          resizeMode="cover"
                          accessibilityLabel={attachment.fileName || 'Specialist photo'}
                        />
                      ) : (
                        <Glyph name="camera" color={colors.textSecondary} size={24} />
                      )}
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          <Text style={type.heading}>Choose Service Scope</Text>
          <View style={styles.scopes}>
            {SCOPES.map((scope) => {
              const selected = scope.id === scopeId;
              return (
                <Pressable
                  key={scope.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => { setScopeId(scope.id); setError(''); }}
                  style={[
                    styles.scopeCard,
                    {
                      backgroundColor: selected ? colors.warningSurface : colors.surface,
                      borderColor: selected ? colors.warning : colors.border,
                      borderRadius: radius.card,
                    },
                  ]}
                >
                  <View style={styles.scopeHead}>
                    <View style={[styles.scopeIcon, { backgroundColor: colors.warningSurface, borderRadius: radius.md }]}>
                      <Glyph name={scope.glyph} color={colors.warning} size={18} />
                    </View>
                    <View style={styles.scopeCopy}>
                      <Text style={type.heading}>{scope.label}</Text>
                      <Text style={[type.small, { color: colors.textSecondary }]}>{scope.summary}</Text>
                    </View>
                    {selected ? <Glyph name="check" color={colors.warning} size={18} /> : null}
                  </View>
                  <Text style={[type.small, { color: colors.textSecondary }]}>{scope.details}</Text>
                </Pressable>
              );
            })}
          </View>
          <Card style={styles.card}>
            <Facts rows={[
              { label: 'Selected Scope', value: selectedScope.label },
              { label: 'Estimated Cost', value: scopeCost },
            ]} />
          </Card>
          <Button
            title={hasEquipment ? '✓ Accept & Book Repair Now' : 'Add Device & Continue'}
            onPress={acceptRecommendation}
          />
          <Button title="Remind Me Later" variant="secondary" onPress={backToDashboard} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  notice: {
    gap: 8,
    borderLeftWidth: 4,
  },
  card: {
    gap: 10,
  },
  scopes: {
    gap: 8,
  },
  scopeCard: {
    padding: 12,
    gap: 8,
    borderWidth: 1.5,
  },
  scopeHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scopeIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeCopy: {
    flex: 1,
    gap: 3,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  issueMark: {
    fontWeight: '800',
  },
  issueCopy: {
    flex: 1,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photo: {
    width: 76,
    height: 76,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  notes: {
    borderLeftWidth: 4,
  },
});
