import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { JobDetailScreen } from '../screens/app/Jobs/JobDetailScreen';
import { JobTrackingScreen } from '../screens/app/Jobs/JobTrackingScreen';
import { JobsScreen } from '../screens/app/Jobs/JobsScreen';
import { useStackScreenOptions } from './options';

const Stack = createNativeStackNavigator();

export function JobsNavigator() {
  const screenOptions = useStackScreenOptions();
  return (
    <Stack.Navigator initialRouteName="JobsList" screenOptions={screenOptions}>
      <Stack.Screen name="JobsList" component={JobsScreen} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} />
      <Stack.Screen name="JobTracking" component={JobTrackingScreen} />
    </Stack.Navigator>
  );
}
