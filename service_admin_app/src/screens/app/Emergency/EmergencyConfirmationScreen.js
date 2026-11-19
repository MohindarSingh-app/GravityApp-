import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AppBar } from '../../../components/AppBar';
import { Button } from '../../../components/Button';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { Card } from '../../../components/ui/Card';
import { useTheme } from '../../../theme/ThemeContext';

function SummaryRow({ label, value, colors, last = false }) {
  return (
    <View style={[styles.summaryRow, !last && { borderBottomColor: colors.successSurface, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color: colors.text }]} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

export function EmergencyConfirmationScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, radius, type } = useTheme();
  const {
    requestId = '',
    signalId = '',
    jobId = '',
    job = null,
    responseSla: slaParam = '',
    location = '',
    issue = 'Emergency request',
  } = route.params || {};
  const responseSla = slaParam || (job && job.etaMinutes ? `${job.etaMinutes} min` : '—');
  const specialist = job && job.engineerName ? job.engineerName : 'Being assigned';

  return (
    <Screen
      header={<AppBar title="Emergency Request Sent" onBack={() => navigation.navigate('Dashboard')} />}
      headerColor={colors.background}
    >
      <View style={[
        styles.heroCard,
        {
          backgroundColor: colors.successSurface,
          borderColor: colors.successSurface,
          borderRadius: radius.card,
        },
      ]}>
        <View style={[
          styles.successIconRing,
          { backgroundColor: colors.success, borderRadius: radius.pill },
        ]}>
          <Glyph name="bolt" color={colors.onAccent} size={29} />
        </View>
        <Text style={[type.title, styles.title, { color: colors.text }]}>Emergency Request Sent!</Text>
        <Text style={[type.small, styles.requestId, { color: colors.success }]}>
          Request ID: {requestId || signalId || 'Submitted'}
        </Text>
        <Text style={[type.small, styles.assignment, { color: colors.textSecondary }]}>
          Finding nearest certified specialist…
        </Text>
        <Text style={[type.label, styles.issue, { color: colors.text }]} numberOfLines={2}>{issue}</Text>
      </View>

      <Card style={[
        styles.summary,
        { borderColor: colors.successSurface, borderRadius: radius.card },
      ]}>
        <SummaryRow label="Response SLA" value={responseSla} colors={colors} />
        <SummaryRow label="Location" value={location} colors={colors} />
        <SummaryRow label="Nearest specialist" value={specialist} colors={colors} last />
      </Card>

      <Button
        title="Track Live  ›"
        variant="success"
        onPress={() => navigation.navigate('EmergencyTracking', {
          requestId,
          signalId,
          jobId,
          job,
          responseSla,
          location,
          issue,
        })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 7,
  },
  successIconRing: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginTop: 2,
  },
  requestId: {
    fontWeight: '700',
    textAlign: 'center',
  },
  assignment: {
    textAlign: 'center',
  },
  issue: {
    textAlign: 'center',
    marginTop: 3,
  },
  summary: {
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  summaryRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryLabel: {
    fontSize: 13,
  },
  summaryValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
  },
});
