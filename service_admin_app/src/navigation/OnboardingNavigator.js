import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CompanyDetailsScreen } from '../screens/onboarding/CompanyDetailsScreen';
import { OnboardingCompleteScreen } from '../screens/onboarding/OnboardingCompleteScreen';
import { ProfileScreen } from '../screens/onboarding/ProfileScreen';
import { SitesScreen } from '../screens/onboarding/SitesScreen';
import { useStackScreenOptions } from './options';

const Stack = createNativeStackNavigator();

export function OnboardingNavigator({ initialRoute = 'CompanyDetails' }) {
  const screenOptions = useStackScreenOptions();
  return (
    <Stack.Navigator initialRouteName={initialRoute} screenOptions={screenOptions}>
      <Stack.Screen name="CompanyDetails" component={CompanyDetailsScreen} />
      <Stack.Screen name="Sites" component={SitesScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="OnboardingComplete" component={OnboardingCompleteScreen} />
    </Stack.Navigator>
  );
}
