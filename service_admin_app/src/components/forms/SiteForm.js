import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SITE_TYPES } from '../../constants/catalog';
import { captureCurrentLocation } from '../../location/gps';
import { useTheme } from '../../theme/ThemeContext';
import { fieldErrors, getErrorMessage } from '../../utils/errors';
import { formatCoordinate } from '../../utils/format';
import { hasErrors, sitePayload, validateSite } from '../../utils/validators';
import { LocationCard } from '../ui/LocationCard';
import { Banner } from '../Banner';
import { Button } from '../Button';
import { Select } from '../ui/Select';
import { TextField } from '../TextField';

const EMPTY = {
  siteName: '',
  fullAddress: '',
  city: '',
  latitude: '',
  longitude: '',
  siteType: 'plant',
  isPrimary: false,
};

function seedValues(initial, lockPrimary) {
  const merged = { ...EMPTY, ...initial };
  return {
    ...merged,
    latitude: merged.latitude !== undefined && merged.latitude !== null ? String(merged.latitude) : '',
    longitude: merged.longitude !== undefined && merged.longitude !== null ? String(merged.longitude) : '',
    isPrimary: lockPrimary ? true : Boolean(merged.isPrimary),
  };
}

export function SiteForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  lockPrimary = false,
}) {
  const { colors, type } = useTheme();
  const [values, setValues] = useState(() => seedValues(initial, lockPrimary));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [manualCoordinates, setManualCoordinates] = useState(false);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);

  function setField(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  }

  async function pinLocation() {
    setLocating(true);
    setLocationNote('');
    setFormError('');
    try {
      const result = await captureCurrentLocation();
      if (result.status === 'granted') {
        setField('latitude', String(result.latitude));
        setField('longitude', String(result.longitude));
        setLocationNote(`Pinned at ${formatCoordinate(result.latitude)}, ${formatCoordinate(result.longitude)}.`);
        return;
      }
      if (result.status === 'denied') {
        setLocationNote('Location permission denied. Enter the coordinates below.');
        setManualCoordinates(true);
        return;
      }
      setLocationNote(result.message || 'Location is unavailable right now.');
      setManualCoordinates(true);
    } catch (error) {
      setFormError(getErrorMessage(error));
      setManualCoordinates(true);
    } finally {
      setLocating(false);
    }
  }

  async function submit() {
    const nextErrors = validateSite(values);
    setErrors(nextErrors);
    setFormError('');
    if (hasErrors(nextErrors)) return;
    setLoading(true);
    try {
      await onSubmit(sitePayload({ ...values, isPrimary: lockPrimary ? true : values.isPrimary }));
    } catch (error) {
      const serverFields = fieldErrors(error);
      if (serverFields.address) serverFields.fullAddress = serverFields.address;
      setErrors((current) => ({ ...current, ...serverFields }));
      setFormError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const locationReady = values.latitude !== '' && values.longitude !== '';

  return (
    <View style={styles.form}>
      <Banner message={formError} />
      <TextField
        label="Site name"
        value={values.siteName}
        onChangeText={(value) => setField('siteName', value)}
        error={errors.siteName}
      />
      <TextField
        label="Full address"
        value={values.fullAddress}
        onChangeText={(value) => setField('fullAddress', value)}
        error={errors.fullAddress}
        multiline
      />
      <TextField
        label="City"
        value={values.city}
        onChangeText={(value) => setField('city', value)}
        error={errors.city}
      />
      <LocationCard
        ready={locationReady}
        loading={locating}
        detail={locationReady
          ? `${formatCoordinate(values.latitude)}, ${formatCoordinate(values.longitude)}`
          : ''}
        actionLabel={locationReady ? 'Update GPS' : 'Use GPS'}
        onPress={pinLocation}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: manualCoordinates }}
        onPress={() => setManualCoordinates((current) => !current)}
        style={styles.coordinateToggle}
      >
        <Text style={[type.small, { color: colors.accentText, fontWeight: '700' }]}>
          {manualCoordinates ? 'Hide manual coordinates' : 'Enter coordinates manually'}
        </Text>
      </Pressable>
      {manualCoordinates ? (
        <View style={styles.coordinateRow}>
          <TextField
            label="Latitude"
            value={String(values.latitude ?? '')}
            onChangeText={(value) => setField('latitude', value)}
            error={errors.latitude}
            keyboardType="numeric"
            inputMode="decimal"
            placeholder="18.5204"
          />
          <TextField
            label="Longitude"
            value={String(values.longitude ?? '')}
            onChangeText={(value) => setField('longitude', value)}
            error={errors.longitude}
            keyboardType="numeric"
            inputMode="decimal"
            placeholder="73.8567"
          />
        </View>
      ) : null}
      {locationNote ? <Text style={{ color: colors.warning }}>{locationNote}</Text> : null}
      <Select
        label="Site type"
        value={values.siteType}
        placeholder="Select site type..."
        options={SITE_TYPES.map((option) => ({ value: option.value, label: option.label }))}
        onChange={(value) => setField('siteType', value)}
        error={errors.siteType}
      />
      {lockPrimary ? (
        <Text style={type.muted}>The first site is the primary site.</Text>
      ) : null}
      <Button title={submitLabel} onPress={submit} loading={loading} />
      {onCancel ? (
        <Button title="Cancel" variant="ghost" onPress={onCancel} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  coordinateToggle: {
    minHeight: 36,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  coordinateRow: {
    flexDirection: 'row',
    gap: 12,
  },
});
