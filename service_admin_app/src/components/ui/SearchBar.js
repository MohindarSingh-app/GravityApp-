import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Glyph } from '../Glyph';

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  onFilter,
  filterLabel = 'Filter',
  accessibilityLabel = 'Search',
  onSubmitEditing,
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.pill,
        },
      ]}
    >
      <Glyph name="search" color={colors.textTertiary} size={20} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        style={[styles.input, { color: colors.text }]}
      />
      {onFilter ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={filterLabel}
          onPress={onFilter}
          hitSlop={8}
          style={styles.filter}
        >
          <Glyph name="filter" color={colors.text} size={20} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 56,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 8,
    includeFontPadding: false,
  },
  filter: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
