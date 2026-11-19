import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

/* Animated atom mark for Gravity Hub — RN port of the HTML/CSS loader:
 * four elliptical rings rotate as one object for 12s/turn. */

const RINGS = [
  { key: 'yellow', color: '#ffdc00', transform: [{ scaleX: 0.28 }] },
  { key: 'green', color: '#00a83b', transform: [{ scaleY: 0.28 }] },
  { key: 'blue', color: '#1745ed', transform: [{ rotate: '45deg' }, { scaleX: 0.35 }] },
  { key: 'red', color: '#f31322', transform: [{ rotate: '-45deg' }, { scaleX: 0.35 }] },
];

function Ring({ color, size, borderWidth, transform }) {
  const glow = Platform.OS === 'ios'
    ? {
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 5,
      }
    : null;

  return (
    <View
      style={[
        styles.ring,
        glow,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth,
          borderColor: color,
          transform,
        },
      ]}
    />
  );
}

export function AtomLoader({ showText = true, duration = 12000 }) {
  const { width } = useWindowDimensions();
  const spin = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) setReduceMotion(Boolean(enabled));
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      spin.setValue(0);
      return undefined;
    }
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [duration, reduceMotion, spin]);

  /* Matches the HTML layout: >=600px row (190px atom), below that column (160px). */
  const compact = width <= 600;
  const atomSize = compact ? 160 : 190;
  const ringBorder = Math.max(4, Math.round((atomSize / 190) * 7));
  const gravitySize = compact ? 34 : Math.round(Math.min(70, Math.max(30, width * 0.05)));
  const hubSize = compact ? 58 : Math.round(Math.min(105, Math.max(55, width * 0.08)));

  const rotate = useMemo(
    () => spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
    [spin],
  );

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading Gravity Hub"
      style={[styles.logo, compact && styles.logoCompact]}
    >
      <Animated.View
        style={[styles.atom, { width: atomSize, height: atomSize, transform: [{ rotate }] }]}
      >
        {RINGS.map((ring) => (
          <Ring
            key={ring.key}
            color={ring.color}
            size={atomSize}
            borderWidth={ringBorder}
            transform={ring.transform}
          />
        ))}
      </Animated.View>
      {showText ? (
        <View style={[styles.text, compact && styles.textCompact]}>
          <Text style={[styles.gravity, { fontSize: gravitySize }]}>GRAVITY</Text>
          <Text style={[styles.hub, { fontSize: hubSize }]}>HUB</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    padding: 20,
  },
  logoCompact: {
    flexDirection: 'column',
    gap: 18,
  },
  atom: {
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'transparent',
  },
  text: {
    flexDirection: 'column',
  },
  textCompact: {
    alignItems: 'center',
  },
  gravity: {
    color: '#050505',
    fontWeight: '400',
    letterSpacing: 4,
  },
  hub: {
    color: '#009b3a',
    fontWeight: '800',
    letterSpacing: 5,
  },
});


