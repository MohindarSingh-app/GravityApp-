import { useCallback, useRef, useState } from 'react';
import {
  AccessibilityInfo, findNodeHandle, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { useCatalog } from '../../flows/useCatalog';
import { useTheme } from '../../theme/ThemeContext';
import { getErrorMessage } from '../../utils/errors';
import { validateEmail, validateName, validatePhone } from '../../utils/validators';
import { Banner } from '../Banner';
import { Button } from '../Button';
import { Glyph } from '../Glyph';
import { TextField } from '../TextField';
import { useFormNavigationField } from './FormNavigation';

function ProfileRoleField({ roles, value, onChange, error }) {
  const { colors } = useTheme();
  const firstOptionRef = useRef(null);
  const fieldRef = useRef(null);
  const focusField = useCallback(() => {
    const target = firstOptionRef.current && findNodeHandle(firstOptionRef.current);
    if (target != null) AccessibilityInfo.setAccessibilityFocus(target);
  }, []);
  const formField = useFormNavigationField(focusField, roles.length > 0, fieldRef);

  return (
    <View
      ref={fieldRef}
      collapsable={false}
      style={styles.roleGroup}
      accessibilityRole="radiogroup"
      accessibilityLabel="Your role"
    >
      <Text style={styles.roleLabel}>YOUR ROLE</Text>
      <View style={styles.roleGrid}>
        {roles.map((option, index) => {
          const selected = option.code === value;
          return (
            <Pressable
              key={option.code}
              ref={index === 0 ? firstOptionRef : undefined}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${option.label}. ${option.summary || ''}`}
              onPress={() => {
                onChange(option.code);
                formField.advance();
              }}
              style={[
                styles.roleCard,
                {
                  borderColor: selected ? colors.danger : colors.borderStrong,
                  backgroundColor: selected ? colors.dangerSurface : colors.surface,
                },
              ]}
            >
              <Glyph
                name={option.glyph || 'user'}
                color={selected ? colors.danger : colors.textSecondary}
                size={19}
              />
              <Text
                numberOfLines={1}
                style={[styles.roleTitle, { color: colors.text }]}
              >
                {option.label}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.roleDetail, { color: colors.textTertiary }]}
              >
                {option.summary}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={[styles.roleError, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

export function ProfileForm({
  initialName = '',
  initialEmail = '',
  initialPhone = '',
  initialSecondaryPhone = '',
  initialRole = 'SITE_ENGINEER',
  showRole = false,
  submitLabel,
  note = '',
  onSubmit,
  onBack,
}) {
  const { colors, radius } = useTheme();
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [secondaryPhone, setSecondaryPhone] = useState(initialSecondaryPhone);
  const [role, setRole] = useState(initialRole);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const { groups } = useCatalog('account_role');
  const roles = groups.account_role;

  async function submit() {
    const nextErrors = {};
    const nameError = validateName(fullName);
    if (nameError) nextErrors.fullName = nameError;
    if (email.trim()) {
      const emailError = validateEmail(email);
      if (emailError) nextErrors.email = emailError;
    }
    if (secondaryPhone.trim()) {
      const phoneError = validatePhone(secondaryPhone);
      if (phoneError) nextErrors.secondaryPhone = phoneError;
    }
    if (showRole && !role) nextErrors.role = 'Choose your role.';
    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    try {
      await onSubmit({
        fullName: fullName.trim(),
        email: email.trim(),
        secondaryPhone: secondaryPhone.trim() || null,
        ...(showRole ? { role } : {}),
      });
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.form}>
      <Banner message={formError} />
      <TextField
        label="Your full name"
        value={fullName}
        onChangeText={setFullName}
        error={errors.fullName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />
      <TextField
        label="Registered mobile number"
        value={initialPhone || 'Not available'}
        editable={false}
        hint="This registered number is used to sign in and cannot be changed here."
      />
      {showRole ? (
        <ProfileRoleField
          roles={roles}
          value={role}
          onChange={(nextRole) => {
            setRole(nextRole);
            setErrors((current) => ({ ...current, role: '' }));
          }}
          error={errors.role}
        />
      ) : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        keyboardType="email-address"
        inputMode="email"
        autoComplete="email"
        textContentType="emailAddress"
        hint="Optional."
      />
      <TextField
        label="Alternate mobile number (optional)"
        value={secondaryPhone}
        onChangeText={setSecondaryPhone}
        error={errors.secondaryPhone}
        keyboardType="phone-pad"
        inputMode="tel"
        autoComplete="tel"
        textContentType="telephoneNumber"
        placeholder="+91 98765 43210"
        hint="Optional contact number. It will not be used to sign in."
      />
      {note ? (
        <View style={[styles.note, { backgroundColor: colors.successSurface, borderRadius: radius.md }]}>
          <Text style={{ color: colors.success, fontWeight: '700' }}>{note}</Text>
        </View>
      ) : null}
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
  note: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  roleGroup: {
    gap: 8,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  roleCard: {
    width: '48.5%',
    minHeight: 88,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 10,
  },
  roleTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  roleDetail: {
    fontSize: 10,
  },
  roleError: {
    fontSize: 12,
    fontWeight: '600',
  },
});
