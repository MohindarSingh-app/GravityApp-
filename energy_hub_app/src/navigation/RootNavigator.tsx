import React from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useAuth } from '../providers/AuthProvider';
import { SplashScreen } from '../screens/splash/SplashScreen';
import { RoleBasedDashboard } from '../screens/dashboard/RoleBasedDashboard';
import { GetStartedScreen } from '../screens/auth/GetStartedScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { OtpScreen } from '../screens/auth/OtpScreen';
import { RoleSelectScreen } from '../screens/auth/RoleSelectScreen';
import { UserRole } from '../types';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { RegistrationFlowScreen } from '../screens/registration/RegistrationFlowScreen';
import { StatusScreen } from '../screens/dashboard/StatusScreen';
import { JobsScreen } from '../screens/marketplace/JobsScreen';
import { HelpSupportScreen } from '../screens/marketplace/HelpSupportScreen';
import { JobDetailScreen } from '../screens/marketplace/JobDetailScreen';
import { MaskedCallScreen } from '../screens/marketplace/MaskedCallScreen';
import { DeliveryScreen } from '../screens/marketplace/DeliveryScreen';
import { IncomingHardwareScreen } from '../screens/marketplace/IncomingHardwareScreen';
import { WorkshopJobDetailScreen } from '../screens/marketplace/WorkshopJobDetailScreen';
import { SupplierCatalogScreen } from '../screens/marketplace/SupplierCatalogScreen';
import { ScheduleScreen } from '../screens/marketplace/ScheduleScreen';
import { PartnerProfileScreen } from '../screens/marketplace/PartnerProfileScreen';
import { EarningsScreen } from '../screens/marketplace/EarningsScreen';
import { SpecializationsScreen } from '../screens/marketplace/SpecializationsScreen';
import { JobCompletedScreen } from '../screens/marketplace/JobCompletedScreen';
import { WorkshopScreen } from '../screens/marketplace/PartnerScreens';
import { NotificationsScreen } from '../screens/marketplace/NotificationsScreen';
import { SupplierProductFormScreen } from '../screens/marketplace/SupplierProductFormScreen';
import { AdminScheduleScreen } from '../screens/marketplace/AdminScheduleScreen';
import type { SupplierProduct } from '../screens/marketplace/SupplierProductFormScreen';
import { theme } from '../components/theme';
import { PartnerNavigationBar } from './PartnerNavigationBar';
import { useUserPreferences } from '../providers/UserPreferencesProvider';

export type RootStackParamList = {
  Splash: undefined;
  Home: undefined;
  GetStarted: undefined;
  Login: undefined;
  Otp: { mobile: string; purpose: 'login' | 'registration'; devOtp?: string };
  RoleSelect: { mobile: string; roleSelectionToken: string; roles: Array<{ userId: number; role: UserRole; status: string; registrationId?: number | null }> };
  Register: undefined;
  PersonalInfo: { registrationId: string; mobile: string; email: string; partnerRole?: UserRole } | undefined;
  Status: undefined;
  Jobs: { mode?: 'open' | 'mine' | 'delivery' } | undefined;
  JobDetail: { jobId: number; job?: any };
  MaskedCall: { jobId: number; job?: any };
  Delivery: { jobId: number; job?: any };
  SupplierCatalog: undefined;
  SupplierProductForm: { product?: SupplierProduct } | undefined;
  Earnings: undefined;
  Schedule: undefined;
  AdminSchedule: undefined;
  PartnerProfile: undefined;
  Notifications: undefined;
  HelpSupport: undefined;
  Specializations: undefined;
  JobCompleted: {
    jobId?: number;
    referenceId?: string;
    serviceCharge?: number;
    partsTotal?: number;
    totalBill?: number;
    payoutAmount?: number;
  };
  Workshop: { mode?: 'repair' | 'panel'; tab?: 'requests' | 'queue' } | undefined;
  IncomingHardware: undefined;
  WorkshopJobDetail: { jobId: number; mode: 'repair' | 'panel'; job?: any };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const AuthScreens = (
  <>
    <Stack.Screen name="GetStarted" component={GetStartedScreen} />
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Otp" component={OtpScreen} />
    <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </>
);

const AdminScreens = (
  <>
    <Stack.Screen name="AdminSchedule" component={AdminScheduleScreen} />
    <Stack.Screen name="PartnerProfile" component={PartnerProfileScreen} />
  </>
);

const AuthenticatedScreens = (
  <>
    <Stack.Screen name="Home" component={RoleBasedDashboard} />
    {/* Registration flow - always available so a partner can
        (re)start or resume onboarding from the dashboard. */}
    <Stack.Screen name="PersonalInfo" component={RegistrationFlowScreen} />
    {/* Post-registration screens */}
    <Stack.Screen name="Status" component={StatusScreen} />
    <Stack.Screen name="Jobs" component={JobsScreen} />
    <Stack.Screen name="JobDetail" component={JobDetailScreen} />
    <Stack.Screen name="MaskedCall" component={MaskedCallScreen} />
    <Stack.Screen name="Delivery" component={DeliveryScreen} />
    <Stack.Screen name="IncomingHardware" component={IncomingHardwareScreen} />
    <Stack.Screen name="WorkshopJobDetail" component={WorkshopJobDetailScreen} />
    <Stack.Screen name="SupplierCatalog" component={SupplierCatalogScreen} />
    <Stack.Screen name="SupplierProductForm" component={SupplierProductFormScreen} />
    <Stack.Screen name="Earnings" component={EarningsScreen} />
    <Stack.Screen name="Schedule" component={ScheduleScreen} />
    <Stack.Screen name="PartnerProfile" component={PartnerProfileScreen} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
    <Stack.Screen name="Specializations" component={SpecializationsScreen} />
    <Stack.Screen name="JobCompleted" component={JobCompletedScreen} />
    <Stack.Screen name="Workshop" component={WorkshopScreen} />
  </>
);

const TAB_BAR_HIDDEN_ROUTES = new Set([
  'Splash',
  'GetStarted',
  'Login',
  'Otp',
  'RoleSelect',
  'Register',
  'PersonalInfo',
  'Status',
  'JobDetail',
  'MaskedCall',
  'Delivery',
  'WorkshopJobDetail',
  'JobCompleted',
]);

export const RootNavigator: React.FC = () => {
  const { isLoading, isAuthenticated, user, previewRole } = useAuth();
  const activeRole = previewRole || user?.role;
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [currentRoute, setCurrentRoute] = React.useState<{ name: string; params?: object } | null>(null);
  const wasAuthenticated = React.useRef(isAuthenticated);
  const previousRole = React.useRef(activeRole);

  const updateCurrentRoute = () => {
    const route = navigationRef.getCurrentRoute();
    setCurrentRoute(route ? { name: route.name, params: route.params } : null);
  };

  const roleLandingRoute = () => {
    return { name: 'Home' as const };
  };

  React.useEffect(() => {
    if (isLoading || !isAuthenticated) {
      wasAuthenticated.current = isAuthenticated;
      return;
    }

    const shouldOpenAdmin = activeRole === 'admin';
    const currentIsAdmin = currentRoute?.name === 'AdminSchedule';
    const roleChanged = previousRole.current !== activeRole;
    if (navigationRef.isReady() && (!wasAuthenticated.current || roleChanged || currentIsAdmin !== shouldOpenAdmin)) {
      navigationRef.reset({
        index: 0,
        routes: [shouldOpenAdmin ? { name: 'AdminSchedule' } : roleLandingRoute()],
      });
      updateCurrentRoute();
    }

    wasAuthenticated.current = true;
    previousRole.current = activeRole;
  }, [isLoading, isAuthenticated, activeRole, currentRoute?.name]);

  const { appearance, colors } = useUserPreferences();
  const navigationTheme = {
    ...(appearance === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(appearance === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: colors.background,
      card: colors.surface,
      text: colors.mainText,
      border: colors.border,
      primary: colors.primary,
      notification: colors.accent,
    },
  };

  const onPressTab = (route: string, params?: Record<string, string>) => {
    switch (route) {
      case 'Jobs':
        navigationRef.navigate('Jobs', { mode: (params?.mode as 'open' | 'mine' | 'delivery') || 'open' });
        break;
      case 'Workshop':
        navigationRef.navigate('Workshop', {
          mode: params?.mode as 'repair' | 'panel',
          tab: params?.tab as 'requests' | 'queue',
        });
        break;
      case 'Schedule':
        navigationRef.navigate('Schedule');
        break;
      case 'AdminSchedule':
        navigationRef.navigate('AdminSchedule');
        break;
      case 'Earnings':
        navigationRef.navigate('Earnings');
        break;
      case 'PartnerProfile':
        navigationRef.navigate('PartnerProfile');
        break;
      case 'HelpSupport':
        navigationRef.navigate('HelpSupport');
        break;
      case 'Home':
        navigationRef.navigate('Home');
        break;
      case 'IncomingHardware':
        navigationRef.navigate('IncomingHardware');
        break;
      case 'SupplierCatalog':
        navigationRef.navigate('SupplierCatalog');
        break;
    }
  };

  const screenOptions: NativeStackNavigationOptions = {
    headerShown: false,
    contentStyle: { backgroundColor: colors.background },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme} onReady={updateCurrentRoute} onStateChange={updateCurrentRoute}>
      <React.Fragment>
        <Stack.Navigator id="RootStack" screenOptions={screenOptions}>
          {isLoading ? (
            <Stack.Screen name="Splash" component={SplashScreen} />
          ) : !isAuthenticated ? (
            AuthScreens
          ) : user?.role === 'admin' ? (
            AdminScreens
          ) : (
            AuthenticatedScreens
          )}
        </Stack.Navigator>
        {!isLoading && isAuthenticated && currentRoute && !TAB_BAR_HIDDEN_ROUTES.has(currentRoute.name) ? (
          <PartnerNavigationBar
            currentRouteName={currentRoute.name}
            currentRouteParams={currentRoute.params}
            role={activeRole}
            onPressTab={onPressTab}
          />
        ) : null}
      </React.Fragment>
    </NavigationContainer>
  );
};
