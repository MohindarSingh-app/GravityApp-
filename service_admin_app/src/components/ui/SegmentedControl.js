import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

export function SegmentedControl({ tabs, value, onChange, scrollable = false }) {
  const { colors, radius, type } = useTheme();
  const row = (
    <View style={[styles.track, { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill }]}>
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
              styles.segment,
              selected && {
                backgroundColor: colors.primary,
                borderRadius: radius.pill,
              },
            ]}
          >
            <Text
              style={[
                type.label,
                styles.label,
                { color: selected ? colors.textOnPrimary : colors.textTertiary },
              ]}
              numberOfLines={1}
            >
              {tab.label}
              {tab.count != null ? ` (${tab.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (!scrollable) return row;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      {row}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  track: {
    flexDirection: 'row',
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    minWidth: 72,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
  },
});
