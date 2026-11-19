import { AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View } from 'react-native';
import { useCallback, useRef } from 'react';
import { Button } from './Button';
import { useTheme } from '../theme/ThemeContext';
import { useFormNavigationField } from './forms/FormNavigation';

export function SitePicker({ label, sites, value, onChange, error, onAddSite }) {
  const { colors, radius, type } = useTheme();
  const firstSiteRef = useRef(null);
  const fieldRef = useRef(null);
  const focusField = useCallback(() => {
    const target = firstSiteRef.current && findNodeHandle(firstSiteRef.current);
    if (target != null) AccessibilityInfo.setAccessibilityFocus(target);
  }, []);
  const formField = useFormNavigationField(focusField, sites.length > 0, fieldRef);
  return (
    <View
      ref={fieldRef}
      collapsable={false}
      style={styles.wrap}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
    >
      <Text style={type.label}>{label}</Text>
      {sites.length === 0 ? <Text style={type.muted}>Add a site before continuing.</Text> : null}
      {sites.map((site, index) => {
        const selected = site.id === value;
        const name = [site.siteName, site.city].filter(Boolean).join(', ');
        return (
          <Pressable
            key={site.id}
            ref={index === 0 ? firstSiteRef : undefined}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={name}
            onPress={() => {
              onChange(site.id, name);
              formField.advance();
            }}
            style={[
              styles.row,
              {
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primaryLight : colors.surface,
                borderRadius: radius.md,
              },
            ]}
          >
            <Text style={[styles.name, { color: selected ? colors.primary : colors.text }]}>{site.siteName}</Text>
            {site.city ? <Text style={type.small}>{site.city}</Text> : null}
          </Pressable>
        );
      })}
      {onAddSite ? (
        <Button title="+ Add New Site" variant="secondary" onPress={onAddSite} />
      ) : null}
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  row: {
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
    justifyContent: 'center',
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
});
