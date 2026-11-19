import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useCatalog } from '../../flows/useCatalog';
import { useTheme } from '../../theme/ThemeContext';
import { isValidGstin } from '../../utils/gst';
import { fieldErrors, getErrorMessage } from '../../utils/errors';
import { companyPayload, hasErrors, validateCompany } from '../../utils/validators';
import { Banner } from '../Banner';
import { Button } from '../Button';
import { Select } from '../ui/Select';
import { TextField } from '../TextField';

const EMPTY = {
  companyName: '',
  gst: '',
  industry: '',
  city: '',
};

// Cities offered during company registration — matches the reference
// prototype's City <select> (Jaipur / Jodhpur / Kota / Udaipur).
export const COMPANY_CITIES = ['Jaipur', 'Jodhpur', 'Kota', 'Udaipur'];

export function CompanyForm({ initial, submitLabel, onSubmit, onBack }) {
  const { colors, type } = useTheme();
  const [values, setValues] = useState({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const { groups } = useCatalog('industry');
  const industries = groups.industry.map((item) => ({ value: item.label, label: item.label }));
  const cityOptions = COMPANY_CITIES.map((city) => ({ value: city, label: city }));

  function setField(key, value) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  }

  async function submit() {
    const nextErrors = validateCompany(values);
    setErrors(nextErrors);
    setFormError('');
    if (hasErrors(nextErrors)) return;
    setLoading(true);
    try {
      await onSubmit(companyPayload(values));
    } catch (error) {
      setErrors((current) => ({ ...current, ...fieldErrors(error) }));
      setFormError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  const gstOk = isValidGstin(values.gst);

  return (
    <View style={styles.form}>
      <Banner message={formError} />
      <TextField
        label="Company / firm name"
        value={values.companyName}
        onChangeText={(value) => setField('companyName', value)}
        error={errors.companyName}
        autoComplete="organization"
        textContentType="organizationName"
      />
      <Select
        label="Industry type"
        value={values.industry}
        placeholder="Select industry..."
        options={industries}
        onChange={(value) => setField('industry', value)}
        error={errors.industry}
        helper={industries.length ? undefined : 'Unable to load industries right now.'}
      />
      <TextField
        label="GST number"
        value={values.gst}
        onChangeText={(value) => setField('gst', value.toUpperCase())}
        error={errors.gst}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        maxLength={15}
      />
      {gstOk ? (
        <Text style={[styles.verified, { color: colors.success }]}>✓ GSTIN format accepted</Text>
      ) : (
        <Text style={type.small}>Enter a 15-character GSTIN. For testing, a format-correct sample number is accepted.</Text>
      )}
      <Select
        label="City"
        value={values.city}
        placeholder="Select city..."
        options={cityOptions}
        onChange={(value) => setField('city', value)}
        error={errors.city}
      />
      <View style={onBack ? styles.actions : undefined}>
        {onBack ? (
          <View style={styles.action}>
            <Button title="‹ Back" variant="secondary" onPress={onBack} disabled={loading} />
          </View>
        ) : null}
        <View style={onBack ? styles.action : undefined}>
          <Button title={submitLabel} onPress={submit} loading={loading} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  action: {
    flex: 1,
  },
  verified: {
    fontWeight: '700',
    fontSize: 13,
  },
});
