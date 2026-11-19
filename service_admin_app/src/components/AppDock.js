import { BottomNavigation } from './ui/BottomNavigation';

export const APP_TABS = [
  { id: 'Dashboard', label: 'Dashboard', glyph: 'home', accessibilityLabel: 'Dashboard' },
  { id: 'Emergency', label: 'Emergency', glyph: 'bolt', accessibilityLabel: 'Emergency' },
  { id: 'QuickServices', label: 'Quick Services', glyph: 'calendar', accessibilityLabel: 'Quick Services' },
  { id: 'Jobs', label: 'Jobs', glyph: 'jobs', accessibilityLabel: 'Jobs' },
  { id: 'Amc', label: 'AMC', glyph: 'cover', accessibilityLabel: 'AMC' },
];

const TAB_START_SCREENS = {
  QuickServices: 'ServiceCategory',
  Jobs: 'JobsList',
  Amc: 'AmcList',
};

export function AppDock({ active, navigation }) {
  return (
    <BottomNavigation
      items={APP_TABS}
      active={active}
      onChange={(id) => {
        const screen = TAB_START_SCREENS[id];
        if (screen) navigation.navigate(id, { screen });
        else navigation.navigate(id);
      }}
    />
  );
}
