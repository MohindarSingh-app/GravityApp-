import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { NavGlyph, NavGlyphName } from '../components/NavGlyph';
import { registerThemeStyles, theme } from '../components/theme';
import { useUserPreferences } from '../providers/UserPreferencesProvider';

type PartnerTab = {
  label: string;
  icon: NavGlyphName;
  route: string;
  params?: Record<string, string>;
};

const profileTab: PartnerTab = { label: 'Profile', icon: 'profile', route: 'PartnerProfile' };

const tabsByRole: Record<string, PartnerTab[]> = {
  service_partner: [
    { label: 'Home', icon: 'home', route: 'Home' },
    { label: 'New Jobs', icon: 'jobs', route: 'Jobs', params: { mode: 'open' } },
    { label: 'Active', icon: 'active', route: 'Jobs', params: { mode: 'mine' } },
    { label: 'Earnings', icon: 'earnings', route: 'Earnings' },
    profileTab,
  ],
  repairing_partner: [
    { label: 'Home', icon: 'home', route: 'Home' },
    { label: 'New Jobs', icon: 'jobs', route: 'Workshop', params: { mode: 'repair', tab: 'requests' } },
    { label: 'Workshop', icon: 'workshop', route: 'Workshop', params: { mode: 'repair', tab: 'queue' } },
    { label: 'Incoming', icon: 'incoming', route: 'IncomingHardware' },
    { label: 'Earnings', icon: 'earnings', route: 'Earnings' },
    profileTab,
  ],
  panel_maker: [
    { label: 'Home', icon: 'home', route: 'Home' },
    { label: 'New Requests', icon: 'jobs', route: 'Workshop', params: { mode: 'panel', tab: 'requests' } },
    { label: 'Queue', icon: 'queue', route: 'Workshop', params: { mode: 'panel', tab: 'queue' } },
    { label: 'Earnings', icon: 'earnings', route: 'Earnings' },
    profileTab,
  ],
  supplier: [
    { label: 'Home', icon: 'home', route: 'Home' },
    { label: 'Catalog', icon: 'catalog', route: 'SupplierCatalog' },
    { label: 'Earnings', icon: 'earnings', route: 'Earnings' },
    profileTab,
  ],
  admin: [
    { label: 'Home', icon: 'home', route: 'AdminSchedule' },
    { label: 'Schedule', icon: 'schedule', route: 'AdminSchedule' },
    profileTab,
  ],
};

interface PartnerNavigationBarProps {
  currentRouteName?: string;
  currentRouteParams?: object;
  role?: string;
  onPressTab: (route: string, params?: Record<string, string>) => void;
}

export const PartnerNavigationBar: React.FC<PartnerNavigationBarProps> = ({
  currentRouteName,
  currentRouteParams,
  role = 'service_partner',
  onPressTab,
}) => {
  const { colors } = useUserPreferences();
  const tabs = tabsByRole[role] || tabsByRole.service_partner;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: colors.surface }]}>
      <View style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {tabs.map((tab) => {
          const selected = currentRouteName === tab.route
            && (!tab.params || Object.entries(tab.params).every(([key, value]) => (
              currentRouteParams && key in currentRouteParams && currentRouteParams[key as keyof typeof currentRouteParams] === value
            )));
          const color = selected ? colors.primary : colors.secondaryText;

          return (
            <Pressable
              key={tab.label}
              accessibilityRole="button"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected }}
              onPress={() => onPressTab(tab.route, tab.params)}
              style={({ pressed }) => [
                styles.tab,
                selected && { backgroundColor: colors.primaryLight },
                pressed && styles.tabPressed,
              ]}
            >
              <NavGlyph name={tab.icon} color={color} />
              <Text
                style={[styles.label, { color }, selected && styles.labelSelected]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

export const PartnerHeaderIcon: React.FC<{ name: 'bell'; color: string }> = ({ color }) => (
  <Ionicons name="notifications-outline" size={22} color={color} />
);

const build_styles = () => StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.surface,
  },
  bar: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    ...Platform.select({
      android: { elevation: 8 },
      default: {
        shadowColor: theme.colors.shadow,
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: -3 },
      },
    }),
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: 2,
  },
  tabPressed: {
    opacity: 0.68,
  },
  label: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '500',
  },
  labelSelected: {
    fontWeight: '800',
  },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
