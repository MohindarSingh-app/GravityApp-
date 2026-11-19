import { useCallback, useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { dialPhone, supportPhoneFromEnv } from '../../../constants/supportContact';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/ui/Card';
import { FlowScreen } from '../../../components/FlowScreen';
import { SitePicker } from '../../../components/SitePicker';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { buildDevice, siteLabel, validateDevice } from '../../../flows/customerFlow';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useSubmit } from '../../../flows/useSubmit';
import { useTheme } from '../../../theme/ThemeContext';
import { fieldErrors, getErrorMessage } from '../../../utils/errors';
import { RepairChoiceCard } from './RepairChoiceCard';
import {
  REPAIR_LOGISTICS_OPTIONS,
  REPAIR_STEPS,
  REPAIR_WORKSHOP_ADDRESS,
} from './repairFlow';

const FULL_SERVICE_SCOPE = 'on_site';

export function RepairLogisticsScreen() {
  const navigation = useNavigation();
  const { colors, type } = useTheme();
  const { draft, patch } = useFlowDraft();
  const { sites, error: siteError, reload: reloadSites } = useCompanySites();
  const { phase, submit } = useSubmit();
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [externalError, setExternalError] = useState('');
  const [copiedMessage, setCopiedMessage] = useState('');
  const [selectedLogistics, setSelectedLogistics] = useState(draft.repairLogistics || '');
  const isFullService = draft.repairScope === FULL_SERVICE_SCOPE;
  const isRepairInstall = draft.repairScope === 'pickup_and_return';
  const selectedSite = sites.find((site) => site.id === draft.siteId);

  useEffect(() => {
    setSelectedLogistics(draft.repairLogistics || '');
  }, [draft.repairLogistics]);

  useFocusEffect(useCallback(() => {
    reloadSites();
  }, [reloadSites]));

  async function selectLogistics(value) {
    const option = REPAIR_LOGISTICS_OPTIONS.find((item) => item.value === value);
    if (!option) {
      setError('This delivery option is unavailable. Select another option.');
      return;
    }
    setSelectedLogistics(value);
    patch({
      repairLogistics: value,
      repairLogisticsLabel: isRepairInstall && value === 'zypli-pickdrop'
        ? 'Gravity Hub Pickup + Install'
        : option.label,
    });
    setError('');
    setExternalError('');
    setCopiedMessage('');
    if (value === 'porter') {
      try {
        const url = 'https://porter.in';
        const canOpen = await Linking.canOpenURL(url);
        if (!canOpen) throw new Error('Porter is not available on this device.');
        await Linking.openURL(url);
      } catch (openError) {
        setExternalError(getErrorMessage(openError));
      }
    } else if (value === 'olauber' || value === 'courier') {
      await copyAddress();
    }
  }

  async function openMaps() {
    const url = `https://maps.google.com/?q=${encodeURIComponent(REPAIR_WORKSHOP_ADDRESS)}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error('Maps is not available on this device.');
      await Linking.openURL(url);
    } catch (openError) {
      setExternalError(getErrorMessage(openError));
    }
  }

  async function callWorkshop() {
    try {
      await dialPhone(supportPhoneFromEnv());
    } catch (callError) {
      setExternalError(getErrorMessage(callError));
    }
  }

  async function copyAddress() {
    try {
      Clipboard.setString(`Gravity Hub Repair Center\n${REPAIR_WORKSHOP_ADDRESS}`);
      setExternalError('');
      setCopiedMessage('Address copied. Paste it into your delivery or courier app.');
    } catch (clipboardError) {
      setExternalError(getErrorMessage(clipboardError));
    }
  }

  async function continueToIssue() {
    setError('');
    setErrors({});
    if (!draft.siteId) {
      setError('Select a site for pickup or drop-off.');
      return;
    }
    const logistics = selectedLogistics || draft.repairLogistics;
    const logisticsOption = REPAIR_LOGISTICS_OPTIONS.find((item) => item.value === logistics);
    if (!isFullService && !logisticsOption) {
      setError('Select one of the delivery options below to continue.');
      return;
    }
    if (!isFullService && logistics === 'zypli-pickdrop') {
      patch({ repairLogisticsLabel: 'Gravity Hub Pick & Drop' });
    } else if (isFullService) {
      patch({ repairLogistics: 'full-service', repairLogisticsLabel: 'Full Service' });
    }

    if (!draft.deviceId) {
      const registration = {
        ...draft,
        siteId: draft.siteId,
        installationLocation: draft.installationLocation || siteLabel(sites, draft.siteId),
      };
      const validationErrors = validateDevice(registration);
      if (validationErrors) {
        setErrors(validationErrors);
        setError('Complete the required device information before continuing.');
        return;
      }
      const { result, error: submitError } = await submit(
        () => customerApi.createDevice(buildDevice(registration)),
      );
      if (submitError) {
        setErrors(fieldErrors(submitError));
        setError(getErrorMessage(submitError));
        return;
      }
      if (!result || !result.device || !result.device.id) {
        setError('The service did not save this device.');
        return;
      }
      patch({
        deviceId: result.device.id,
        deviceSiteId: result.device.siteId,
        siteId: result.device.siteId,
        installationLocation: result.device.installationLocation,
      });
    } else if (draft.deviceId && selectedSite && selectedSite.id !== draft.siteId) {
      setError('The selected site must match the registered device site.');
      return;
    }
    navigation.navigate('RepairIssue');
  }

  return (
    <FlowScreen
      title="Select Site & Logistics"
      steps={REPAIR_STEPS}
      step={5}
      onBack={() => navigation.goBack()}
      error={error || siteError}
      footer={<Button title="Next — Review & Confirm" loading={phase === 'submitting'} onPress={continueToIssue} />}
    >
      <Text style={type.display} accessibilityRole="header">
        {isFullService ? 'Select Site for Service' : 'Select Site for Pickup / Drop'}
      </Text>
      {draft.deviceId ? (
        <Card style={[styles.siteCard, { backgroundColor: colors.primaryLight, borderColor: colors.primarySoft }]}>
          <Text style={[type.label, { color: colors.primary }]}>REGISTERED DEVICE SITE</Text>
          <Text style={[type.heading, { color: colors.text }]}>{siteLabel(sites, draft.siteId) || 'Saved site'}</Text>
          <Text style={type.muted}>
            {selectedSite && (selectedSite.fullAddress || selectedSite.address || selectedSite.city)
              ? selectedSite.fullAddress || selectedSite.address || selectedSite.city
              : draft.installationLocation || 'This repair will stay linked to the registered device site.'}
          </Text>
        </Card>
      ) : (
        <>
          <SitePicker
            label="Select Site for Pickup / Drop"
            sites={sites}
            value={draft.siteId}
            error={errors.siteId}
            onChange={(siteId) => patch({ siteId })}
          />
          <Button title="+ Add New Site" variant="secondary" onPress={() => navigation.navigate('SitesList')} />
        </>
      )}

      {!isFullService ? (
        <>
          <Card style={[styles.workshopCard, { borderColor: colors.border }]}>
            <Text style={type.heading}>Gravity Hub Repair Workshop</Text>
            <Text style={type.muted}>{REPAIR_WORKSHOP_ADDRESS}</Text>
            <View style={styles.buttonRow}>
              <View style={styles.buttonCell}>
                <Button title="Open in Maps" variant="secondary" onPress={openMaps} />
              </View>
              <View style={styles.buttonCell}>
                <Button title="Call Workshop" variant="secondary" onPress={callWorkshop} />
              </View>
            </View>
            <Button title="Copy Address" variant="ghost" onPress={copyAddress} />
            <Text style={[type.small, { color: colors.textSecondary }]}>
              Phone enquiries use the configured Gravity Hub support number.
            </Text>
          </Card>
          <Card style={[styles.packCard, { backgroundColor: colors.successSurface, borderColor: colors.success }]}>
            <Text style={[type.heading, { color: colors.success }]}>How to pack your device</Text>
            <Text style={[type.small, { color: colors.success }]}>
              1. Wrap in bubble wrap / foam — no loose parts{'\n'}
              2. Include your name, phone and fault description{'\n'}
              3. Add the repair ticket number to the package
            </Text>
          </Card>
          <Text style={type.heading}>Choose how to send</Text>
          <Card style={[styles.statusNote, { backgroundColor: colors.primaryLight, borderColor: colors.primarySoft }]}>
            <Text style={[type.small, { color: colors.primary }]}>
              Repair status updates will appear here as the service progresses.
            </Text>
          </Card>
          {REPAIR_LOGISTICS_OPTIONS.map((option) => {
            const title = isRepairInstall && option.value === 'zypli-pickdrop'
              ? 'Gravity Hub Pickup + Install'
              : option.label;
            const detail = isRepairInstall && option.value === 'zypli-pickdrop'
              ? 'Pickup, repair and site installation. You remove the unit.'
              : option.detail;
            return (
              <RepairChoiceCard
                key={option.value}
                title={title}
                detail={detail}
                glyph={option.glyph}
                selected={selectedLogistics === option.value || draft.repairLogistics === option.value}
                onPress={() => selectLogistics(option.value)}
              />
            );
          })}
          {draft.repairLogistics ? (
            <Card style={[styles.pickupCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              <Text style={type.heading}>
                {draft.repairLogistics === 'zypli-pickdrop' ? 'Pickup Details' : 'Gravity Hub Service Center Address'}
              </Text>
              <Text style={type.muted}>
                {draft.repairLogistics === 'zypli-pickdrop'
                  ? `Pickup address: ${siteLabel(sites, draft.siteId) || 'Selected site'}\nPickup arrangements will be coordinated after booking confirmation.`
                  : `${REPAIR_WORKSHOP_ADDRESS}\nPlease include your repair ticket number on the package and notify Gravity Hub after shipping.`}
              </Text>
              {draft.repairLogistics !== 'zypli-pickdrop' ? (
                <Button title="Copy Address" variant="secondary" onPress={copyAddress} />
              ) : null}
            </Card>
          ) : null}
        </>
      ) : (
        <Card style={[styles.fullServiceCard, { backgroundColor: colors.successSurface, borderColor: colors.success }]}>
          <Text style={[type.heading, { color: colors.success }]}>{'Full Service — Gravity Hub handles everything'}</Text>
          <Text style={[type.body, { color: colors.success }]}>
            ✓ Engineer site visit{'\n'}
            ✓ Hardware dismantling on-site{'\n'}
            ✓ Pickup of damaged device{'\n'}
            ✓ Component-level repair at workshop{'\n'}
            ✓ Return logistics{'\n'}
            ✓ Reinstallation at site{'\n'}
            ✓ Testing & commissioning{'\n'}
            ✓ Zero hassle — end-to-end
          </Text>
          <Text style={[type.small, { color: colors.success }]}>
            The team will coordinate the visit and share available repair updates in this screen.
          </Text>
        </Card>
      )}
      {copiedMessage ? <Text style={[type.small, { color: colors.success }]}>{copiedMessage}</Text> : null}
      {externalError ? <Text style={[type.body, { color: colors.danger }]}>{externalError}</Text> : null}
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  siteCard: {
    gap: 7,
    borderWidth: 1,
  },
  workshopCard: {
    gap: 8,
    borderWidth: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  buttonCell: {
    flex: 1,
  },
  packCard: {
    gap: 8,
    borderWidth: 1,
  },
  statusNote: {
    borderWidth: 1,
  },
  pickupCard: {
    gap: 8,
    borderWidth: 1,
  },
  fullServiceCard: {
    gap: 10,
    borderWidth: 1,
  },
});
