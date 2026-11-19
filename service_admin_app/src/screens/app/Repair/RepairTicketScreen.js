import { StyleSheet, Text, View } from 'react-native';
import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Facts } from '../../../components/Facts';
import { FlowScreen } from '../../../components/FlowScreen';
import { Glyph } from '../../../components/Glyph';
import { Card } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { labelStatus, siteLabel } from '../../../flows/customerFlow';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { formatWhen } from '../../../utils/format';
import { REPAIR_STEPS } from './repairFlow';

function bookingDateTime(summary, ticket) {
  const selected = [summary && summary.preferredDate, summary && summary.preferredTime]
    .filter(Boolean)
    .join(' · ');
  return selected || formatWhen(ticket && (ticket.submittedAt || ticket.createdAt));
}

export function RepairTicketScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, type } = useTheme();
  const { sites } = useCompanySites();
  const ticket = route.params && route.params.ticket;
  const confirmation = route.params && route.params.confirmation;
  const bookingConfirmed = Boolean(route.params && route.params.bookingConfirmed);
  const bookingSummary = route.params && route.params.bookingSummary || {};
  const accepted = Boolean(confirmation && confirmation.ticketNumber && confirmation.status === 'submitted');
  const [device, setDevice] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!accepted || !ticket || !ticket.deviceId) return;
    try {
      const data = await customerApi.device(ticket.deviceId);
      setDevice((data && data.device) || null);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [accepted, ticket]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  function backToDevices() {
    navigation.popToTop();
  }

  function backToDashboard() {
    const parent = navigation.getParent();
    if (parent) parent.navigate('Dashboard');
    else backToDevices();
  }

  function trackRepair() {
    const ticketId = (ticket && ticket.id) || confirmation.referenceId;
    if (!ticketId) {
      setError('This repair ticket cannot be tracked because its ticket ID is missing.');
      return;
    }
    navigation.navigate('RepairTracking', { ticketId, ticket });
  }

  if (!accepted) {
    return (
      <FlowScreen title="Repair ticket" onBack={backToDevices}>
        <EmptyState
          title="No ticket yet"
          message="A ticket number appears here after the repair is submitted."
          action={<Button title="Back to devices" variant="secondary" onPress={backToDevices} />}
        />
      </FlowScreen>
    );
  }

  const summarySite = bookingSummary.site || siteLabel(sites, ticket.siteId);
  const summaryDate = bookingDateTime(bookingSummary, ticket);
  const service = bookingSummary.service
    || `${labelStatus(ticket.serviceType)} — ${labelStatus(ticket.repairScope)}`;

  return (
    <FlowScreen
      title={bookingConfirmed ? 'Booking Confirmed' : 'Repair ticket'}
      steps={bookingConfirmed
        ? (bookingSummary.recommendedRepairFlow
          ? ['Recommendation', 'Service Scope', 'Issue Details', 'Select Site', 'Confirm Booking', 'Done']
          : [...REPAIR_STEPS, 'Done'])
        : REPAIR_STEPS}
      step={bookingConfirmed
        ? (bookingSummary.recommendedRepairFlow ? 5 : REPAIR_STEPS.length)
        : 6}
      onBack={bookingConfirmed ? backToDashboard : backToDevices}
      error={error}
      footer={bookingConfirmed ? (
        <View style={styles.footer}>
          <Button title="📍 Track Specialist" onPress={trackRepair} />
          <Button title="Back to Dashboard" variant="secondary" onPress={backToDashboard} />
        </View>
      ) : (
        <Button title="Back to repair center" onPress={backToDevices} />
      )}
    >
      {bookingConfirmed ? (
        <>
          <View style={styles.successHead}>
            <View style={[styles.successIcon, { backgroundColor: colors.successSurface }]}>
              <Glyph name="check" color={colors.success} size={28} />
            </View>
            <Text style={type.display} accessibilityRole="header">Booking Confirmed!</Text>
            <Text style={type.body}>ID: {confirmation.ticketNumber}</Text>
            <StatusBadge label={labelStatus(confirmation.status)} status={confirmation.status} />
          </View>
          <Card style={[styles.nextSteps, { backgroundColor: colors.primaryLight, borderColor: colors.primarySoft }]}>
            <Text style={[type.heading, { color: colors.primary }]}>🤖 Gravity Hub AI — Next Steps</Text>
            <Text style={[type.body, { color: colors.text }]}>
              Your repair request has been received. A specialist is being assigned and will review the problem details and photos. Repair updates will appear in Track Specialist.
            </Text>
          </Card>
          <Card style={styles.summary}>
            <Facts rows={[
              { label: 'Service', value: service },
              { label: 'Site', value: summarySite },
              { label: 'Pickup / Drop Address', value: bookingSummary.address },
              { label: 'GST Invoice', value: 'Provided after repair completion' },
              { label: 'Date', value: summaryDate },
            ]} />
          </Card>
        </>
      ) : (
        <>
          <Text style={type.display} accessibilityRole="header">Ticket {confirmation.ticketNumber}</Text>
          <Facts rows={[
            { label: 'Ticket number', value: confirmation.ticketNumber },
            { label: 'Status', value: labelStatus(confirmation.status) },
            { label: 'Scope', value: labelStatus(ticket.repairScope) },
            { label: 'Service', value: labelStatus(ticket.serviceType) },
            { label: 'Priority', value: labelStatus(ticket.priority) },
            { label: 'Site', value: siteLabel(sites, ticket.siteId) },
            { label: 'Manufacturer', value: device && device.manufacturer },
            { label: 'Model', value: device && device.model },
            { label: 'Serial number', value: device && device.serialNumber },
            { label: 'Issue', value: ticket.issueDescription },
            { label: 'Symptoms', value: ticket.symptoms },
            { label: 'Fault details', value: ticket.faultInformation },
            { label: 'Additional repair details', value: ticket.additionalRequirements },
          ]} />
        </>
      )}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  successHead: {
    alignItems: 'center',
    gap: 6,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextSteps: {
    gap: 8,
    borderWidth: 1,
  },
  summary: {
    gap: 8,
  },
  footer: {
    gap: 8,
  },
});
