import { useCallback, useRef, useState } from 'react';
import {
  Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useFormNavigationField } from '../forms/FormNavigation';

export function Input({
  label,
  value,
  onChangeText,
  error,
  hint,
  helper,
  secure = false,
  multiline = false,
  inputRef,
  onFocus,
  onBlur,
  left = null,
  returnKeyType,
  blurOnSubmit,
  onSubmitEditing,
  editable = true,
  ...props
}) {
  const { colors, radius, type } = useTheme();
  const [hidden, setHidden] = useState(secure);
  const [focused, setFocused] = useState(false);
  const internalRef = useRef(null);
  const fieldRef = useRef(null);
  const setInputRef = useCallback((node) => {
    internalRef.current = node;
    if (typeof inputRef === 'function') inputRef(node);
    else if (inputRef) inputRef.current = node;
  }, [inputRef]);
  const focusField = useCallback(() => {
    if (internalRef.current && typeof internalRef.current.focus === 'function') {
      internalRef.current.focus();
    }
  }, []);
  const formField = useFormNavigationField(focusField, editable, fieldRef);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.borderStrong;
  const help = error ? '' : (hint || helper || '');

  return (
    <View ref={fieldRef} collapsable={false} style={styles.wrap}>
      {label ? (
        <Text style={type.label} accessibilityRole="text">
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.field,
          multiline && styles.multiline,
          {
            borderColor,
            backgroundColor: error ? colors.dangerSurface : focused ? colors.surface : colors.surfaceSecondary,
            borderRadius: radius.input,
          },
        ]}
      >
        {left}
        <TextInput
          ref={setInputRef}
          value={value}
          onChangeText={onChangeText}
          editable={editable}
          secureTextEntry={hidden}
          placeholderTextColor={colors.placeholder}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          accessibilityLabel={label}
          underlineColorAndroid="transparent"
          multiline={multiline}
          returnKeyType={returnKeyType || (!multiline && formField.hasNext && !onSubmitEditing ? 'next' : 'done')}
          blurOnSubmit={blurOnSubmit ?? Boolean(onSubmitEditing || multiline || !formField.hasNext)}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[
            styles.input,
            multiline && styles.multilineInput,
            { color: colors.text },
          ]}
          {...props}
          onFocus={(event) => {
            setFocused(true);
            formField.activate();
            if (onFocus) onFocus(event);
          }}
          onSubmitEditing={(event) => {
            if (onSubmitEditing) {
              onSubmitEditing(event);
              return;
            }
            if (!multiline && formField.enabled && !formField.advance()) Keyboard.dismiss();
          }}
          onBlur={(event) => {
            setFocused(false);
            if (onBlur) onBlur(event);
          }}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? `Show ${label}` : `Hide ${label}`}
            onPress={() => setHidden((current) => !current)}
            hitSlop={8}
            style={styles.toggleHit}
          >
            <Text style={[styles.toggle, { color: colors.primary }]}>{hidden ? 'Show' : 'Hide'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : help ? (
        <Text style={type.small}>{help}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  field: {
    minHeight: 58,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  multiline: {
    minHeight: 96,
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    minHeight: 24,
    includeFontPadding: false,
  },
  multilineInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  toggleHit: {
    minHeight: 44,
    justifyContent: 'center',
    paddingLeft: 8,
  },
  toggle: {
    fontWeight: '600',
    fontSize: 14,
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
});
