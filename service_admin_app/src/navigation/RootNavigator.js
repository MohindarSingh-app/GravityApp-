import { NavigationContainer } from '@react-navigation/native';
import { isOnboardingComplete, onboardingRouteForStatus } from '../constants/onboarding';
import { useAuth } from '../hooks/useAuth';
import { SplashScreen } from '../screens/Splash/SplashScreen';
import { AppNavigator } from './AppNavigator';
import { AuthNavigator } from './AuthNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { useNavigationTheme } from './options';

export function RootNavigator() {
  const {
    status, bootError, retry, onboardingStatus, celebrate, postAuthRoute,
    newCompanyRegistration,
  } = useAuth();
  const navigationTheme = useNavigationTheme();

  if (status === 'loading') {
    return <SplashScreen />;
  }

  if (status === 'offline') {
    return <SplashScreen message={bootError} onRetry={retry} />;
  }

  const complete = isOnboardingComplete(onboardingStatus);
  const showOnboarding = status === 'authenticated'
    && (!complete || celebrate || newCompanyRegistration);
  const initialRoute = newCompanyRegistration
    ? 'CompanyDetails'
    : celebrate
    ? 'OnboardingComplete'
    : onboardingRouteForStatus(onboardingStatus);

  return (
    <NavigationContainer theme={navigationTheme}>
      {status !== 'authenticated' ? <AuthNavigator /> : null}
      {showOnboarding ? <OnboardingNavigator initialRoute={initialRoute} /> : null}
      {status === 'authenticated' && !showOnboarding ? <AppNavigator initialRouteName={postAuthRoute || 'Dashboard'} /> : null}
    </NavigationContainer>
  );
}
