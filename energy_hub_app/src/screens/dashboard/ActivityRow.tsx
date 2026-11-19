import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { registerThemeStyles, theme } from '../../components/theme';

interface ActivityRowProps {
  /** Title of the activity */
  title: string;
  /** Sub-title, e.g. job type or category */
  subtitle?: string;
  /** Time/date elapsed, e.g. '2 hours ago' */
  time: string;
  /** Optional avatar initial / short label */
  avatar?: string;
  /** Optional status label */
  status?: string;
  /** Status color key for the left dot */
  statusColor?: keyof typeof theme.colors;
  /** Optional press handler */
  onPress?: () => void;
}

export const ActivityRow: React.FC<ActivityRowProps> = ({
  title,
  subtitle,
  time,
  avatar,
  status,
  statusColor,
  onPress,
}) => {
  useUserPreferences();

  return (
    <TouchableOpacity
      style={[styles.container, onPress && styles.pressable]}
      onPress={onPress}
      activeOpacity={theme.interaction.pressedOpacity}
      accessibilityRole="button"
    >
      <View style={[styles.avatar, statusColor && { backgroundColor: theme.colors[statusColor] + '20' }]}>
        {avatar ? (
          <Text style={[styles.avatarText, statusColor && { color: theme.colors[statusColor] }]}>
            {avatar}
          </Text>
        ) : (
          <View style={styles.dot}>
            <View style={[styles.dotInner, statusColor && { backgroundColor: theme.colors[statusColor] }]} />
          </View>
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {status && (
            <View style={[styles.statusBadge, { backgroundColor: theme.colors[statusColor] + '18' }]}>
              <Text style={[styles.statusText, { color: theme.colors[statusColor] }]}>{status}</Text>
            </View>
          )}
        </View>
        {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        <Text style={styles.time}>{time}</Text>
      </View>
      <View style={styles.trailing}>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
};

const build_styles = () => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.quietLine,
  },
  pressable: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.borderRadius.md,
  },
  avatar: {
    width: theme.responsive.compact === 375 ? 32 : 40,
    height: theme.responsive.compact === 375 ? 32 : 40,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800' as const,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  title: {
    color: theme.colors.mainText,
    fontSize: theme.typography.bodyMedium.fontSize,
    fontWeight: theme.typography.bodyMedium.fontWeight,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.pill,
  },
  statusText: {
    fontSize: theme.typography.captionSmall.fontSize,
    fontWeight: theme.typography.captionSmall.fontWeight,
  },
  subtitle: {
    color: theme.colors.secondaryText,
    fontSize: theme.typography.captionMedium.fontSize,
    marginTop: 2,
  },
  time: {
    color: theme.colors.tertiary,
    fontSize: theme.typography.captionSmall.fontSize,
  },
  trailing: {
    alignItems: 'flex-end',
  },
  chevron: {
    color: theme.colors.secondaryText,
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });

