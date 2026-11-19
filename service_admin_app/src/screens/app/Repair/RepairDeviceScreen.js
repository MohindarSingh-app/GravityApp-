import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { DepthCard } from '../../../components/DepthCard';
import { EmptyState } from '../../../components/EmptyState';
import { FlowScreen } from '../../../components/FlowScreen';
import { SkeletonStack } from '../../../components/Skeleton';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { labelStatus, siteLabel } from '../../../flows/customerFlow';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { formatWhen } from '../../../utils/format';
import { REPAIR_DEVICE_OPTIONS, REPAIR_STEPS, recommendedRepairScope } from './repairFlow';

function historyKeyOf(device) {
  const serial = String(device.serialNumber || device.serial_number || '').trim().toLowerCase();
  if (serial) return `serial:${serial}`;
  const maker = String(device.manufacturer || '').trim().toLowerCase();
  const model = String(device.model || '').trim().toLowerCase();
  const type = String(device.deviceType || '').trim().toLowerCase();
  return `device:${maker}|${model}|${type}`;
}

function ticketDate(ticket) {
  const raw = ticket.submittedAt || ticket.completedAt || ticket.createdAt || ticket.updatedAt;
  const time = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
}

function buildPreviousRepairHistory(devices, tickets) {
  const deviceById = new Map();
  (devices || []).forEach((device) => {
    if (device && device.id) deviceById.set(String(device.id), device);
  });
  const sortedTickets = [...(tickets || [])].sort((a, b) => ticketDate(b) - ticketDate(a));
  const seen = new Set();
  const history = [];
  sortedTickets.forEach((ticket) => {
    const linked = ticket.deviceId ? deviceById.get(String(ticket.deviceId)) : null;
    const candidate = linked || {
      id: ticket.deviceId || '',
      deviceType: ticket.deviceType || ticket.device_type || '',
      manufacturer: ticket.deviceManufacturer || ticket.device_manufacturer || '',
      model: ticket.deviceModel || ticket.device_model || '',
      serialNumber: ticket.deviceSerialNumber || ticket.device_serial_number || '',
      installationLocation: ticket.deviceLocation || ticket.device_location || '',
      siteId: ticket.siteId,
    };
    if (!candidate.id && !candidate.serialNumber && !candidate.model && !candidate.manufacturer) return;
    const key = candidate.id ? `id:${candidate.id}` : historyKeyOf(candidate);
    if (seen.has(key)) return;
    seen.add(key);
    history.push({
      key,
      device: candidate,
      lastRepairedAt: ticket.submittedAt || ticket.completedAt || ticket.createdAt || null,
      ticketNumber: ticket.ticketNumber || '',
      status: ticket.status || '',
    });
  });
  // Devices that were never repaired should not appear here; only repaired-device history.
  return history;
}

export function RepairDeviceScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, type } = useTheme();
  const { clear, draft, patch } = useFlowDraft();
  const { sites, loading: sitesLoading, error: siteError, reload: reloadSites } = useCompanySites();
  const [devices, setDevices] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const lastFreshFlowKey = useRef(null);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [deviceData, ticketData] = await Promise.all([
        customerApi.devices(),
        customerApi.repairTickets().catch(() => ({ items: [] })),
      ]);
      setDevices((deviceData && deviceData.items) || []);
      setTickets((ticketData && ticketData.items) || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    const freshFlowKey = route.params && route.params.freshFlowKey;
    if (freshFlowKey && freshFlowKey !== lastFreshFlowKey.current) {
      clear();
      lastFreshFlowKey.current = freshFlowKey;
      navigation.setParams({ freshFlowKey: null });
    }
    load();
    reloadSites();
  }, [clear, load, navigation, reloadSites, route.params]));

  function selectExistingDevice(device) {
    const scope = recommendedRepairScope(route.params && route.params.recommendedScope);
    const fromRecommendation = Boolean(route.params && route.params.fromRecommendation);
    if (fromRecommendation && (
      !device.siteId
      || !draft.siteId
      || String(device.siteId) !== String(draft.siteId)
    )) {
      setError('Choose a device registered at the recommendation site.');
      return;
    }
    if (device.id === draft.deviceId && !fromRecommendation) {
      navigation.navigate('RepairFault');
      return;
    }
    const deviceKind = device.deviceType === 'drive' ? 'dc' : device.deviceType;
    const deviceOption = REPAIR_DEVICE_OPTIONS.find(
      (option) => option.value === deviceKind,
    );
    patch({
      deviceId: device.id,
      siteId: device.siteId,
      deviceSiteId: device.siteId,
      deviceType: device.deviceType,
      repairDeviceKind: deviceKind,
      repairDeviceLabel: deviceOption ? deviceOption.label : labelStatus(device.deviceType),
      manufacturer: device.manufacturer,
      model: device.model || '',
      serialNumber: device.serialNumber || '',
      installationLocation: device.installationLocation || '',
      assetNumber: device.assetNumber || '',
      priority: 'normal',
      issueDescription: fromRecommendation ? draft.issueDescription || '' : '',
      symptoms: fromRecommendation ? draft.symptoms || '' : '',
      faultInformation: fromRecommendation ? draft.faultInformation || '' : '',
      faultDescription: fromRecommendation ? draft.faultDescription || '' : '',
      faultErrorCode: fromRecommendation ? draft.faultErrorCode || '' : '',
      errorCode: fromRecommendation ? draft.errorCode || '' : '',
      faultFrequency: fromRecommendation ? draft.faultFrequency || '' : '',
      downtimeLoss: fromRecommendation ? draft.downtimeLoss || '' : '',
      selectedFaultTags: fromRecommendation ? draft.selectedFaultTags || [] : [],
      hmiScreenSize: '',
      hmiScreenSizeOther: '',
      warrantyStatus: '',
      pendingAttachments: [],
      repairLogistics: '',
      repairLogisticsLabel: '',
      ...(scope ? {
        repairScope: scope.value,
        repairScopeId: scope.id,
        repairScopeLabel: scope.label,
        serviceType: scope.serviceType,
      } : {
        repairScope: '',
        repairScopeId: '',
        repairScopeLabel: '',
        serviceType: '',
      }),
    });
    navigation.navigate('RepairFault');
  }

  function selectDeviceType(option) {
    const scope = recommendedRepairScope(route.params && route.params.recommendedScope);
    const fromRecommendation = Boolean(route.params && route.params.fromRecommendation);
    if (!draft.deviceId && draft.repairDeviceKind === option.value) {
      navigation.navigate('RepairMake');
      return;
    }
    patch({
      deviceId: '',
      deviceSiteId: '',
      deviceType: option.apiType || option.value,
      repairDeviceKind: option.value,
      repairDeviceLabel: option.label,
      manufacturer: '',
      repairMake: '',
      model: '',
      serialNumber: '',
      assetNumber: '',
      installationLocation: fromRecommendation ? draft.installationLocation || '' : '',
      siteId: fromRecommendation ? draft.siteId || '' : '',
      priority: 'normal',
      issueDescription: fromRecommendation ? draft.issueDescription || '' : '',
      symptoms: fromRecommendation ? draft.symptoms || '' : '',
      faultInformation: fromRecommendation ? draft.faultInformation || '' : '',
      faultDescription: fromRecommendation ? draft.faultDescription || '' : '',
      faultErrorCode: fromRecommendation ? draft.faultErrorCode || '' : '',
      errorCode: fromRecommendation ? draft.errorCode || '' : '',
      faultFrequency: fromRecommendation ? draft.faultFrequency || '' : '',
      downtimeLoss: fromRecommendation ? draft.downtimeLoss || '' : '',
      selectedFaultTags: fromRecommendation ? draft.selectedFaultTags || [] : [],
      hmiScreenSize: '',
      hmiScreenSizeOther: '',
      warrantyStatus: '',
      pendingAttachments: [],
      repairLogistics: '',
      repairLogisticsLabel: '',
      ...(scope ? {
        repairScope: scope.value,
        repairScopeId: scope.id,
        repairScopeLabel: scope.label,
        serviceType: scope.serviceType,
      } : {
        repairScope: '',
        repairScopeId: '',
        repairScopeLabel: '',
        serviceType: '',
      }),
    });
    navigation.navigate('RepairMake');
  }

  const fromRecommendation = Boolean(route.params && route.params.fromRecommendation);
  const selectionDevices = useMemo(() => (fromRecommendation
    ? devices.filter((device) => (
      device.siteId
      && draft.siteId
      && String(device.siteId) === String(draft.siteId)
    ))
    : devices), [devices, draft.siteId, fromRecommendation]);

  const previousRepairs = useMemo(() => {
    const scopedTickets = fromRecommendation
      ? tickets.filter((ticket) => ticket.siteId && draft.siteId && String(ticket.siteId) === String(draft.siteId))
      : tickets;
    const scopedDevices = fromRecommendation ? selectionDevices : devices;
    const history = buildPreviousRepairHistory(scopedDevices, scopedTickets);
    if (!fromRecommendation) return history;
    return history.filter((entry) => entry.device.siteId && draft.siteId && String(entry.device.siteId) === String(draft.siteId));
  }, [devices, draft.siteId, fromRecommendation, selectionDevices, tickets]);

  const selectedHistory = previousRepairs.find((entry) => entry.device.id && String(entry.device.id) === String(draft.deviceId));

  function chooseHistoryDevice(entry) {
    if (!entry || !entry.device) return;
    if (!entry.device.id) {
      setError('This repaired device is no longer registered. Continue with a device type below.');
      return;
    }
    setHistoryOpen(false);
    selectExistingDevice(entry.device);
  }

  return (
    <FlowScreen
      title="Repair center"
      steps={REPAIR_STEPS}
      step={0}
      onBack={() => navigation.goBack()}
      error={error || siteError}
      refreshing={(loading || sitesLoading) && (devices.length > 0 || previousRepairs.length > 0)}
      onRefresh={() => { load(); reloadSites(); }}
    >
      <Text style={type.display} accessibilityRole="header">Select Device Type</Text>
      <Text style={type.muted}>
        Pick a previously repaired device from history, or continue normally with a device type below.
      </Text>
      {loading && devices.length === 0 && previousRepairs.length === 0 ? <SkeletonStack rows={4} /> : null}
      {!loading && !error && previousRepairs.length === 0 ? (
        <EmptyState
          title="No previous repairs"
          message={fromRecommendation
            ? 'No previously repaired device was found at this recommendation site. Continue normally with a device type below.'
            : 'No previously repaired device was found yet. Continue normally with a device type below.'}
        />
      ) : null}
      {previousRepairs.length ? (
        <View style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={type.heading}>Previously repaired devices — history</Text>
          <Text style={type.small}>Each device appears once with its last repair date. Select one to repair again.</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setHistoryOpen((open) => !open)}
            style={[styles.dropdownButton, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary }]}
          >
            <View style={styles.dropdownTextWrap}>
              <Text style={[type.label, { color: colors.text }]} numberOfLines={1}>
                {selectedHistory
                  ? ([selectedHistory.device.manufacturer, selectedHistory.device.model].filter(Boolean).join(' ') || 'Selected device')
                  : 'Select a previously repaired device (optional)'}
              </Text>
              <Text style={type.small} numberOfLines={1}>
                {selectedHistory && selectedHistory.lastRepairedAt
                  ? `Last repaired: ${formatWhen(selectedHistory.lastRepairedAt)}`
                  : 'Shows last repair date, no duplicates'}
              </Text>
            </View>
            <Text style={[styles.dropdownArrow, { color: colors.text }]}>{historyOpen ? '▲' : '▼'}</Text>
          </Pressable>
          {historyOpen ? (
            <View style={[styles.dropdownList, { borderColor: colors.border }]}>
              {previousRepairs.map((entry) => {
                const title = [entry.device.manufacturer, entry.device.model].filter(Boolean).join(' ')
                  || labelStatus(entry.device.deviceType) || 'Device';
                return (
                  <Pressable
                    key={entry.key}
                    onPress={() => chooseHistoryDevice(entry)}
                    style={[styles.dropdownItem, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
                  >
                    <Text style={[type.label, { color: colors.text }]} numberOfLines={1}>{title}</Text>
                    <Text style={type.small} numberOfLines={1}>
                      {[entry.device.serialNumber ? `S/N ${entry.device.serialNumber}` : null,
                        siteLabel(sites, entry.device.siteId)].filter(Boolean).join(' · ') || 'Registered device'}
                    </Text>
                    <Text style={type.small} numberOfLines={1}>
                      {entry.lastRepairedAt ? `Last repaired: ${formatWhen(entry.lastRepairedAt)}` : 'Last repair date unavailable'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
      <Text style={type.heading}>Select a device type</Text>
      {REPAIR_DEVICE_OPTIONS.map((option) => (
        <DepthCard
          key={option.value}
          tone="repair"
          glyph={option.glyph}
          title={option.label}
          detail={option.detail}
          onPress={() => selectDeviceType(option)}
        />
      ))}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  historyCard: {
    gap: 8,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  dropdownButton: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dropdownTextWrap: {
    flex: 1,
    gap: 2,
  },
  dropdownArrow: {
    fontSize: 14,
    fontWeight: '700',
  },
  dropdownList: {
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 8,
  },
  dropdownItem: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
});
