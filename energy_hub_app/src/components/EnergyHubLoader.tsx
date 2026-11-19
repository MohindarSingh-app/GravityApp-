import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';

const RINGS: { color: string; transform: ViewStyle['transform'] }[] = [
  { color: '#ffdc00', transform: [{ scaleX: 0.28 }] },
  { color: '#00a83b', transform: [{ scaleY: 0.28 }] },
  { color: '#1745ed', transform: [{ rotate: '45deg' }, { scaleX: 0.35 }] },
  { color: '#f31322', transform: [{ rotate: '-45deg' }, { scaleX: 0.35 }] },
];

const SIZE = 120;

export const EnergyHubLoader: React.FC = () => {
  const spin = useRef(new Animated.Value(0)).current;
  const rotate = useMemo(
    () => spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
    [spin],
  );

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 12000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [spin]);

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading EnergyHub"
      style={[styles.atom, { transform: [{ rotate }] }]}
    >
      {RINGS.map((ring) => (
        <View
          key={ring.color}
          style={[
            styles.ring,
            { borderColor: ring.color, transform: ring.transform },
          ]}
        />
      ))}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  atom: {
    width: SIZE,
    height: SIZE,
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SIZE,
    height: SIZE,
    borderWidth: 5,
    borderRadius: SIZE / 2,
    backgroundColor: 'transparent',
  },
});
