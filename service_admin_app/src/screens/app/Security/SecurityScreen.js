import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { DepthCard } from '../../../components/DepthCard';
import { Screen } from '../../../components/Screen';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';

export function SecurityScreen() {
  const navigation = useNavigation();
  const { user, logoutAll } = useAuth();
  const { type } = useTheme();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');

  async function run(action, work) {
    setLoading(action);
    setError('');
    try {
      await work();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading('');
    }
  }

  return (
    <Screen header={<AppBar title="Security" onBack={() => navigation.goBack()} />}>
      <Text style={type.display} accessibilityRole="header">Security</Text>
      <Text style={type.muted}>
        This account signs in with a one-time code. Password sign-in is off.
      </Text>
      <DepthCard
        tone="amc"
        glyph="device"
        kicker="This device"
        title={user ? user.phone || user.email || 'Email or phone OTP' : 'Email or phone OTP'}
        detail="End every signed-in device from here. Use Logout on Profile for this phone."
      />
      <Banner message={error} />
      <View style={styles.gap}>
        <Button title="Sign out of all devices" variant="danger" loading={loading === 'logoutAll'} onPress={() => run('logoutAll', logoutAll)} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: {
    gap: 12,
  },
});
