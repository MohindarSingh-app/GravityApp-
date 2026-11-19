import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Glyph } from '../Glyph';

export function BottomNavigation({ items, active, onChange }) {
  const { colors, radius } = useTheme();
  const centerId = 'QuickServices';
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.dockSurface,
          borderColor: colors.dockBorder,
          borderRadius: radius.card,
        },
      ]}
    >
      {items.map((item) => {
        const selected = item.id === active;
        const isCenter = item.id === centerId;
        const tint = selected ? colors.dockActive : colors.dockInactive;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityLabel={item.accessibilityLabel || item.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(item.id)}
            style={styles.item}
          >
            <View
              style={[
                isCenter ? styles.centerFab : styles.iconWrap,
                isCenter && {
                  borderRadius: radius.pill,
                  borderColor: colors.dockBorder,
                },
              ]}
            >
              <Glyph
                name={item.glyph}
                color={tint}
                size={isCenter ? 24 : 20}
              />
            </View>
            <Text
              style={[
                styles.label,
                selected && styles.labelSelected,
                {
                  color: tint,
                },
              ]}
              numberOfLines={1}
            >
              {isCenter ? 'Book' : item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    minHeight: 68,
    marginHorizontal: 9,
    marginBottom: 5,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  centerFab: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  item: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 3,
    transform: [{ translateY: 3 }],
  },
  iconWrap: {
    width: 42,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '500',
  },
  labelSelected: {
    fontWeight: '700',
  },
});
