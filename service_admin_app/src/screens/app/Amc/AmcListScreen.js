import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { Card } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { buildAmcRenewal, labelStatus, submittedAmc } from '../../../flows/customerFlow';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';

const RENEW_WINDOW_DAYS = 30;

function expiresSoon(contract) {
  if (contract.status !== 'active' || !contract.endDate) return false;
  const end = new Date(`${String(contract.endDate).slice(0, 10)}T23:59:59`);
  if (Number.isNaN(end.getTime())) return false;
  const days = (end.getTime() - Date.now()) / 86400000;
  return days >= 0 && days <= RENEW_WINDOW_DAYS;
}

function asCard(contract) {
  const visit = contract.visitSchedule || {};
  return {
    expiringSoon: expiresSoon(contract),
    id: contract.id,
    siteId: contract.siteId,
    title: contract.amcType || contract.title,
    number: contract.contractNumber,
    status: contract.status,
    coverage: contract.coverage,
    startDate: contract.startDate,
    endDate: contract.endDate,
    visitsDone: contract.visitsDone != null ? contract.visitsDone : visit.visitsDone,
    visitsRemaining: contract.visitsRemaining != null ? contract.visitsRemaining : visit.visitsRemaining,
    nextVisit: contract.nextVisit || (visit.nextVisitDate ? `Next visit: ${visit.nextVisitDate}` : ''),
  };
}

export function AmcListScreen() {
  const navigation = useNavigation();
  const { colors, radius, type } = useTheme();
  const { clear } = useFlowDraft();
  const [contracts, setContracts] = useState([]);
  const [activeContractCount, setActiveContractCount] = useState(0);
  const [renewingId, setRenewingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await customerApi.contracts();
      if (!Number.isSafeInteger(data && data.activeCount) || data.activeCount < 0) {
        throw new Error('The active AMC contract count is unavailable.');
      }
      setContracts(((data && data.items) || []).map(asCard));
      setActiveContractCount(data.activeCount);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  function startRequest() {
    clear();
    navigation.navigate('AmcRequest');
  }

  async function renew(contract) {
    if (renewingId) return;
    setRenewingId(contract.id);
    setError('');
    try {
      const result = await customerApi.createAmcRequest(buildAmcRenewal(contract));
      if (!submittedAmc(result)) {
        setError('The service did not confirm this request.');
        return;
      }
      navigation.navigate('AmcConfirmation', { kind: 'renew', confirmation: result.confirmation, request: result.request });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRenewingId('');
    }
  }

  const rows = contracts.map((item) => (item.visitsDone != null ? item : asCard(item)));
  const expiring = rows.filter((item) => item.expiringSoon).length;
  const metrics = [
    { label: 'Active', value: activeContractCount, glyph: 'cover' },
    { label: 'Visits', value: rows.reduce((sum, item) => sum + (Number(item.visitsDone) || 0), 0), glyph: 'check' },
    { label: 'Remaining', value: rows.reduce((sum, item) => sum + (Number(item.visitsRemaining) || 0), 0), glyph: 'jobs' },
    { label: 'Renew soon', value: expiring, glyph: 'bolt' },
  ];

  return (
    <Screen
      header={(
        <AppBar
          title="AMC Contracts"
          onBack={() => navigation.goBack()}
          actionLabel="+ New"
          onAction={startRequest}
        />
      )}
      headerColor={colors.background}
      refreshing={!loading && rows.length > 0}
      onRefresh={() => { setLoading(true); load(); }}
    >
      <Card style={[styles.promo, { backgroundColor: colors.deepSurface }]}>
        <View style={styles.promoHead}>
          <Glyph name="cover" color={colors.onDeepSurface} size={22} />
        </View>
        <Text style={[type.heading, { color: colors.onDeepSurface }]}>Need AMC coverage?</Text>
        <Text style={[type.small, { color: colors.onDeepSurface }]}>
          Request a quote based on your equipment, plant details and coverage needs.
        </Text>
        <Button title="+ Start New AMC Contract" variant="accent" onPress={startRequest} />
      </Card>

      {expiring ? (
        <View style={[styles.warn, { backgroundColor: colors.orangeLight, borderRadius: radius.card }]}>
          <Text style={[type.heading, { color: colors.orange }]}>
            {`${expiring} contract${expiring === 1 ? '' : 's'} expire${expiring === 1 ? 's' : ''} within ${RENEW_WINDOW_DAYS} days`}
          </Text>
          <Text style={type.small}>Renew now to keep coverage.</Text>
        </View>
      ) : null}

      <View style={styles.metrics}>
        {metrics.map((metric) => (
          <View
            key={metric.label}
            accessible
            accessibilityLabel={`${metric.label}: ${metric.value}`}
            style={[styles.metric, { backgroundColor: colors.metricTile, borderColor: colors.metricTileBorder, borderRadius: radius.md }]}
          >
            <View style={styles.metricTop}>
              <View style={[styles.metricIcon, { backgroundColor: colors.metricTileIcon, borderRadius: radius.sm }]}>
                <Glyph name={metric.glyph} color={colors.metricTileAccent} size={14} />
              </View>
              <Text style={[styles.metricValue, { color: colors.metricTileValue }]} numberOfLines={1}>
                {metric.value}
              </Text>
            </View>
            <Text style={[styles.metricLabel, { color: colors.metricTileLabel }]} numberOfLines={1}>
              {metric.label}
            </Text>
          </View>
        ))}
      </View>

      <Banner message={error} />
      {loading && rows.length === 0 ? <SkeletonStack rows={4} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          glyph="cover"
          title="No AMC contracts"
          message="When a contract is on the company it shows here. You can still ask for cover."
          action={<Button title="Request AMC" onPress={startRequest} />}
        />
      ) : null}

      {rows.map((contract) => {
        const done = Number(contract.visitsDone) || 0;
        const remain = Number(contract.visitsRemaining) || 0;
        const total = done + remain || 1;
        const { expiringSoon } = contract;
        return (
          <Pressable
            key={contract.id}
            accessibilityRole="button"
            accessibilityLabel={`View contract ${contract.number}`}
            onPress={() => navigation.navigate('AmcContract', { contractId: contract.id })}
            style={[
              styles.contract,
              {
                backgroundColor: colors.surface,
                borderColor: expiringSoon ? colors.orange : colors.border,
                borderRadius: radius.card,
              },
            ]}
          >
            <View style={styles.contractHead}>
              <Text style={[type.heading, styles.flex]}>{contract.title}</Text>
              <StatusBadge label={expiringSoon ? 'Expires soon' : labelStatus(contract.status)} status={expiringSoon ? 'pending' : contract.status} />
            </View>
            <Text style={type.small}>{[contract.number, contract.coverage].filter(Boolean).join(' · ')}</Text>
            <Text style={type.small}>{[contract.startDate, contract.endDate].filter(Boolean).join(' — ')}</Text>
            <View style={[styles.barTrack, { backgroundColor: colors.surfaceTertiary, borderRadius: radius.pill }]}>
              <View style={[styles.barFill, { width: `${Math.round((done / total) * 100)}%`, backgroundColor: expiringSoon ? colors.orange : colors.primary, borderRadius: radius.pill }]} />
            </View>
            <Text style={type.small}>{done} visits done · {remain} remaining</Text>
            {contract.nextVisit ? (
              <View style={[styles.next, { backgroundColor: colors.infoSurface, borderRadius: radius.md }]}>
                <Glyph name="jobs" color={colors.info} size={16} />
                <Text style={[type.small, styles.flex]}>{contract.nextVisit}</Text>
              </View>
            ) : null}
            {expiringSoon ? (
              <Button
                title="Renew Contract"
                variant="accent"
                loading={renewingId === contract.id}
                onPress={() => renew(contract)}
              />
            ) : null}
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  promo: {
    gap: 8,
  },
  promoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  warn: {
    padding: 12,
    gap: 4,
  },
  metrics: {
    flexDirection: 'row',
    gap: 6,
  },
  metric: {
    flex: 1,
    minWidth: 0,
    minHeight: 75,
    paddingHorizontal: 7,
    paddingVertical: 8,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metricIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    flex: 1,
    fontSize: 16.5,
    lineHeight: 21,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
  },
  contract: {
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  contractHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  barTrack: {
    height: 6,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
  },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
});
