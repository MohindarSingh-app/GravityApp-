import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button } from '../../../components/Button';
import { FlowScreen } from '../../../components/FlowScreen';
import { TextField } from '../../../components/TextField';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useTheme } from '../../../theme/ThemeContext';
import { RepairChoiceCard } from './RepairChoiceCard';
import { repairFaultOptions, REPAIR_STEPS } from './repairFlow';
import { useFormNavigationField } from '../../../components/forms/FormNavigation';

export function RepairFaultScreen() {
  const navigation = useNavigation();
  const { type } = useTheme();
  const { draft, patch } = useFlowDraft();
  const [error, setError] = useState('');
  const faultFieldRef = useRef(null);
  const focusFaultField = useCallback(() => {}, []);
  const faultField = useFormNavigationField(
    focusFaultField,
    repairFaultOptions(draft.repairDeviceKind).length > 0,
    faultFieldRef,
  );
  const selectedFaultTags = draft.selectedFaultTags || [];
  const options = repairFaultOptions(draft.repairDeviceKind);

  function toggleFault(tag) {
    const next = selectedFaultTags.includes(tag)
      ? selectedFaultTags.filter((item) => item !== tag)
      : [...selectedFaultTags, tag];
    patch({
      selectedFaultTags: next,
      symptoms: next.join(', '),
    });
    setError('');
  }

  function continueToDetails() {
    if (!selectedFaultTags.length && !String(draft.faultDescription || '').trim()) {
      setError('Choose a fault type or add a short fault description.');
      return;
    }
    navigation.navigate('RepairDetails');
  }

  return (
    <FlowScreen
      title="Describe the Fault"
      steps={REPAIR_STEPS}
      step={2}
      onBack={() => navigation.goBack()}
      error={error}
    >
      <Text style={type.display} accessibilityRole="header">Describe the Fault</Text>
      <Text style={type.muted}>Select all that apply for {draft.repairDeviceLabel || 'your device'}.</Text>
      <View ref={faultFieldRef} collapsable={false} style={styles.faultGrid}>
        {options.map((fault) => (
          <RepairChoiceCard
            key={fault}
            title={fault}
            selected={selectedFaultTags.includes(fault)}
            onPress={() => {
              toggleFault(fault);
              faultField.activate(true);
            }}
            accessibilityRole="checkbox"
            style={styles.faultCard}
          />
        ))}
      </View>
      <TextField
        label="Error Code (optional)"
        value={draft.faultErrorCode || ''}
        onChangeText={(faultErrorCode) => patch({ faultErrorCode })}
        placeholder="e.g. F001, Err-04, OC fault"
        autoCapitalize="characters"
      />
      <TextField
        label="Description (optional)"
        value={draft.faultDescription || ''}
        onChangeText={(faultDescription) => patch({ faultDescription })}
        placeholder="Describe the fault in detail..."
        multiline
        maxLength={2000}
      />
      <Button title="Next — Device Details" onPress={continueToDetails} />
    </FlowScreen>
  );
}

const styles = StyleSheet.create({
  faultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  faultCard: {
    width: '48%',
    flexGrow: 0,
    flexShrink: 0,
  },
});
