import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export function Tabs({ tabs, value, onChange }) {
  const { colors, radius, type } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.row, { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill }]}>
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            onPress={() => onChange(tab.id)}
            style={[
              styles.tab,
              selected && {
                backgroundColor: colors.surface,
                borderRadius: radius.pill,
              },
            ]}
          >
            <Text style={[type.label, styles.tabLabel, { color: selected ? colors.primary : colors.textTertiary }]}>
              {tab.label}
              {tab.count != null ? ` · ${tab.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    padding: 3,
    gap: 2,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tabLabel: {
    fontSize: 12,
  },
});
