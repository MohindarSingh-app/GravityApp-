import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { canReschedule, labelStatus, siteLabel } from '../../../flows/customerFlow';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function includedItems(coverage) {
  return String(coverage || '')
    .split(/\r?\n|[;•]/)
    .map((item) => item.replace(/^\s*[-✓✔]\s*/, '').trim())
    .filter(Boolean);
}

function visitDate(request) {
  return request.scheduledDate || request.preferredDate || request.createdAt;
}

export function AmcContractScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { sites } = useCompanySites();
  const { colors, radius, type } = useTheme();
  const contractId = route.params && route.params.contractId;
  const [contract, setContract] = useState(null);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visitError, setVisitError] = useState('');

  const load = useCallback(async () => {
    if (!contractId) {
      setError('Open a contract from the AMC list.');
      setLoading(false);
      return;
    }
    setError('');
    setVisitError('');
    try {
      const data = await customerApi.contract(contractId);
      const current = (data && data.contract) || null;
      if (!current) throw new Error('The AMC contract details were not returned.');
      setContract(current);
      try {
        const requestData = await customerApi.amcRequests(contractId);
        setVisits((requestData && requestData.items) || []);
      } catch (err) {
        setVisitError(getErrorMessage(err));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  function raiseBreakdown() {
    const parent = navigation.getParent();
    if (parent) parent.navigate('Emergency');
    else navigation.navigate('Emergency');
  }

  const visitItems = visits
    .filter((item) => item.status !== 'draft' && item.status !== 'cancelled')
    .map((item) => ({ ...item, date: visitDate(item) }))
    .sort((left, right) => String(right.date || '').localeCompare(String(left.date || '')))
    .slice(0, 5);
  const nextVisitDate = contract && contract.visitSchedule && contract.visitSchedule.nextVisitDate;
  if (
    contract
    && nextVisitDate
    && !visitItems.some((item) => String(item.date || '').slice(0, 10) === String(nextVisitDate).slice(0, 10))
  ) {
    visitItems.unshift({
      id: 'next-visit',
      requestType: 'visit',
      status: 'scheduled',
      date: nextVisitDate,
      serviceRequirement: 'Scheduled AMC visit',
    });
  }
  const coverage = includedItems(contract && contract.coverage);

  return (
    <Screen
      header={<AppBar title="AMC Details" onBack={() => navigation.goBack()} />}
      headerColor={colors.background}
      refreshing={loading && Boolean(contract)}
      onRefresh={load}
      footer={contract ? (
        <View style={styles.footerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Raise AMC breakdown"
            onPress={raiseBreakdown}
            style={({ pressed }) => [
              styles.footerButton,
              styles.footerSecondary,
              { backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: radius.button },
              pressed && styles.pressed,
            ]}
          >
            <Glyph name="bolt" color={colors.primary} size={17} />
            <Text style={[type.small, styles.footerLabel, { color: colors.primary }]}>Raise{'\n'}Breakdown</Text>
          </Pressable>
          {canReschedule(contract) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reschedule AMC visit"
              onPress={() => navigation.navigate('AmcReschedule', { contractId: contract.id })}
              style={({ pressed }) => [
                styles.footerButton,
                { backgroundColor: colors.primary, borderColor: colors.primary, borderRadius: radius.button },
                pressed && styles.pressed,
              ]}
            >
              <Glyph name="calendar" color={colors.textOnPrimary} size={17} />
              <Text style={[type.small, styles.footerLabel, { color: colors.textOnPrimary }]}>Reschedule{'\n'}Visit</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    >
      {error ? <Banner message={error} tone="warning" /> : null}
      {loading && !contract ? <SkeletonStack rows={5} /> : null}
      {contract ? (
        <>
          <View style={[styles.summaryCard, { backgroundColor: colors.primaryLight, borderColor: colors.primarySoft, borderRadius: radius.card }]}>
            <View style={styles.summaryHeading}>
              <View style={styles.summaryCopy}>
                <Text style={[type.heading, { color: colors.text }]} numberOfLines={2}>
                  {labelStatus(contract.amcType || contract.contractType) || 'AMC Contract'}
                </Text>
                <Text style={[type.small, { color: colors.textSecondary }]} numberOfLines={1}>
                  {[contract.contractNumber, siteLabel(sites, contract.siteId)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: colors.successSurface, borderRadius: radius.pill }]}>
                <Text style={[styles.statusText, { color: colors.success }]}>{labelStatus(contract.status)}</Text>
              </View>
            </View>
            <View style={styles.factsGrid}>
              {[
                { label: 'Start date', value: formatDate(contract.startDate) },
                { label: 'End date', value: formatDate(contract.endDate) },
                { label: 'Visits per year', value: contract.visitSchedule && contract.visitSchedule.visitsPerYear
                  ? String(contract.visitSchedule.visitsPerYear)
                  : labelStatus(contract.visitSchedule && contract.visitSchedule.frequency) || '—' },
                { label: 'Next visit', value: formatDate(nextVisitDate) },
              ].map((item) => (
                <View key={item.label} style={[styles.factCell, { backgroundColor: colors.surface, borderRadius: radius.sm }]}>
                  <Text style={[type.small, { color: colors.textTertiary }]}>{item.label}</Text>
                  <Text style={[type.small, styles.factValue, { color: colors.text }]} numberOfLines={1}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={[type.label, styles.sectionHeading, { color: colors.textSecondary }]}>WHAT'S INCLUDED</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
            {coverage.length ? coverage.map((item, index) => (
              <View key={`${index}-${item}`} style={styles.coverageRow}>
                <Glyph name="check" color={colors.success} size={15} />
                <Text style={[type.small, styles.flex]}>{item}</Text>
              </View>
            )) : <Text style={type.small}>Coverage details are not listed for this contract.</Text>}
          </View>

          <Text style={[type.label, styles.sectionHeading, { color: colors.textSecondary }]}>VISIT HISTORY</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
            {visitError ? <Text style={[type.small, { color: colors.danger }]}>{visitError}</Text> : null}
            {visitItems.length ? visitItems.map((visit, index) => {
              const completed = visit.status === 'completed';
              return (
                <View
                  key={visit.id || `${visit.date}-${index}`}
                  style={[styles.visitRow, index < visitItems.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
                >
                  <View style={[styles.visitIcon, { backgroundColor: completed ? colors.successSurface : colors.primaryLight, borderRadius: radius.sm }]}>
                    <Glyph name={completed ? 'check' : 'calendar'} color={completed ? colors.success : colors.primary} size={16} />
                  </View>
                  <View style={styles.visitCopy}>
                    <Text style={[type.heading, styles.visitTitle]} numberOfLines={1}>
                      {visit.requestNumber || labelStatus(visit.requestType) || 'AMC visit'}
                    </Text>
                    <Text style={[type.small, { color: colors.textSecondary }]} numberOfLines={2}>
                      {[formatDate(visit.date), visit.serviceRequirement, contract.assignedService && contract.assignedService.engineerName].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: completed ? colors.successSurface : colors.primaryLight, borderRadius: radius.pill }]}>
                    <Text style={[styles.statusText, { color: completed ? colors.success : colors.primary }]}>
                      {completed ? 'Done' : labelStatus(visit.status)}
                    </Text>
                  </View>
                </View>
              );
            }) : !visitError ? (
              <Text style={type.small}>No visit history is available yet.</Text>
            ) : null}
          </View>

          <Text style={[type.label, styles.sectionHeading, { color: colors.textSecondary }]}>DOCUMENTS</Text>
          <View style={[styles.sectionCard, styles.documentCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
            <View style={[styles.documentIcon, { backgroundColor: colors.primaryLight, borderRadius: radius.sm }]}>
              <Glyph name="document" color={colors.primary} size={18} />
            </View>
            <View style={styles.flex}>
              <Text style={type.heading}>Contract documents</Text>
              <Text style={type.small}>Documents will appear here when they are shared.</Text>
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  summaryHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  summaryCopy: {
    flex: 1,
    gap: 3,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  factsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  factCell: {
    width: '47%',
    minHeight: 48,
    paddingHorizontal: 9,
    paddingVertical: 7,
    justifyContent: 'center',
    gap: 2,
  },
  factValue: {
    fontWeight: '700',
  },
  sectionHeading: {
    marginTop: 2,
    letterSpacing: 0.5,
  },
  sectionCard: {
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 8,
    gap: 0,
  },
  coverageRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  flex: {
    flex: 1,
  },
  visitRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 7,
  },
  visitIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  visitTitle: {
    fontSize: 14,
  },
  documentCard: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  documentIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  footerButton: {
    flex: 1,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 6,
    borderWidth: 1.5,
  },
  footerSecondary: {
    borderWidth: 1.5,
  },
  footerLabel: {
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.84,
  },
});
