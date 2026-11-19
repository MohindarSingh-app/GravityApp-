import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  accessibilityLabel,
  loadingLabel,
  pill = false,
}) {
  const { colors, radius, type } = useTheme();
  const isDisabled = disabled || loading;
  const label = loading ? (loadingLabel || title) : title;
  const filled = variant === 'primary'
    || variant === 'danger'
    || variant === 'success'
    || variant === 'accent';
  const labelColor = variant === 'danger'
    ? colors.onDanger
    : filled
      ? (variant === 'primary' || variant === 'accent' ? colors.textOnPrimary : colors.onAccent)
      : variant === 'outline' || variant === 'ghost'
        ? colors.primary
        : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { borderRadius: pill ? radius.pill : radius.button, minHeight: 54 },
        variant === 'primary' && {
          backgroundColor: pressed ? colors.primaryDark : colors.primary,
          borderColor: colors.primary,
          borderWidth: 1.5,
        },
        variant === 'secondary' && {
          backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
          borderWidth: 1.5,
          borderColor: colors.borderStrong,
        },
        variant === 'outline' && {
          backgroundColor: pressed ? colors.primaryLight : 'transparent',
          borderWidth: 1.5,
          borderColor: colors.primary,
        },
        variant === 'ghost' && {
          backgroundColor: pressed ? colors.primaryLight : 'transparent',
        },
        variant === 'accent' && {
          backgroundColor: pressed ? colors.orange : colors.orange,
          borderColor: colors.orange,
          borderWidth: 1.5,
        },
        variant === 'danger' && { backgroundColor: colors.dangerSolid, borderColor: colors.dangerSolid, borderWidth: 1.5 },
        variant === 'success' && { backgroundColor: colors.successSolid, borderColor: colors.successSolid, borderWidth: 1.5 },
        pressed && !isDisabled && (variant === 'danger' || variant === 'accent') && styles.pressedDanger,
        pressed && !isDisabled && styles.pressed,
        disabled && !loading && styles.disabled,
      ]}
    >
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={labelColor} />
          <Text style={[type.button, styles.label, { color: labelColor }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      ) : (
        <Text style={[type.button, styles.label, { color: labelColor }]} numberOfLines={1}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  label: {
    includeFontPadding: false,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  pressedDanger: {
    opacity: 0.9,
  },
  disabled: {
    opacity: 0.45,
  },
});
