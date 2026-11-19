import { Modal as RNModal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from './Button';

export function Modal({
  visible,
  title,
  description,
  onClose,
  primaryAction,
  secondaryAction,
  children,
}) {
  const { colors, radius, type } = useTheme();
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={onClose} style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable
          accessibilityViewIsModal
          onPress={() => {}}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.modal,
            },
          ]}
        >
          {title ? <Text style={type.section} accessibilityRole="header">{title}</Text> : null}
          {description ? <Text style={type.body}>{description}</Text> : null}
          {children}
          {secondaryAction || primaryAction ? (
            <View style={styles.actions}>
              {secondaryAction ? (
                <View style={styles.action}>
                  <Button
                    title={secondaryAction.label}
                    variant={secondaryAction.variant || 'secondary'}
                    onPress={secondaryAction.onPress}
                  />
                </View>
              ) : null}
              {primaryAction ? (
                <View style={styles.action}>
                  <Button
                    title={primaryAction.label}
                    variant={primaryAction.variant || 'primary'}
                    onPress={primaryAction.onPress}
                    loading={primaryAction.loading}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </RNModal>
  );
}

export function ConfirmDialog({
  visible,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      visible={visible}
      title={title}
      description={description}
      onClose={onClose}
      secondaryAction={{ label: cancelLabel, onPress: onClose }}
      primaryAction={{
        label: confirmLabel,
        variant: destructive ? 'danger' : 'primary',
        onPress: onConfirm,
      }}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    padding: 20,
    gap: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  action: {
    flex: 1,
  },
});
