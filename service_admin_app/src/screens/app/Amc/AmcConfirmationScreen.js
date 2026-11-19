import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supportPhoneFromEnv } from '../../../constants/supportContact';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Facts } from '../../../components/Facts';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { useCatalog } from '../../../flows/useCatalog';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';

const SUPPORT_PHONE = supportPhoneFromEnv();

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function AmcConfirmationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, radius, type } = useTheme();
  const [contactError, setContactError] = useState('');
  const { groups } = useCatalog('amc_next_step');
  const confirmation = route.params && route.params.confirmation;
  const request = route.params && route.params.request;
  const reschedule = route.params && route.params.reschedule;
  const requestAccepted = Boolean(confirmation && confirmation.referenceId && confirmation.status === 'submitted');
  const rescheduleAccepted = Boolean(reschedule && reschedule.id && reschedule.status);

  function backToAmc() {
    navigation.popToTop();
  }

  async function contactSupport(channel) {
    const url = channel === 'call' ? `tel:${SUPPORT_PHONE}` : `https://wa.me/${SUPPORT_PHONE.replace(/\D/g, '')}`;
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) throw new Error('Unable to open the contact app.');
      await Linking.openURL(url);
      setContactError('');
    } catch (err) {
      setContactError(getErrorMessage(err) || 'Unable to open the contact app.');
    }
  }

  if (!requestAccepted && !rescheduleAccepted) {
    return (
      <Screen header={<AppBar title="Confirmation" onBack={backToAmc} />} headerColor={colors.background}>
        <EmptyState
          title="No request yet"
          message="This screen opens after the service accepts an AMC request or reschedule."
          action={<Button title="Back to AMC Contracts" variant="secondary" onPress={backToAmc} />}
        />
      </Screen>
    );
  }

  const kind = rescheduleAccepted
    ? 'reschedule'
    : (route.params.kind || (request && request.requestType === 'renewal' ? 'renew' : 'new'));
  const referenceId = rescheduleAccepted
    ? (reschedule.referenceId || reschedule.requestNumber || reschedule.id)
    : ((request && request.requestNumber) || confirmation.referenceId);
  const subtitle = {
    new: 'Your new AMC request has been sent to Gravity Hub team',
    renew: 'Your renewal request has been sent to Gravity Hub team',
    reschedule: 'Your reschedule request has been sent to Gravity Hub team',
  }[kind];
  const steps = groups.amc_next_step.map((item, index) => {
    const meta = item.meta || {};
    return {
      number: String(index + 1),
      title: item.label,
      note: kind === 'new' ? meta.noteNew : meta.noteOther,
      detail: item.summary,
    };
  });
  const detailRows = rescheduleAccepted
    ? [
      { label: 'Current visit', value: formatDate(reschedule.oldScheduledDate) },
      { label: 'Requested date', value: formatDate(reschedule.requestedNewDate) },
      { label: 'Requested time', value: reschedule.requestedNewTime || 'No preference' },
      { label: 'Reason', value: reschedule.reason },
      { label: 'Additional notes', value: reschedule.notes || '—' },
    ]
    : [
      { label: 'Coverage', value: request && request.requestedService },
      ...String((request && request.description) || '')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const at = line.indexOf(':');
          return at > 0
            ? { label: line.slice(0, at).trim(), value: line.slice(at + 1).trim() }
            : { label: 'Details', value: line };
        }),
    ];
  const detailTitle = rescheduleAccepted
    ? (reschedule.contractTitle || 'AMC visit reschedule')
    : (kind === 'renew' ? 'AMC renewal' : 'New AMC Contract');
  const detailNumber = rescheduleAccepted ? reschedule.contractNumber : request && request.existingContractNumber;

  return (
    <Screen
      header={<AppBar title="Request Submitted" onBack={backToAmc} />}
      headerColor={colors.background}
      footer={<Button title="Back to AMC Contracts" onPress={backToAmc} />}
    >
      <View style={styles.successIntro}>
        <View style={[styles.successIcon, { backgroundColor: colors.success, borderRadius: radius.pill }]}>
          <Glyph name="check" color={colors.onAccent} size={40} />
        </View>
        <Text style={[type.display, styles.center, { color: colors.text }]}>Request Received!</Text>
        <Text style={[type.small, styles.center, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>

      <View style={[styles.referenceCard, { backgroundColor: colors.successSurface, borderColor: colors.success, borderRadius: radius.card }]}>
        <View style={styles.referenceCopy}>
          <Text style={[type.small, styles.referenceLabel, { color: colors.success }]}>Request ID</Text>
          <Text style={[type.small, styles.referenceLabel, { color: colors.success }]}>Submitted</Text>
        </View>
        <View style={styles.referenceCopyRight}>
          <Text style={[type.small, styles.referenceValue, { color: colors.text }]} selectable>{referenceId}</Text>
          <Text style={[type.small, { color: colors.textSecondary }]}>Just now</Text>
        </View>
      </View>

      <View style={[styles.detailCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
        <Text style={[type.heading, { color: colors.text }]}>{detailTitle}</Text>
        {detailNumber ? <Text style={type.small}>{detailNumber}</Text> : null}
        <Facts rows={detailRows} />
      </View>

      {steps.length ? (
      <View style={styles.sectionHeading}>
        <Glyph name="calendar" color={colors.primary} size={16} />
        <Text style={[type.label, { color: colors.textSecondary }]}>WHAT HAPPENS NEXT?</Text>
      </View>
      ) : null}
      {steps.length ? (
      <View style={[styles.stepsCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
        {steps.map((step, index) => (
          <View key={step.number} style={styles.stepRow}>
            <View style={[styles.stepMarker, {
              backgroundColor: index === 0 ? colors.success : colors.surface,
              borderColor: index === 0 ? colors.success : colors.borderStrong,
              borderRadius: radius.pill,
            }]}
            >
              <Text style={[styles.stepNumber, { color: index === 0 ? colors.onAccent : colors.textSecondary }]}>{step.number}</Text>
            </View>
            <View style={styles.stepCopy}>
              <Text style={[type.heading, styles.stepTitle, { color: colors.text }]}>
                {step.title}
                {step.note ? <Text style={[type.small, { color: colors.muted }]}>{` ${step.note}`}</Text> : null}
              </Text>
              <Text style={[type.small, { color: colors.textSecondary }]}>{step.detail}</Text>
            </View>
          </View>
        ))}
      </View>
      ) : null}

      <View style={[styles.contactCard, { backgroundColor: colors.primaryLight, borderColor: colors.primarySoft, borderRadius: radius.card }]}>
        <View style={styles.contactHeading}>
          <Glyph name="call" color={colors.primary} size={17} />
          <Text style={[type.heading, { color: colors.text }]}>Need urgent help?</Text>
        </View>
        <View style={styles.contactActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Call AMC sales"
            onPress={() => contactSupport('call')}
            style={({ pressed }) => [
              styles.contactButton,
              { backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: radius.button },
              pressed && styles.pressed,
            ]}
          >
            <Glyph name="call" color={colors.primary} size={15} />
            <Text style={[type.small, styles.contactButtonText, { color: colors.primary }]}>Call Sales</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="WhatsApp AMC sales"
            onPress={() => contactSupport('message')}
            style={({ pressed }) => [
              styles.contactButton,
              { backgroundColor: colors.success, borderColor: colors.success, borderRadius: radius.button },
              pressed && styles.pressed,
            ]}
          >
            <Glyph name="whatsapp" color={colors.onAccent} size={15} />
            <Text style={[type.small, styles.contactButtonText, { color: colors.onAccent }]}>WhatsApp</Text>
          </Pressable>
        </View>
      </View>
      {contactError ? <Banner message={contactError} tone="warning" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  successIntro: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  successIcon: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  center: {
    textAlign: 'center',
  },
  referenceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
  referenceCopy: {
    gap: 6,
  },
  referenceCopyRight: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 6,
  },
  referenceLabel: {
    fontWeight: '700',
  },
  referenceValue: {
    fontWeight: '700',
    textAlign: 'right',
  },
  detailCard: {
    padding: 13,
    gap: 7,
    borderWidth: 1,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  stepsCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  stepRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
  },
  stepMarker: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '800',
  },
  stepCopy: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 14,
  },
  contactCard: {
    padding: 12,
    gap: 10,
    borderWidth: 1,
  },
  contactHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  contactButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  contactButtonText: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.84,
  },
});
