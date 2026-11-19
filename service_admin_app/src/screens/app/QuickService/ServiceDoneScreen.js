import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Facts } from '../../../components/Facts';
import { FlowScreen } from '../../../components/FlowScreen';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';

const ACTION_ROUTES = {
  repair_center: 'RepairCenter',
};

function whenLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

function acceptedRequest(request, confirmation) {
  return Boolean(
    request
    && confirmation
    && request.requestNumber
    && confirmation.requestNumber === request.requestNumber
    && confirmation.serviceRequestId === request.id,
  );
}

export function ServiceDoneScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { type } = useTheme();
  const initial = route.params && route.params.serviceRequest;
  const confirmation = route.params && route.params.confirmation;
  const [request, setRequest] = useState(initial);
  const [error, setError] = useState('');
  const ok = acceptedRequest(request, confirmation);

  const refresh = useCallback(async () => {
    if (!ok || !request || !request.id) return;
    try {
      const data = await customerApi.serviceRequest(request.id);
      if (data && data.serviceRequest && data.serviceRequest.requestNumber) {
        setRequest(data.serviceRequest);
        setError('');
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [ok, request]);

  useFocusEffect(useCallback(() => {
    if (!ok || !request || request.status !== 'searching') return undefined;
    const timer = setInterval(refresh, 12000);
    return () => clearInterval(timer);
  }, [ok, refresh, request]));

  function dashboard() {
    const parent = navigation.getParent();
    if (parent) parent.navigate('Dashboard');
    else navigation.navigate('Dashboard');
  }

  if (!ok) {
    return (
      <FlowScreen title="Done" onBack={dashboard}>
        <EmptyState
          title="Request was not submitted"
          message="This screen opens after the service accepts the request."
          action={<Button title="Back to dashboard" variant="secondary" onPress={dashboard} />}
        />
      </FlowScreen>
    );
  }

  const service = [request.categoryName]
    .concat((request.selections || []).map((item) => item.optionName))
    .filter(Boolean)
    .join(' · ');
  const address = [request.siteAddress, request.siteCity].filter(Boolean).join(', ');
  const actionRoute = request.nextAction ? ACTION_ROUTES[request.nextAction] : '';

  return (
    <FlowScreen
      title="Done"
      steps={['Category', 'Service', 'Site', 'Review', 'Done']}
      step={4}
      onBack={dashboard}
      error={error}
      onRefresh={refresh}
      footer={(
        <View style={{ gap: 8 }}>
          {actionRoute && request.nextActionLabel ? (
            <Button
              title={request.nextActionLabel}
              variant="secondary"
              onPress={() => {
                const parent = navigation.getParent();
                if (parent) parent.navigate(actionRoute);
              }}
            />
          ) : null}
          <Button title="Back to dashboard" onPress={dashboard} />
        </View>
      )}
    >
      <Text style={type.display} accessibilityRole="header">Request submitted</Text>
      <Text style={type.muted}>
        {request.statusLabel || request.status}
        {request.status === 'searching' ? ' A specialist is shown here after the service assigns one.' : ''}
      </Text>
      <StatusBadge label={request.statusLabel || request.status} status={request.status} />
      <Facts
        rows={[
          { label: 'Request number', value: request.requestNumber },
          { label: 'Status', value: request.statusLabel || request.status },
          { label: 'Service', value: service },
          { label: 'Site', value: request.siteName },
          { label: 'Address', value: address },
          { label: 'Site type', value: request.siteType },
          { label: 'Company', value: request.companyName },
          { label: 'Specialist', value: request.assignedEngineerName },
          { label: 'Submitted', value: whenLabel(request.submittedAt) },
          { label: 'Next step', value: !actionRoute ? request.nextActionLabel : '' },
        ]}
      />
      {(request.answers || []).length ? (
        <Facts
          rows={request.answers.map((answer) => ({
            label: answer.label,
            value: answer.displayValue,
          }))}
        />
      ) : null}
    </FlowScreen>
  );
}
