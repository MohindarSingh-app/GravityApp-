import {
  AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useCallback, useRef } from 'react';
import { Button } from '../../../components/Button';
import { Glyph } from '../../../components/Glyph';
import { ManufacturerPicker } from '../../../components/ManufacturerPicker';
import { OptionGroup } from '../../../components/OptionGroup';
import { TextField } from '../../../components/TextField';
import { Select } from '../../../components/ui/Select';
import { modelPlaceholder } from '../../../flows/serviceFlow';
import { useCatalog } from '../../../flows/useCatalog';
import { useTheme } from '../../../theme/ThemeContext';
import { useFormNavigationField } from '../../../components/forms/FormNavigation';

const OPTION_GLYPHS = {
  electrician: {
    power_distribution: 'bolt',
    industrial_wiring: 'cable',
    motor_wiring: 'settings',
    industrial_lighting: 'bulb',
    earthing: 'globe',
    generator: 'battery',
    breakdown: 'alert',
  },
  panel_mcc: {
    mcc: 'device',
    vfd_panel: 'bolt',
    busbar: 'bolt',
    capacitor: 'battery',
    control_wiring: 'cable',
  },
  cabling: {
    power_ht_lt: 'cable',
    instrumentation: 'cable',
    fiber: 'globe',
    lan: 'grid',
  },
  vfd_servo: {
    vfd_fault: 'alert',
    servo_fault: 'settings',
    speed_control: 'speed',
    parameters: 'save',
    dc_drive: 'bolt',
    communication: 'sync',
    breakdown: 'alert',
  },
  plc: {
    fault: 'alert',
    hmi: 'hmi',
    program: 'save',
    comm: 'sync',
    scada: 'scada',
    io: 'cable',
    breakdown: 'rush',
  },
};

const CATEGORY_GLYPHS = {
  electrician: 'bolt',
  panel_mcc: 'device',
  cabling: 'cable',
  vfd_servo: 'settings',
  plc: 'device',
};

function toggleValue(current, value) {
  const list = Array.isArray(current) ? current : [];
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function ServiceOptionCard({
  categoryCode,
  option,
  onPress,
  selected = false,
  showIcon = true,
  compact = false,
  optionRef,
  accessibilityRole = 'button',
}) {
  const { colors, radius, type } = useTheme();
  const icon = (OPTION_GLYPHS[categoryCode] && OPTION_GLYPHS[categoryCode][option.code])
    || option.iconKey
    || CATEGORY_GLYPHS[categoryCode]
    || 'book';

  return (
    <Pressable
      ref={optionRef}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={[option.name, option.summary].filter(Boolean).join('. ')}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.optionPressable, pressed && styles.optionPressed]}
    >
      <View style={[styles.optionCard, compact && styles.optionCardCompact, {
        backgroundColor: selected ? colors.primaryLight : colors.surface,
        borderColor: selected ? colors.primary : colors.border,
        borderRadius: radius.card,
      }]}
      >
        {showIcon ? (
          <View style={[styles.optionIcon, {
            backgroundColor: selected ? colors.primary : colors.primaryLight,
            borderRadius: radius.chip,
          }]}
          >
            <Glyph name={icon} color={selected ? colors.onAccent : colors.primary} size={compact ? 16 : 19} />
          </View>
        ) : null}
        <View style={styles.optionCopy}>
          <Text
            style={[compact ? type.small : type.heading, selected ? { color: colors.primary } : null]}
            numberOfLines={compact ? 2 : undefined}
          >
            {option.name}
          </Text>
          {option.summary ? <Text style={type.small} numberOfLines={compact ? 2 : undefined}>{option.summary}</Text> : null}
        </View>
        {selected ? <Glyph name="check" color={colors.primary} size={compact ? 15 : 18} /> : null}
      </View>
    </Pressable>
  );
}

function ServiceOptionPicker({ categoryCode, field, value, onChange, error }) {
  const { colors, type } = useTheme();
  const firstOptionRef = useRef(null);
  const fieldRef = useRef(null);
  const focusField = useCallback(() => {
    const target = firstOptionRef.current && findNodeHandle(firstOptionRef.current);
    if (target != null) AccessibilityInfo.setAccessibilityFocus(target);
  }, []);
  const options = field.options || [];
  const formField = useFormNavigationField(focusField, options.length > 0, fieldRef);

  return (
    <View ref={fieldRef} collapsable={false} style={styles.field}>
      <Text style={type.label}>{field.label}</Text>
      {options.map((option, index) => (
        <ServiceOptionCard
          key={option.value}
          categoryCode={categoryCode}
          showIcon={field.key !== 'make'}
          option={{
            code: option.value,
            name: option.label,
            summary: field.key === 'make' ? '' : option.summary,
          }}
          optionRef={index === 0 ? firstOptionRef : undefined}
          accessibilityRole="radio"
          selected={value === option.value}
          onPress={() => {
            onChange(field.id, option.value);
            formField.advance();
          }}
        />
      ))}
      {error ? <Text style={[type.small, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

function MultiSelect({ field, value, onChange, error }) {
  const { colors, radius, type } = useTheme();
  const firstOptionRef = useRef(null);
  const fieldRef = useRef(null);
  const focusField = useCallback(() => {
    const target = firstOptionRef.current && findNodeHandle(firstOptionRef.current);
    if (target != null) AccessibilityInfo.setAccessibilityFocus(target);
  }, []);
  const formField = useFormNavigationField(focusField, (field.options || []).length > 0, fieldRef);
  const selected = Array.isArray(value) ? value : [];
  return (
    <View ref={fieldRef} collapsable={false} style={styles.field} accessibilityRole="list">
      <Text style={type.label}>{field.label}</Text>
      <View style={styles.chips}>
        {(field.options || []).map((option, index) => {
          const on = selected.includes(option.value);
          return (
            <Pressable
              key={option.value}
              ref={index === 0 ? firstOptionRef : undefined}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={option.label}
              onPress={() => {
                onChange(toggleValue(selected, option.value));
                formField.activate(true);
              }}
              style={[
                styles.chip,
                {
                  borderRadius: radius.button,
                  borderColor: on ? colors.primary : colors.borderStrong,
                  backgroundColor: on ? colors.primaryLight : colors.surface,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: on ? colors.primary : colors.text }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {field.helpText ? <Text style={type.muted}>{field.helpText}</Text> : null}
      {error ? <Text style={[type.small, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

function HardwareListField({ value, onChange, error }) {
  const { colors, radius, type } = useTheme();
  const { groups } = useCatalog('hardware_type');
  const typeOptions = groups.hardware_type.map((item) => ({ value: item.code, label: item.label }));
  const blankItem = { type: (typeOptions[0] && typeOptions[0].value) || '', rating: '', make: '', application: '' };
  let items = [];
  try {
    const parsed = JSON.parse(value || '[]');
    if (Array.isArray(parsed)) items = parsed;
  } catch (_error) {
    items = [];
  }
  if (!items.length) items = [blankItem];

  function updateItem(index, key, nextValue) {
    onChange(JSON.stringify(items.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [key]: nextValue } : item
    ))));
  }

  return (
    <View style={styles.field}>
      <Text style={type.label}>Hardware / Equipment List</Text>
      {items.map((item, index) => (
        <View
          key={`equipment-${index}`}
          style={[styles.equipmentItem, { borderColor: colors.border, borderRadius: radius.card }]}
        >
          <Text style={type.heading}>Item {index + 1}</Text>
          <Select
            label="Type"
            value={item.type || ''}
            placeholder="Select type..."
            options={typeOptions}
            onChange={(next) => updateItem(index, 'type', next)}
          />
          <TextField
            label="Rating (kW)"
            value={item.rating || ''}
            onChangeText={(next) => updateItem(index, 'rating', next)}
            placeholder="e.g. 22"
          />
          <ManufacturerPicker
            label="Make / Brand"
            value={item.make || ''}
            valueIsLabel
            onChange={(next) => updateItem(index, 'make', next)}
          />
          <TextField
            label="Application"
            value={item.application || ''}
            onChangeText={(next) => updateItem(index, 'application', next)}
            placeholder="e.g. Pump"
          />
          {index > 0 ? (
            <Button
              title="Remove item"
              variant="ghost"
              onPress={() => onChange(JSON.stringify(items.filter((_, itemIndex) => itemIndex !== index)))}
            />
          ) : null}
        </View>
      ))}
      {items.length < 10 ? (
        <Button
          title="+ Add Another Motor / Drive"
          variant="secondary"
          onPress={() => onChange(JSON.stringify([
            ...items,
            blankItem,
          ]))}
        />
      ) : null}
      {error ? <Text style={[type.small, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

export function ServiceFieldInput({
  categoryCode, field, fields, answers, onChange, onManufacturerSaved, error,
}) {
  const { type } = useTheme();
  const value = (answers || {})[field.id];

  if (field.key === 'hardware_list') {
    return (
      <HardwareListField
        value={value == null ? '' : String(value)}
        onChange={(next) => onChange(field.id, next)}
        error={error}
      />
    );
  }
  if (field.key === 'specify_make') {
    return (
      <ManufacturerPicker
        label={field.label}
        value={value == null ? '' : String(value)}
        valueIsLabel
        onChange={(next) => onChange(field.id, next)}
        onManufacturerSaved={(manufacturer) => {
          if (onManufacturerSaved) onManufacturerSaved(field, manufacturer);
        }}
        error={error}
      />
    );
  }
  if (field.type === 'textarea' || field.type === 'text' || field.type === 'number') {
    return (
      <TextField
        label={field.label}
        value={value == null ? '' : String(value)}
        onChangeText={(next) => onChange(field.id, next)}
        placeholder={(field.key === 'drive_model' || field.key === 'model')
          ? modelPlaceholder(field, fields, answers)
          : (field.placeholder || '')}
        hint={field.helpText || ''}
        error={error}
        multiline={field.type === 'textarea'}
        keyboardType={field.type === 'number' ? 'decimal-pad' : 'default'}
      />
    );
  }
  if (field.type === 'multiselect') {
    return (
      <MultiSelect
        field={field}
        value={value}
        error={error}
        onChange={(next) => onChange(field.id, next)}
      />
    );
  }
  // Make/brand and application follow the reference prototype, which renders
  // them as native <select> dropdowns. Other short option sets (e.g. urgency)
  // stay as card-style chips to match the prototype's card grids.
  if (field.type === 'select' && ['make', 'brand', 'manufacturer'].includes(field.key)) {
    return (
      <ManufacturerPicker
        label={field.label}
        value={value == null ? '' : String(value)}
        options={field.options || []}
        onChange={(next) => onChange(field.id, next)}
        onManufacturerSaved={(manufacturer) => {
          if (onManufacturerSaved) onManufacturerSaved(field, manufacturer);
        }}
        error={error}
      />
    );
  }
  if (field.type === 'select' && field.key === 'application') {
    return (
      <Select
        label={field.label}
        value={value == null ? '' : String(value)}
        placeholder={field.placeholder || (field.key === 'make' ? 'Select Make/Brand...' : 'Select...')}
        options={(field.options || []).map((option) => ({ value: option.value, label: option.label }))}
        onChange={(next) => onChange(field.id, next)}
        error={error}
        helper={field.helpText || undefined}
      />
    );
  }
  if (field.type === 'select' && (field.options || []).length > 6) {
    return (
      <ServiceOptionPicker
        categoryCode={categoryCode}
        field={field}
        value={value}
        onChange={onChange}
        error={error}
      />
    );
  }
  return (
    <View style={styles.field}>
      <OptionGroup
        label={field.label}
        options={(field.options || []).map((option) => ({ value: option.value, label: option.label }))}
        value={value || ''}
        onChange={(next) => onChange(field.id, next)}
        error={error}
      />
      {field.helpText ? <Text style={type.muted}>{field.helpText}</Text> : null}
    </View>
  );
}

export function SiteOption({ site, selected, onPress }) {
  const { colors, radius, type } = useTheme();
  const address = site.fullAddress || [site.address, site.city, site.state].filter(Boolean).join(', ');
  const kind = site.siteTypeLabel || site.siteType;
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={site.siteName}
      onPress={onPress}
      style={[
        styles.site,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primaryLight : colors.surface,
          borderRadius: radius.md,
        },
      ]}
    >
      <View style={[styles.optionIcon, {
        backgroundColor: selected ? colors.primary : colors.primaryLight,
        borderRadius: radius.chip,
      }]}
      >
        <Glyph name="plant" color={selected ? colors.onAccent : colors.primary} size={18} />
      </View>
      <View style={styles.optionCopy}>
        <Text style={[type.heading, { color: selected ? colors.primary : colors.text }]}>{site.siteName}</Text>
        {address ? <Text style={type.body}>{address}</Text> : null}
        <Text style={type.small}>{[kind, site.isPrimary ? 'Primary' : ''].filter(Boolean).join(' · ')}</Text>
      </View>
      {selected ? <Glyph name="check" color={colors.primary} size={18} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  optionPressable: {
    width: '100%',
  },
  optionPressed: {
    opacity: 0.92,
  },
  optionCard: {
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionCardCompact: {
    minHeight: 76,
    padding: 8,
    gap: 7,
  },
  optionIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  field: {
    gap: 8,
  },
  equipmentItem: {
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  site: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});
