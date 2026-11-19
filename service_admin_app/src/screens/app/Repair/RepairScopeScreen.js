import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/ui/Card';
import { FlowScreen } from '../../../components/FlowScreen';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useTheme } from '../../../theme/ThemeContext';
import { RepairChoiceCard } from './RepairChoiceCard';
import { REPAIR_SCOPE_OPTIONS, REPAIR_STEPS, REPAIR_WORKSHOP_ADDRESS } from './repairFlow';

const RECOMMENDED_LOGISTICS = [
  {
    value: 'zypli-pickdrop',
    title: 'Gravity Hub Pickup & Drop',
    detail: 'We collect from your site and deliver it back',
    glyph: 'box',
  },
  {
    value: 'selfship',
    title: 'Self-Ship',
    detail: 'You ship to our service center using your own courier',
    glyph: 'box',
  },
  {
    value: 'thirdparty',
    title: 'Third-Party Courier',
    detail: 'Use your preferred courier partner',
    glyph: 'pin',
  },
];

const RECOMMENDED_REPLACEMENT_SCOPE = {
  id: 'replacement',
  value: 'workshop',
  serviceType: 'replacement',
  label: 'New Replacement Unit',
  summary: 'Request a new unit instead of repairing the current device.',
  glyph: 'sync',
};

export function RepairScopeScreen() {
  const navigation = useNavigation();
  const { colors, type } = useTheme();
  const { draft, patch } = useFlowDraft();
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [selectedLogistics, setSelectedLogistics] = useState(draft.repairLogistics || '');
  const recommendedFlow = Boolean(draft.recommendedRepairFlow);
  const isFullService = draft.repairScope === 'on_site';
  const isReplacement = draft.serviceType === 'replacement';

  useEffect(() => {
    setSelectedLogistics(draft.repairLogistics || '');
  }, [draft.repairLogistics]);

  function choose(scope) {
    const scopeChanged = draft.repairScopeId !== scope.id;
    patch({
      repairScope: scope.value,
      repairScopeId: scope.id,
      repairScopeLabel: scope.label,
      serviceType: scope.serviceType,
      priority: draft.priority || 'normal',
      repairLogistics: scopeChanged ? '' : draft.repairLogistics || '',
      repairLogisticsLabel: scopeChanged ? '' : draft.repairLogisticsLabel || '',
    });
    setError('');
    setCopied('');
  }

  function chooseRecommendedLogistics(option) {
    setSelectedLogistics(option.value);
    patch({
      repairLogistics: option.value,
      repairLogisticsLabel: option.title,
    });
    setError('');
    setCopied('');
  }

  async function copyAddress() {
    try {
      Clipboard.setString(`Gravity Hub Repair Center\n${REPAIR_WORKSHOP_ADDRESS}`);
      setCopied('Address copied. Include your Booking ID on the package.');
    } catch (clipboardError) {
      setError(clipboardError && clipboardError.message || 'Unable to copy the service center address.');
    }
  }

  function continueRecommended() {
    if (!draft.repairScope) {
      setError('Choose a service scope to continue.');
      return;
    }
    const logistics = selectedLogistics || draft.repairLogistics;
    if (!isFullService && !isReplacement && !logistics) {
      setError('Select a delivery option to continue.');
      return;
    }
    setError('');
    navigation.navigate('RepairIssue', { recommendedFlow: true });
  }

  if (recommendedFlow) {
    return (
      <FlowScreen
        title="Service Scope"
        steps={['Recommendation', 'Service Scope', 'Issue Details', 'Select Site', 'Confirm Booking']}
        step={1}
        onBack={() => navigation.goBack()}
        error={error}
        footer={<Button title="Next — Issue Details ›" onPress={continueRecommended} />}
      >
        {draft.deviceId || draft.manufacturer ? (
          <Card style={[styles.confirmedBanner, { backgroundColor: colors.successSurface, borderColor: colors.success }]}>
            <Text style={[type.small, { color: colors.success }]}>
              ✓ Equipment confirmed by {draft.recommendationSpecialist || 'your field specialist'} — {draft.manufacturer} {draft.repairDeviceLabel}, {draft.model}
            </Text>
          </Card>
        ) : null}

        <Text style={type.heading}>3. Choose Service Scope</Text>
        <View style={styles.scopeGrid}>
          {[...REPAIR_SCOPE_OPTIONS, RECOMMENDED_REPLACEMENT_SCOPE].map((scope) => {
            const selected = draft.repairScopeId === scope.id;
            return (
              <View key={scope.id} style={styles.scopeCell}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${scope.label}. ${scope.summary}`}
                  onPress={() => choose(scope)}
                  style={[
                    styles.scopeCard,
                    {
                      backgroundColor: selected ? colors.primaryLight : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={styles.scopeTitle}>
                    <Text style={[type.heading, styles.scopeName, { color: colors.text }]}>{scope.label}</Text>
                    {selected ? <Text style={[type.small, { color: colors.primary }]}>✓</Text> : null}
                  </View>
                  <Text style={[type.small, { color: colors.textSecondary }]}>{scope.summary}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {draft.repairScope && !isFullService && !isReplacement ? (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={type.heading}>Logistics — How will we receive the hardware?</Text>
            {RECOMMENDED_LOGISTICS.map((option) => (
              <RepairChoiceCard
                key={option.value}
                title={option.title}
                detail={option.detail}
                glyph={option.glyph}
                selected={selectedLogistics === option.value || draft.repairLogistics === option.value}
                onPress={() => chooseRecommendedLogistics(option)}
              />
            ))}
            {draft.repairLogistics === 'selfship' || draft.repairLogistics === 'thirdparty' ? (
              <Card style={styles.addressCard}>
                <Text style={type.heading}>📍 Gravity Hub Service Center Address</Text>
                <Text style={type.body}>
                  Gravity Hub Repair Center{'\n'}{REPAIR_WORKSHOP_ADDRESS}
                </Text>
                <Text style={[type.small, { color: colors.success }]}>
                  Please include your Booking ID on the package. Notify us once shipped so we can track it.
                </Text>
                <Button title="📋 Copy Address" variant="secondary" onPress={copyAddress} />
              </Card>
            ) : null}
            {draft.repairLogistics === 'zypli-pickdrop' ? (
              <Card style={styles.addressCard}>
                <Text style={type.heading}>🚚 Pickup Details</Text>
                <Text style={type.body}>Pickup Address: Select your site in the next step</Text>
                <Text style={type.small}>Pickup arrangements will be coordinated after booking confirmation.</Text>
              </Card>
            ) : null}
            {copied ? <Text style={[type.small, { color: colors.success }]}>{copied}</Text> : null}
          </>
        ) : null}

        {isFullService ? (
          <Card style={[styles.fullService, { backgroundColor: colors.successSurface, borderColor: colors.success }]}>
            <Text style={[type.body, { color: colors.success }]}>
              The team will coordinate the site visit, pickup, repair and reinstallation after reviewing the booking.
            </Text>
          </Card>
        ) : null}
        {isReplacement ? (
          <Card style={[styles.fullService, { backgroundColor: colors.infoSurface, borderColor: colors.info }]}>
            <Text style={[type.body, { color: colors.info }]}>
              A replacement unit request will be reviewed by the Gravity Hub team. Availability and delivery details will be confirmed after submission.
            </Text>
          </Card>
        ) : null}
      </FlowScreen>
    );
  }

  return (
    <FlowScreen
      title="Service Scope"
      steps={REPAIR_STEPS}
      step={4}
      onBack={() => navigation.goBack()}
    >
      <Text style={type.display} accessibilityRole="header">Choose Service Scope</Text>
      <Text style={type.muted}>
        {draft.manufacturer
          ? `${draft.manufacturer} ${draft.model || ''} · Choose how you would like the repair handled.`
          : 'Choose how you would like the repair handled.'}
      </Text>
      {REPAIR_SCOPE_OPTIONS.map((scope) => {
        return (
          <RepairChoiceCard
            key={scope.id}
            title={scope.label}
            detail={scope.summary}
            glyph={scope.glyph}
            selected={draft.repairScopeId === scope.id}
            onPress={() => {
              choose(scope);
              navigation.navigate('RepairLogistics');
            }}
            accessibilityRole="button"
          />
        );
      })}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  confirmedBanner: {
    borderWidth: 1,
  },
  scopeCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    minHeight: 88,
    padding: 10,
    gap: 5,
  },
  scopeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  scopeCell: {
    width: '48%',
  },
  scopeTitle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 4,
  },
  scopeName: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  addressCard: {
    gap: 8,
  },
  fullService: {
    borderWidth: 1,
  },
});
