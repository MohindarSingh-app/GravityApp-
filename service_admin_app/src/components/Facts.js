import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export function Facts({ rows }) {
  const { colors, radius, type } = useTheme();
  const visible = (rows || []).filter((row) => row.value);
  if (visible.length === 0) return null;
  return (
    <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}>
      {visible.map((row, index) => (
        <View
          key={row.label}
          style={[
            styles.row,
            index < visible.length - 1 ? { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth } : null,
          ]}
        >
          <Text style={type.small}>{row.label}</Text>
          <Text style={type.heading}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 2,
  },
});
