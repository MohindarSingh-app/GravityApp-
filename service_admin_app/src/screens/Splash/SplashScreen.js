import { StyleSheet, Text, View, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AtomLoader } from '../../components/AtomLoader';
import { Button } from '../../components/Button';

const LOGO = require('../../assets/logo.png');

/* Gravity Hub boot screen — shows the app logo (no background colour)
 * with an animated atom loader underneath.
 * NOTE: Splash renders BEFORE ThemeProvider in some boot paths,
 * so it must NOT call useTheme() — static colors only. */
export function SplashScreen({ message, onRetry }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: '#FFFFFF', paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.center}>
        <Image
          source={LOGO}
          style={[{ backgroundColor: 'transparent' }, styles.logo]}
          resizeMode="contain"
          accessibilityLabel="Gravity Hub logo"
        />
        <AtomLoader />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      {onRetry ? <Button title="Try again" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 18,
  },
  center: {
    alignItems: 'center',
    gap: 14,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 6,
  },
  message: {
    maxWidth: 320,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    color: '#525252',
  },
});