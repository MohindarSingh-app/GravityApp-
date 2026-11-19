import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FlowDraftProvider } from '../flows/FlowDraft';
import { RepairBookingConfirmScreen } from '../screens/app/Repair/RepairBookingConfirmScreen';
import { RepairBookingSiteScreen } from '../screens/app/Repair/RepairBookingSiteScreen';
import { RepairDeviceScreen } from '../screens/app/Repair/RepairDeviceScreen';
import { RepairIssueScreen } from '../screens/app/Repair/RepairIssueScreen';
import { RepairDetailsScreen } from '../screens/app/Repair/RepairDetailsScreen';
import { RepairFaultScreen } from '../screens/app/Repair/RepairFaultScreen';
import { RepairLogisticsScreen } from '../screens/app/Repair/RepairLogisticsScreen';
import { RepairMakeScreen } from '../screens/app/Repair/RepairMakeScreen';
import { RepairRecommendationScreen } from '../screens/app/Repair/RepairRecommendationScreen';
import { RepairScopeScreen } from '../screens/app/Repair/RepairScopeScreen';
import { RepairTicketScreen } from '../screens/app/Repair/RepairTicketScreen';
import { RepairTrackingScreen } from '../screens/app/Repair/RepairTrackingScreen';
import { useStackScreenOptions } from './options';

const Stack = createNativeStackNavigator();

export function RepairNavigator() {
  const screenOptions = useStackScreenOptions();
  return (
    <FlowDraftProvider>
      <Stack.Navigator initialRouteName="RepairDevice" screenOptions={screenOptions}>
        <Stack.Screen name="RepairRecommendation" component={RepairRecommendationScreen} />
        <Stack.Screen name="RepairDevice" component={RepairDeviceScreen} />
        <Stack.Screen name="RepairMake" component={RepairMakeScreen} />
        <Stack.Screen name="RepairFault" component={RepairFaultScreen} />
        <Stack.Screen name="RepairDetails" component={RepairDetailsScreen} />
        <Stack.Screen name="RepairScope" component={RepairScopeScreen} />
        <Stack.Screen name="RepairLogistics" component={RepairLogisticsScreen} />
        <Stack.Screen name="RepairIssue" component={RepairIssueScreen} />
        <Stack.Screen name="RepairBookingSite" component={RepairBookingSiteScreen} />
        <Stack.Screen name="RepairBookingConfirm" component={RepairBookingConfirmScreen} />
        <Stack.Screen name="RepairTicket" component={RepairTicketScreen} />
        <Stack.Screen name="RepairTracking" component={RepairTrackingScreen} />
      </Stack.Navigator>
    </FlowDraftProvider>
  );
}
