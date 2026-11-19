import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export function FadeIn({ children, style, delay = 0 }) {
  const { reduceMotion } = useTheme();
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const offset = useRef(new Animated.Value(reduceMotion ? 0 : 8)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      offset.setValue(0);
      return undefined;
    }
    const animation = Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(offset, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [delay, offset, opacity, reduceMotion]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY: offset }] }, style]}>
      {children}
    </Animated.View>
  );
}
