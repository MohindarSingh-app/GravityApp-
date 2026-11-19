import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnergyHubLoader } from '../../components/EnergyHubLoader';
import { useAuth } from '../../providers/AuthProvider';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';

export const SplashScreen: React.FC = () => {
  useUserPreferences();
  const { isLoading } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {isLoading ? <EnergyHubLoader /> : null}
        <Image
          accessibilityLabel="Gravity Hub logo"
          resizeMode="contain"
          source={require('../../assets/logo.png')}
          style={styles.logo}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
  },
  logo: {
    width: '82%',
    maxWidth: 310,
    aspectRatio: 1882 / 836,
  },
});
