import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { registerThemeStyles, theme } from '../../components/theme';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';

interface KpiCardProps {
  /** Short label, e.g. 'Active' */
  label: string;
  /** Numeric or text value, e.g. '12' or '$340.00' */
  value: string;
  /** Accent color for the icon badge, e.g. 'primary', 'success', 'error' */
  accent: keyof typeof theme.colors;
  /** Ionicon displayed inside the colored badge */
  glyph: React.ComponentProps<typeof Ionicons>['name'];
  /** Optional press handler */
  onPress?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  accent,
  glyph,
  onPress,
}) => {
  const { colors } = useUserPreferences();
  const accentColor = accent === 'accent' ? colors.primary : theme.colors[accent];
  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }, onPress && styles.pressable]}
      onPress={onPress}
      activeOpacity={theme.interaction.pressedOpacity}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={[styles.badge, { backgroundColor: accentColor }]}>
        <Ionicons name={glyph} size={14} color="#FFFFFF" />
      </View>
      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.secondaryText }]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>{value}</Text>
      </View>
    </TouchableOpacity>
  );
};

const build_styles = () => StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 0,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    paddingHorizontal: 4,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: theme.colors.brandLine,
    gap: 3,
  },
  pressable: {
    elevation: 2,
  },
  badge: {
    width: 23,
    height: 23,
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  label: {
    color: theme.colors.secondaryText,
    fontSize: 9,
    textAlign: 'center',
    fontWeight: theme.typography.captionLarge.fontWeight,
    letterSpacing: 0.5,
  },
  value: {
    color: theme.colors.mainText,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: theme.typography.titleLarge.fontWeight,
    lineHeight: 20,
    marginTop: 2,
  },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
