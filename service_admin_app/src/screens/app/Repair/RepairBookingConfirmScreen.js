import { useState } from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { Button } from '../../../components/Button';
import { Facts } from '../../../components/Facts';
import { FlowScreen } from '../../../components/FlowScreen';
import { Card } from '../../../components/ui/Card';
import {
  buildDevice,
  buildRepair,
  siteLabel,
  submittedTicket,
  validateDevice,
  validateRepairIssue,
} from '../../../flows/customerFlow';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useCompanySites } from '../../../flows/useCompanySites';
import { useSubmit } from '../../../flows/useSubmit';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { uploadPendingAttachments } from '../../../flows/uploadAttachments';
import { REPAIR_STEPS, REPAIR_WORKSHOP_ADDRESS } from './repairFlow';

export function RepairBookingConfirmScreen() {
  const navigation = useNavigation();
  const { company } = useAuth();
  const { colors, type } = useTheme();
  const { draft, patch, clear } = useFlowDraft();
  const { sites } = useCompanySites();
  const { phase, submit } = useSubmit();
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const site = sites.find((item) => item.id === draft.siteId);
  const siteAddress = site && (site.fullAddress || [site.address, site.city, site.state].filter(Boolean).join(', '));
  const companyName = company && (company.companyName || company.name);
  const gstNumber = company && (company.gstNumber || company.gst);

  async function confirmBooking() {
    setError('');
    setErrors({});
    if (!draft.siteId) {
      setError('Choose a site before confirming the booking.');
      return;
    }
    const registeredSiteId = draft.deviceSiteId || draft.siteId;
    if (draft.deviceId && registeredSiteId !== draft.siteId) {
      setError('The selected site must match the registered device site.');
      return;
    }

    const newDeviceValues = {
      ...draft,
      siteId: draft.siteId,
      installationLocation: draft.installationLocation || siteLabel(sites, draft.siteId),
    };
    if (!draft.deviceId) {
      const deviceErrors = validateDevice(newDeviceValues);
      if (deviceErrors) {
        setErrors(deviceErrors);
        setError('Complete the required device information before confirming.');
        return;
      }
    }

    const baseValues = {
      ...draft,
      siteId: draft.siteId,
      priority: draft.priority || 'normal',
      issueDescription: draft.issueDescription || draft.faultDescription || '',
      symptoms: draft.symptoms || (draft.selectedFaultTags || []).join(', ') || draft.faultDescription || '',
      faultInformation: draft.faultInformation || draft.faultDescription || draft.issueDescription || '',
    };

    const { result, error: submitError } = await submit(async () => {
      let deviceId = draft.deviceId;
      let deviceSiteId = registeredSiteId;
      if (!deviceId) {
        const deviceResult = await customerApi.createDevice(buildDevice(newDeviceValues));
        if (!deviceResult || !deviceResult.device || !deviceResult.device.id) {
          throw new Error('The service did not save this device.');
        }
        deviceId = deviceResult.device.id;
        deviceSiteId = deviceResult.device.siteId;
        patch({
          deviceId,
          deviceSiteId,
          siteId: deviceSiteId || draft.siteId,
          installationLocation: deviceResult.device.installationLocation || newDeviceValues.installationLocation,
        });
      }

      const values = { ...baseValues, deviceId, siteId: deviceSiteId || draft.siteId };
      const ticketErrors = validateRepairIssue(values);
      if (ticketErrors) {
        setErrors(ticketErrors);
        throw new Error('Complete the required repair details before confirming.');
      }
      const attachmentIds = await uploadPendingAttachments(values, patch);
      return customerApi.createTicket(buildRepair({ ...values, attachmentIds }));
    });

    if (submitError) {
      setError(getErrorMessage(submitError));
      return;
    }
    if (!submittedTicket(result)) {
      setError('The service did not confirm this repair booking.');
      return;
    }
    const ticket = result.ticket;
    const confirmation = result.confirmation;
    const bookingSummary = {
      service: `${draft.repairDeviceLabel || 'Repair'} Repair — ${draft.manufacturer || ''} (${draft.repairScopeLabel || 'Service scope'})`,
      site: siteLabel(sites, draft.siteId),
      address: siteAddress || '',
      company: company && (company.companyName || company.name) || '',
      gst: company && (company.gstNumber || company.gst) || '',
      preferredDate: draft.preferredDate || '',
      preferredTime: draft.preferredTime || '',
      recommendedRepairFlow: Boolean(draft.recommendedRepairFlow),
    };
    clear();
    navigation.navigate('RepairTicket', { ticket, confirmation, bookingConfirmed: true, bookingSummary });
  }

  return (
    <FlowScreen
      title="Confirm Booking"
      steps={draft.recommendedRepairFlow
        ? ['Recommendation', 'Service Scope', 'Issue Details', 'Select Site', 'Confirm Booking']
        : REPAIR_STEPS}
      step={draft.recommendedRepairFlow ? 4 : 8}
      onBack={() => navigation.goBack()}
      error={error}
      footer={(
        <Button
          title="✓ Confirm Booking"
          loading={phase === 'submitting'}
          onPress={confirmBooking}
        />
      )}
    >
      <Text style={type.heading}>📋 Booking Summary</Text>
      <Card style={styles.summary}>
        <Facts rows={[
          { label: 'Service', value: `${draft.repairDeviceLabel || 'Repair'} Repair` },
          { label: 'Manufacturer', value: draft.manufacturer },
          { label: 'Model', value: draft.model },
          { label: 'Serial number', value: draft.serialNumber },
          { label: 'Site', value: siteLabel(sites, draft.siteId) },
          { label: 'Installation location', value: draft.installationLocation },
          { label: 'Pickup / drop-off address', value: siteAddress || REPAIR_WORKSHOP_ADDRESS },
          { label: 'Service scope', value: draft.repairScopeLabel },
          { label: 'Logistics', value: draft.repairLogisticsLabel || 'Full Service' },
          { label: 'Preferred date', value: draft.preferredDate },
          { label: 'Preferred time', value: draft.preferredTime },
          { label: 'Company', value: companyName },
          { label: 'GSTIN', value: gstNumber },
        ]} />
      </Card>

      <Card style={[styles.nextSteps, { backgroundColor: colors.primaryLight, borderColor: colors.primarySoft }]}>
        <Text style={[type.heading, { color: colors.primary }]}>Next steps</Text>
        <Text style={[type.small, { color: colors.text }]}>
          After confirmation, follow the repair status and specialist assignment from Track Specialist.
        </Text>
      </Card>
      {errors.siteId ? <Text style={[type.body, { color: colors.danger }]}>{errors.siteId}</Text> : null}
      {errors.deviceType ? <Text style={[type.body, { color: colors.danger }]}>{errors.deviceType}</Text> : null}
      {errors.manufacturer ? <Text style={[type.body, { color: colors.danger }]}>{errors.manufacturer}</Text> : null}
      {errors.installationLocation ? <Text style={[type.body, { color: colors.danger }]}>{errors.installationLocation}</Text> : null}
      <Text style={[type.small, styles.terms, { color: colors.textSecondary }]}>
        By confirming you agree to Gravity Hub's terms & repair policy
      </Text>
    </FlowScreen>
  );
}

const styles = {
  summary: {
    gap: 4,
  },
  nextSteps: {
    gap: 6,
    borderWidth: 1,
  },
  terms: {
    textAlign: 'center',
  },
};
