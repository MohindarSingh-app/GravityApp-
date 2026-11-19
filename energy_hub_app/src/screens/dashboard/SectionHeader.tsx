import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { registerThemeStyles, theme } from '../../components/theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  showActionChevron?: boolean;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  actionLabel,
  onAction,
  showActionChevron = true,
}) => {
  useUserPreferences();

  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.action}
          onPress={onAction}
          activeOpacity={theme.interaction.pressedOpacity}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
          {showActionChevron ? <Text style={styles.chevron}>›</Text> : null}
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const build_styles = () => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: theme.colors.mainText,
    fontSize: theme.typography.titleMedium.fontSize,
    fontWeight: theme.typography.titleMedium.fontWeight,
  },
  subtitle: {
    color: theme.colors.secondaryText,
    fontSize: theme.typography.captionMedium.fontSize,
    lineHeight: 18,
    marginTop: 2,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    color: theme.colors.primaryAction,
    fontSize: theme.typography.buttonSmall.fontSize,
    fontWeight: theme.typography.buttonSmall.fontWeight,
  },
  chevron: {
    color: theme.colors.secondaryText,
    fontSize: 14,
    marginLeft: 4,
  },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });

