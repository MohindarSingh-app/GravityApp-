import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { catalogApi } from '../../../api/resources';
import { Button } from '../../../components/Button';
import { FlowScreen } from '../../../components/FlowScreen';
import { TextField } from '../../../components/TextField';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useCatalog } from '../../../flows/useCatalog';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { RepairChoiceCard } from './RepairChoiceCard';
import { repairModelHint, REPAIR_STEPS } from './repairFlow';

export function RepairMakeScreen() {
  const navigation = useNavigation();
  const { type } = useTheme();
  const { draft, patch } = useFlowDraft();
  const { groups, loading, error: catalogError, reload } = useCatalog('manufacturer');
  const [error, setError] = useState('');
  const [addingMake, setAddingMake] = useState(false);
  const [newMake, setNewMake] = useState('');
  const [savingMake, setSavingMake] = useState(false);
  const [saveError, setSaveError] = useState('');
  const deviceLabel = draft.repairDeviceLabel || 'device';
  const makes = groups.manufacturer || [];

  useFocusEffect(useCallback(() => {
    reload(true);
  }, [reload]));

  function selectMake(make) {
    if (draft.repairMake === make) return;
    const resetFaultDetails = draft.recommendedRepairFlow ? {} : {
      selectedFaultTags: [],
      symptoms: '',
      faultDescription: '',
      faultErrorCode: '',
      errorCode: '',
      issueDescription: '',
      faultInformation: '',
      faultFrequency: '',
      downtimeLoss: '',
    };
    patch({
      repairMake: make,
      manufacturer: make === 'Other Make' ? '' : make,
      model: '',
      ...resetFaultDetails,
      hmiScreenSize: '',
      hmiScreenSizeOther: '',
      warrantyStatus: '',
      pendingAttachments: [],
      repairLogistics: '',
      repairLogisticsLabel: '',
    });
    setError('');
  }

  function continueToFault() {
    const manufacturer = String(draft.manufacturer || '').trim();
    if (!manufacturer) {
      setError('Choose a make or enter the manufacturer name.');
      return;
    }
    patch({ manufacturer });
    navigation.navigate('RepairFault');
  }

  async function saveMake() {
    setSaveError('');
    const name = newMake.trim().replace(/\s+/g, ' ');
    if (!name) {
      setSaveError('Enter a make or brand name.');
      return;
    }
    setSavingMake(true);
    try {
      const result = await catalogApi.addManufacturer(name);
      const manufacturer = result && result.manufacturer;
      if (!manufacturer || !manufacturer.label) {
        throw new Error('The service did not save this make or brand.');
      }
      await reload(true);
      selectMake(manufacturer.label);
      setNewMake('');
      setAddingMake(false);
    } catch (err) {
      setSaveError(getErrorMessage(err));
    } finally {
      setSavingMake(false);
    }
  }

  return (
    <FlowScreen
      title="Select Make / Brand"
      steps={REPAIR_STEPS}
      step={1}
      onBack={() => navigation.goBack()}
      error={error || catalogError}
    >
      <Text style={type.display} accessibilityRole="header">Select Make / Brand</Text>
      <Text style={type.muted}>Choose the make of your {deviceLabel}.</Text>
      {loading && makes.length === 0 ? <Text style={type.muted}>Loading shared make list…</Text> : null}
      <View style={styles.makeGrid}>
        {makes.map((item) => {
          const make = item.label;
          return (
            <View key={make} style={styles.makeCell}>
              <RepairChoiceCard
                title={make}
                selected={draft.repairMake === make}
                onPress={() => selectMake(make)}
                accessibilityRole="radio"
              />
            </View>
          );
        })}
      </View>
      {!addingMake ? (
        <Button
          title="+ Add a new make / brand"
          variant="secondary"
          onPress={() => {
            setSaveError('');
            setAddingMake(true);
          }}
        />
      ) : (
        <>
          <TextField
            label="New make / brand name"
            value={newMake}
            onChangeText={setNewMake}
            error={saveError}
            placeholder="Enter manufacturer name"
            autoCapitalize="words"
          />
          <Button title="Save and select" loading={savingMake} onPress={saveMake} />
          <Button
            title="Cancel"
            variant="ghost"
            disabled={savingMake}
            onPress={() => {
              setAddingMake(false);
              setNewMake('');
              setSaveError('');
            }}
          />
        </>
      )}
      <TextField
        label="Model Number (optional)"
        value={draft.model || ''}
        onChangeText={(model) => patch({ model })}
        placeholder={repairModelHint(draft.repairMake)}
        hint="Find the model on the device nameplate if available."
        autoCapitalize="characters"
      />
      <Button title="Next — Describe the Fault" onPress={continueToFault} />
    </FlowScreen>
  );
}

const styles = {
  makeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  makeCell: {
    width: '48%',
  },
};
