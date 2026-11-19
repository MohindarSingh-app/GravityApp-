import { Image, StyleSheet } from 'react-native';

/* App icon (atom mark only) — used in headers/auth chrome.
 * Full "GRAVITY HUB" lockup (logo.png) is only for the splash. */
const ICON = require('../assets/images/fave-ican.png');

export function BrandMark({ size = 'md' }) {
  const compact = size === 'sm';
  return (
    <Image
      source={ICON}
      accessibilityLabel="Gravity Hub"
      resizeMode="contain"
      style={[{ backgroundColor: 'transparent' }, compact ? styles.sm : styles.md]}
    />
  );
}

const styles = StyleSheet.create({
  md: {
    width: 52,
    height: 52,
  },
  sm: {
    width: 40,
    height: 40,
  },
});
