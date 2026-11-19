import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { catalogApi } from '../api/resources';
import { Button } from './Button';
import { TextField } from './TextField';
import { Select } from './ui/Select';
import { useCatalog } from '../flows/useCatalog';
import { useTheme } from '../theme/ThemeContext';
import { getErrorMessage } from '../utils/errors';

export function ManufacturerPicker({
  label,
  value,
  onChange,
  options = [],
  valueIsLabel = false,
  error,
  onManufacturerSaved,
}) {
  const { type, colors } = useTheme();
  const { groups, error: catalogError, reload } = useCatalog('manufacturer');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const otherSelected = !valueIsLabel && value === 'other';
  const seen = new Set(options.map((option) => String(option.label || '').trim().toLowerCase()));
  const manufacturers = (groups.manufacturer || [])
    .filter((item) => !seen.has(item.label.trim().toLowerCase()))
    .map((item) => ({
      value: valueIsLabel ? item.label : (item.value || `shared_${item.code}`),
      label: item.label,
    }));
  const selectOptions = [
    ...options.map((option) => ({ value: option.value, label: option.label })),
    ...manufacturers,
  ];

  async function saveManufacturer() {
    setSaveError('');
    const name = newName.trim().replace(/\s+/g, ' ');
    if (!name) {
      setSaveError('Enter a make or brand name.');
      return;
    }
    setSaving(true);
    try {
      const result = await catalogApi.addManufacturer(name);
      const manufacturer = result && result.manufacturer;
      if (!manufacturer || !manufacturer.label || !manufacturer.value) {
        throw new Error('The service did not save this make or brand.');
      }
      if (onManufacturerSaved) onManufacturerSaved(manufacturer);
      await reload(true);
      onChange(valueIsLabel ? manufacturer.label : manufacturer.value);
      setNewName('');
      setAdding(false);
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <Select
        label={label}
        value={value == null ? '' : String(value)}
        placeholder="Select Make/Brand..."
        options={selectOptions}
        onChange={onChange}
        error={error}
      />
      {!adding && !otherSelected ? (
        <Button
          title="+ Add a new make / brand"
          variant="secondary"
          onPress={() => {
            setSaveError('');
            setAdding(true);
          }}
        />
      ) : (
        <>
          <TextField
            label="New make / brand name"
            value={newName}
            onChangeText={setNewName}
            placeholder="Enter manufacturer name"
            autoCapitalize="words"
            error={saveError}
          />
          <Button
            title="Save and select"
            loading={saving}
            onPress={saveManufacturer}
          />
          {!otherSelected ? (
            <Button
              title="Cancel"
              variant="ghost"
              disabled={saving}
              onPress={() => {
                setAdding(false);
                setNewName('');
                setSaveError('');
              }}
            />
          ) : null}
        </>
      )}
      {catalogError ? (
        <Text style={[type.small, { color: colors.danger }]}>{catalogError}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
});
