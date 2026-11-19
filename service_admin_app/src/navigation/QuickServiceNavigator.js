import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { FlowDraftProvider } from '../flows/FlowDraft';
import { ServiceCategoryScreen } from '../screens/app/QuickService/ServiceCategoryScreen';
import { ServiceDoneScreen } from '../screens/app/QuickService/ServiceDoneScreen';
import { ServiceReviewScreen } from '../screens/app/QuickService/ServiceReviewScreen';
import { ServiceSiteScreen } from '../screens/app/QuickService/ServiceSiteScreen';
import { ServiceStepScreen } from '../screens/app/QuickService/ServiceStepScreen';
import { useStackScreenOptions } from './options';

const Stack = createNativeStackNavigator();

export function QuickServiceNavigator() {
  const screenOptions = useStackScreenOptions();
  return (
    <FlowDraftProvider>
      <Stack.Navigator initialRouteName="ServiceCategory" screenOptions={screenOptions}>
        <Stack.Screen name="ServiceCategory" component={ServiceCategoryScreen} />
        <Stack.Screen name="ServiceStep" component={ServiceStepScreen} />
        <Stack.Screen name="ServiceSite" component={ServiceSiteScreen} />
        <Stack.Screen name="ServiceReview" component={ServiceReviewScreen} />
        <Stack.Screen name="ServiceDone" component={ServiceDoneScreen} />
      </Stack.Navigator>
    </FlowDraftProvider>
  );
}
