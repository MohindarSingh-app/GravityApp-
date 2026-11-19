import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { BrandMark } from '../BrandMark';
import { Glyph } from '../Glyph';

export function Header({ title, onBack, actionLabel, onAction, right, tone = 'light' }) {
  const { colors, type } = useTheme();
  const light = tone === 'light';
  const fg = light ? colors.text : colors.onAccent;
  const bg = light ? colors.background : colors.primary;
  const border = light ? colors.border : colors.primaryDark;
  let action = <View style={styles.side} />;
  if (right) action = <View style={[styles.side, styles.end]}>{right}</View>;
  else if (onAction) {
    action = (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={onAction}
        hitSlop={8}
        style={[styles.side, styles.end]}
      >
        <Text style={[styles.action, { color: fg }]} numberOfLines={1}>{actionLabel}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.bar, { backgroundColor: bg, borderBottomColor: border }]}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={onBack}
          hitSlop={8}
          style={[styles.side, { backgroundColor: light ? colors.surface : 'rgba(255,255,255,0.18)', borderRadius: 16 }]}
        >
          <Glyph name="back" color={fg} size={22} />
        </Pressable>
      ) : <View style={styles.side} />}
      {title && title !== 'Gravity Hub' ? (
        <Text style={[type.heading, styles.title, { color: fg }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
      ) : (
        <View style={styles.mark}><BrandMark size="sm" /></View>
      )}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 56,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
    width: '100%',
  },
  side: {
    minWidth: 44,
    minHeight: 44,
    maxWidth: '34%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    flexShrink: 0,
  },
  end: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    flexShrink: 1,
    textAlign: 'left',
    fontSize: 18,
    lineHeight: 24,
  },
  mark: {
    flex: 1,
    alignItems: 'center',
  },
  action: {
    fontSize: 14,
    fontWeight: '700',
  },
});
