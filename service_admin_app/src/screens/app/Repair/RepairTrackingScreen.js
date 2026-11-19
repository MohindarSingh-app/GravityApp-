import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Facts } from '../../../components/Facts';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { Card } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { labelStatus } from '../../../flows/customerFlow';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { formatWhen } from '../../../utils/format';

function eventTime(event) {
  return formatWhen(event.changedAt || event.createdAt);
}

export function RepairTrackingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, type } = useTheme();
  const ticketId = route.params && route.params.ticketId;
  const fallback = route.params && route.params.ticket;
  const [ticket, setTicket] = useState(fallback || null);
  const [loading, setLoading] = useState(!fallback);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!ticketId) {
      setError('This repair ticket cannot be tracked because its ticket ID is missing.');
      setLoading(false);
      return;
    }
    setError('');
    try {
      const result = await customerApi.repairTicket(ticketId);
      if (!result || !result.ticket) throw new Error('Repair status was not returned by the service.');
      setTicket(result.ticket);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useFocusEffect(useCallback(() => {
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]));

  const history = ticket && Array.isArray(ticket.statusHistory) ? ticket.statusHistory : [];
  const assignmentPending = !ticket || !ticket.assignedEngineerName;

  return (
    <Screen
      header={<AppBar title="Track Specialist" onBack={() => navigation.goBack()} />}
      headerColor={colors.background}
      refreshing={!loading}
      onRefresh={load}
    >
      <Banner message={error} />
      {loading && !ticket ? <SkeletonStack rows={4} /> : null}
      {ticket ? (
        <>
          <Text style={type.display} accessibilityRole="header">
            Repair {ticket.ticketNumber || ''}
          </Text>
          <StatusBadge label={labelStatus(ticket.status)} status={ticket.status} />
          <Card style={styles.card}>
            <Text style={[type.heading, { color: colors.primary }]}>Gravity Hub AI — Next Steps</Text>
            <Text style={type.body}>
              {assignmentPending
                ? 'Your repair request has been received. A specialist is being assigned and will review the problem details and photos.'
                : `${ticket.assignedEngineerName} has been assigned and will review the problem details and photos.`}
            </Text>
          </Card>
          <Card style={styles.card}>
            <Text style={type.heading}>Repair status</Text>
            <Facts rows={[
              { label: 'Booking ID', value: ticket.ticketNumber },
              { label: 'Current status', value: labelStatus(ticket.status) },
              { label: 'Specialist', value: ticket.assignedEngineerName || 'Assignment pending' },
              { label: 'Last updated', value: formatWhen(ticket.updatedAt || ticket.submittedAt) },
            ]} />
          </Card>
          {history.length ? (
            <Card style={styles.card}>
              <Text style={type.heading}>Status updates</Text>
              {history.map((event) => (
                <Text key={event.id} style={type.body}>
                  {labelStatus(event.toStatus || event.newStatus)}
                  {eventTime(event) ? ` · ${eventTime(event)}` : ''}
                  {event.note || event.remarks ? `\n${event.note || event.remarks}` : ''}
                </Text>
              ))}
            </Card>
          ) : (
            <Text style={[type.small, { color: colors.textSecondary }]}>
              Status updates will appear here as your repair progresses. This screen checks for updates every 15 seconds.
            </Text>
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
  },
});
