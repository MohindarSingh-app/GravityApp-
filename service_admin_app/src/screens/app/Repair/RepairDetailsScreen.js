import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../../components/Button';
import { Glyph } from '../../../components/Glyph';
import { FlowScreen } from '../../../components/FlowScreen';
import { TextField } from '../../../components/TextField';
import { Card } from '../../../components/ui/Card';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { captureAttachmentPhoto, pickAttachmentPhotos } from '../../../utils/pickAttachments';
import { repairModelHint, REPAIR_STEPS, HMI_SCREEN_SIZES } from './repairFlow';

const WARRANTY_OPTIONS = ['In Warranty', 'Out of Warranty', 'Not Sure'];

export function RepairDetailsScreen() {
  const navigation = useNavigation();
  const { colors, radius, type } = useTheme();
  const { draft, patch } = useFlowDraft();
  const [error, setError] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [showRegistrationDetails, setShowRegistrationDetails] = useState(false);
  const isHmi = draft.repairDeviceKind === 'hmi';
  const pendingAttachments = draft.pendingAttachments || [];

  async function addPhotos() {
    setPhotoError('');
    try {
      const remaining = 5 - pendingAttachments.length;
      if (remaining < 1) {
        setPhotoError('You can attach up to 5 photos.');
        return;
      }
      const selected = await pickAttachmentPhotos(remaining);
      if (selected.length) patch({ pendingAttachments: [...pendingAttachments, ...selected] });
    } catch (pickerError) {
      setPhotoError(getErrorMessage(pickerError));
    }
  }

  async function takePhoto() {
    setPhotoError('');
    if (pendingAttachments.length >= 5) {
      setPhotoError('You can attach up to 5 photos.');
      return;
    }
    try {
      const photo = await captureAttachmentPhoto();
      if (photo) patch({ pendingAttachments: [...pendingAttachments, photo] });
    } catch (pickerError) {
      setPhotoError(getErrorMessage(pickerError));
    }
  }

  function removePhoto(index) {
    patch({
      pendingAttachments: pendingAttachments.filter((_, current) => current !== index),
    });
  }

  function selectWarranty(warrantyStatus) {
    patch({ warrantyStatus });
    setError('');
  }

  function continueToScope() {
    if (isHmi && !draft.hmiScreenSize) {
      setError('Choose the HMI screen size.');
      return;
    }
    if (isHmi && draft.hmiScreenSize === 'other' && !String(draft.hmiScreenSizeOther || '').trim()) {
      setError('Enter the HMI screen size.');
      return;
    }
    if (!draft.warrantyStatus) {
      setError('Select the warranty status, or choose Not Sure.');
      return;
    }
    setError('');
    navigation.navigate(draft.repairScope ? 'RepairLogistics' : 'RepairScope');
  }

  return (
    <FlowScreen
      title="Device Details"
      steps={REPAIR_STEPS}
      step={3}
      onBack={() => navigation.goBack()}
      error={error}
    >
      <Text style={type.display} accessibilityRole="header">Device Details</Text>
      {draft.repairDeviceLabel ? <Text style={type.muted}>{draft.repairDeviceLabel}</Text> : null}
      {draft.deviceId ? (
        <Text style={type.muted}>
          Registered device: {[draft.manufacturer, draft.model].filter(Boolean).join(' ') || 'Model not provided'}
        </Text>
      ) : null}
      <TextField
        label="Model Number (optional)"
        value={draft.model || ''}
        onChangeText={(model) => patch({ model })}
        placeholder={repairModelHint(draft.repairMake)}
        autoCapitalize="characters"
        editable={!draft.deviceId}
      />
      {isHmi ? (
        <>
          <Text style={type.label}>Screen Size</Text>
          <View style={styles.pills}>
            {HMI_SCREEN_SIZES.map((size) => {
              const label = size === 'other' ? 'Other' : `${size}"`;
              const selected = draft.hmiScreenSize === size;
              return (
                <Pressable
                  key={size}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    patch({
                      hmiScreenSize: size,
                      hmiScreenSizeOther: size === 'other' ? draft.hmiScreenSizeOther || '' : '',
                    });
                    setError('');
                  }}
                  style={[
                    styles.pill,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primaryLight : colors.surface,
                      borderRadius: radius.pill,
                    },
                  ]}
                >
                  <Text style={[type.small, { color: selected ? colors.primary : colors.text }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          {draft.hmiScreenSize === 'other' ? (
            <TextField
              label="Specify Screen Size"
              value={draft.hmiScreenSizeOther || ''}
              onChangeText={(hmiScreenSizeOther) => patch({ hmiScreenSizeOther })}
              placeholder={'e.g. 8", 21"'}
            />
          ) : null}
        </>
      ) : null}
      <View style={styles.section}>
        <Text style={type.label}>Warranty Status</Text>
        {WARRANTY_OPTIONS.map((status) => (
          <Pressable
            key={status}
            accessibilityRole="radio"
            accessibilityState={{ checked: draft.warrantyStatus === status }}
            onPress={() => selectWarranty(status)}
            style={[
              styles.warrantyRow,
              {
                backgroundColor: draft.warrantyStatus === status ? colors.primaryLight : colors.surface,
                borderColor: draft.warrantyStatus === status ? colors.primary : colors.border,
                borderRadius: radius.md,
              },
            ]}
          >
            <Text style={[type.body, { color: colors.text }]}>{status}</Text>
            <View style={[
              styles.radio,
              {
                borderColor: draft.warrantyStatus === status ? colors.primary : colors.border,
                borderRadius: radius.pill,
              },
            ]}>
              {draft.warrantyStatus === status ? <Text style={{ color: colors.primary }}>✓</Text> : null}
            </View>
          </Pressable>
        ))}
      </View>
      <View style={styles.section}>
        <Text style={type.heading}>Photos (optional)</Text>
        <Text style={type.muted}>Camera or gallery — max 5 photos. Nameplate and damage photos help us diagnose before arrival.</Text>
        <View style={styles.photoButtons}>
          <View style={styles.photoButton}>
            <Button title="Take Photo" variant="secondary" onPress={takePhoto} />
          </View>
          <View style={styles.photoButton}>
            <Button title="Choose Photos" variant="secondary" onPress={addPhotos} />
          </View>
        </View>
        {photoError ? <Text style={[type.body, { color: colors.danger }]}>{photoError}</Text> : null}
        {pendingAttachments.map((photo, index) => (
          <View key={`${photo.fileName}-${index}`} style={styles.photoRow}>
            <Text style={[type.small, styles.photoName]} numberOfLines={1}>{photo.fileName}</Text>
            <Button title="Remove" variant="ghost" onPress={() => removePhoto(index)} />
          </View>
        ))}
      </View>
      {!draft.deviceId ? (
        <View style={styles.section}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showRegistrationDetails }}
            onPress={() => setShowRegistrationDetails((visible) => !visible)}
            style={[styles.registrationHeader, { borderColor: colors.border }]}
          >
            <View style={styles.registrationCopy}>
              <Text style={type.heading}>More device details (optional)</Text>
              <Text style={type.small}>Serial number, asset number and installation area</Text>
            </View>
            <Glyph name={showRegistrationDetails ? 'chevronUp' : 'chevron'} color={colors.textSecondary} size={18} />
          </Pressable>
          {showRegistrationDetails ? (
            <Card style={styles.registrationFields}>
              <TextField
                label="Serial number (optional)"
                value={draft.serialNumber || ''}
                onChangeText={(serialNumber) => patch({ serialNumber })}
                autoCapitalize="characters"
              />
              <TextField
                label="Asset number (optional)"
                value={draft.assetNumber || ''}
                onChangeText={(assetNumber) => patch({ assetNumber })}
              />
              <TextField
                label="Installation location (optional)"
                value={draft.installationLocation || ''}
                onChangeText={(installationLocation) => patch({ installationLocation })}
                placeholder="Area, line or equipment location"
              />
            </Card>
          ) : null}
        </View>
      ) : null}
      <Button title="Next — Choose Service Scope" onPress={continueToScope} />
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  pill: {
    minWidth: 58,
    minHeight: 38,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  section: {
    gap: 8,
  },
  warrantyRow: {
    minHeight: 48,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  radio: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  photoName: {
    flex: 1,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  photoButton: {
    flex: 1,
  },
  registrationHeader: {
    minHeight: 58,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
  },
  registrationCopy: {
    flex: 1,
    gap: 2,
  },
  registrationFields: {
    gap: 12,
  },
});
