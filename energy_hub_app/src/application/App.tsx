import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { AuthProvider } from '../providers/AuthProvider';
import { RegistrationProvider } from '../providers/RegistrationProvider';
import { UserPreferencesProvider, useUserPreferences } from '../providers/UserPreferencesProvider';
import { RootNavigator } from '../navigation/RootNavigator';

const AppStatusBar: React.FC = () => {
  const { appearance } = useUserPreferences();
  return <StatusBar barStyle={appearance === 'dark' ? 'light-content' : 'dark-content'} />;
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RegistrationProvider>
          <UserPreferencesProvider>
            <AppStatusBar />
            <RootNavigator />
          </UserPreferencesProvider>
        </RegistrationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}