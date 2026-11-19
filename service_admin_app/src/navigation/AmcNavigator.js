import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FlowDraftProvider } from '../flows/FlowDraft';
import { AmcConfirmationScreen } from '../screens/app/Amc/AmcConfirmationScreen';
import { AmcContractScreen } from '../screens/app/Amc/AmcContractScreen';
import { AmcListScreen } from '../screens/app/Amc/AmcListScreen';
import { AmcRequestScreen } from '../screens/app/Amc/AmcRequestScreen';
import { AmcRescheduleScreen } from '../screens/app/Amc/AmcRescheduleScreen';
import { useStackScreenOptions } from './options';

const Stack = createNativeStackNavigator();

export function AmcNavigator() {
  const screenOptions = useStackScreenOptions();
  return (
    <FlowDraftProvider>
      <Stack.Navigator initialRouteName="AmcList" screenOptions={screenOptions}>
        <Stack.Screen name="AmcList" component={AmcListScreen} />
        <Stack.Screen name="AmcContract" component={AmcContractScreen} />
        <Stack.Screen name="AmcRequest" component={AmcRequestScreen} />
        <Stack.Screen name="AmcReschedule" component={AmcRescheduleScreen} />
        <Stack.Screen name="AmcConfirmation" component={AmcConfirmationScreen} />
      </Stack.Navigator>
    </FlowDraftProvider>
  );
}
