import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppDock, APP_TABS } from '../components/AppDock';
import { APIKeysScreen } from '../screens/app/APIKeys/APIKeysScreen';
import { LicenseScreen } from '../screens/app/Legal/LicenseScreen';
import { TalkToExpertScreen } from '../screens/app/Support/TalkToExpertScreen';
import { HelpSupportScreen } from '../screens/app/Support/HelpSupportScreen';
import { NotificationsScreen } from '../screens/app/Notifications/NotificationsScreen';
import { AppearanceScreen } from '../screens/app/Appearance/AppearanceScreen';
import { DashboardScreen } from '../screens/app/Dashboard/DashboardScreen';
import { EmergencyScreen } from '../screens/app/Emergency/EmergencyScreen';
import { EmergencyConfirmationScreen } from '../screens/app/Emergency/EmergencyConfirmationScreen';
import { JobTrackingScreen } from '../screens/app/Jobs/JobTrackingScreen';
import { QuickServiceNavigator } from './QuickServiceNavigator';
import { AmcNavigator } from './AmcNavigator';
import { ProjectNavigator } from './ProjectNavigator';
import { RepairNavigator } from './RepairNavigator';
import { JobsNavigator } from './JobsNavigator';
import { MarketplaceNavigator } from './MarketplaceNavigator';
import { ComplianceScreen } from '../screens/app/Compliance/ComplianceScreen';
import { SecurityScreen } from '../screens/app/Security/SecurityScreen';
import { SessionsScreen } from '../screens/app/Sessions/SessionsScreen';
import { CompanyDetailsScreen } from '../screens/onboarding/CompanyDetailsScreen';
import { ProfileScreen } from '../screens/onboarding/ProfileScreen';
import { SitesScreen } from '../screens/onboarding/SitesScreen';
import { useStackScreenOptions } from './options';

const Stack = createNativeStackNavigator();

export function AppNavigator({ initialRouteName = 'Dashboard' }) {
  const insets = useSafeAreaInsets();
  const screenOptions = useStackScreenOptions();
  const [dockNavigation, setDockNavigation] = useState(null);
  const [activeRoute, setActiveRoute] = useState(initialRouteName);
  const activeTab = APP_TABS.some((tab) => tab.id === activeRoute)
    ? activeRoute
    : activeRoute.startsWith('Emergency')
      ? 'Emergency'
      : 'Dashboard';
  const dockScreenOptions = {
    ...screenOptions,
    contentStyle: {
      ...screenOptions.contentStyle,
      paddingBottom: 74 + insets.bottom,
    },
  };

  return (
    <View style={styles.root}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={dockScreenOptions}
        screenListeners={({ navigation, route }) => ({
          focus: () => {
            setDockNavigation(navigation);
            setActiveRoute(route.name);
          },
          state: () => {
            const state = navigation.getState();
            const current = state.routes[state.index];
            setDockNavigation(navigation);
            if (current) setActiveRoute(current.name);
          },
        })}
      >
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="Emergency" component={EmergencyScreen} />
        <Stack.Screen name="EmergencyConfirmation" component={EmergencyConfirmationScreen} />
        <Stack.Screen name="EmergencyTracking" component={JobTrackingScreen} />
        <Stack.Screen name="QuickServices" component={QuickServiceNavigator} />
        <Stack.Screen name="Jobs" component={JobsNavigator} />
        <Stack.Screen name="Amc" component={AmcNavigator} />
        <Stack.Screen name="Projects" component={ProjectNavigator} />
        <Stack.Screen name="Marketplace" component={MarketplaceNavigator} />
        <Stack.Screen name="Compliance" component={ComplianceScreen} />
        <Stack.Screen name="RepairCenter" component={RepairNavigator} />
        <Stack.Screen name="Expert" component={TalkToExpertScreen} />
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Company" component={CompanyDetailsScreen} />
        <Stack.Screen name="SitesList" component={SitesScreen} />
        <Stack.Screen name="ProfileSettings" component={ProfileScreen} />
        <Stack.Screen name="Security" component={SecurityScreen} />
        <Stack.Screen name="APIKeys" component={APIKeysScreen} />
        <Stack.Screen name="Sessions" component={SessionsScreen} />
        <Stack.Screen name="Appearance" component={AppearanceScreen} />
        <Stack.Screen name="License" component={LicenseScreen} />
      </Stack.Navigator>
      {dockNavigation ? (
        <View
          style={[
            styles.dock,
            { paddingBottom: insets.bottom },
          ]}
        >
          <AppDock
            active={activeTab}
            navigation={dockNavigation}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    paddingTop: 5,
  },
});
