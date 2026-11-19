import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export function Skeleton({ height = 14, width = '100%', radius = 8 }) {
  const { colors, reduceMotion } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(0.7);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduceMotion]);

  return (
    <Animated.View
      accessibilityLabel="Loading"
      style={[
        styles.block,
        {
          height,
          width,
          borderRadius: radius,
          backgroundColor: colors.skeleton,
          opacity,
        },
      ]}
    />
  );
}

export function SkeletonStack({ rows = 3 }) {
  return (
    <View style={styles.stack}>
      {Array.from({ length: rows }, (_item, index) => (
        <Skeleton key={index} height={index === 0 ? 24 : 14} width={index === rows - 1 ? '70%' : '100%'} />
      ))}
    </View>
  );
}

export function SkeletonCard() {
  const { colors, radius } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
      <View style={styles.row}>
        <Skeleton height={40} width={40} radius={10} />
        <View style={styles.copy}>
          <Skeleton height={14} width="55%" />
          <Skeleton height={12} width="80%" />
        </View>
      </View>
    </View>
  );
}

export function SkeletonList({ rows = 4 }) {
  return (
    <View style={styles.stack}>
      {Array.from({ length: rows }, (_item, index) => <SkeletonCard key={index} />)}
    </View>
  );
}

export function SkeletonDashboard() {
  return (
    <View style={styles.stack}>
      <Skeleton height={18} width="40%" />
      <Skeleton height={28} width="60%" />
      <View style={styles.metrics}>
        <View style={styles.metric}><Skeleton height={72} /></View>
        <View style={styles.metric}><Skeleton height={72} /></View>
        <View style={styles.metric}><Skeleton height={72} /></View>
        <View style={styles.metric}><Skeleton height={72} /></View>
      </View>
      <SkeletonList rows={3} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {},
  stack: {
    gap: 12,
  },
  card: {
    borderWidth: 1,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 8,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metric: {
    width: '47%',
    flexGrow: 1,
  },
});
