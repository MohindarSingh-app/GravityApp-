import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Glyph } from '../Glyph';

export function cardChrome(colors, radius, accentTone) {
  return {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: 16,
    minHeight: 72,
    overflow: 'hidden',
    ...(accentTone ? { borderTopWidth: 3, borderTopColor: accentTone } : {}),
  };
}

export function Card({ children, onPress, accessibilityLabel, style, footer }) {
  const { colors, radius } = useTheme();
  const face = (
    <View style={[cardChrome(colors, radius), style]}>
      {children}
      {footer ? (
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {footer}
        </View>
      ) : null}
    </View>
  );

  if (!onPress) return face;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {face}
    </Pressable>
  );
}

export function ExpandableCard({
  title,
  subtitle,
  glyph = 'jobs',
  children,
}) {
  const { colors, radius, type, reduceMotion, motion } = useTheme();
  const [open, setOpen] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!open) return undefined;
    opacity.setValue(reduceMotion ? 1 : 0);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: reduceMotion ? 0 : motion.expand,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [motion.expand, opacity, open, reduceMotion]);

  return (
    <View style={cardChrome(colors, radius)}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={() => setOpen((current) => !current)}
        style={styles.expandHead}
      >
        <View style={[styles.icon, { backgroundColor: colors.primaryLight, borderRadius: radius.button }]}>
          <Glyph name={glyph} color={colors.primary} size={20} />
        </View>
        <View style={styles.copy}>
          <Text style={type.heading}>{title}</Text>
          {subtitle ? <Text style={type.small}>{subtitle}</Text> : null}
        </View>
        <Glyph name={open ? 'chevronUp' : 'chevron'} color={colors.textTertiary} size={18} />
      </Pressable>
      {open ? (
        <Animated.View style={[styles.expandBody, { opacity, borderTopColor: colors.border }]}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  pressed: {
    opacity: 0.92,
  },
  expandHead: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  expandBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
});
