import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { customerApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { DatePickerField } from '../../../components/DatePickerField';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { TextField } from '../../../components/TextField';
import {
  buildReschedule,
  canReschedule,
  labelStatus,
  submittedReschedule,
  todayStamp,
  validateReschedule,
} from '../../../flows/customerFlow';
import { useCatalog } from '../../../flows/useCatalog';
import { useFlowDraft } from '../../../flows/FlowDraft';
import { useSubmit } from '../../../flows/useSubmit';
import { useTheme } from '../../../theme/ThemeContext';
import { fieldErrors, getErrorMessage } from '../../../utils/errors';

function formatDate(value, options = {}) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-IN', options);
}

export function AmcRescheduleScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, radius, type } = useTheme();
  const { draft, patch, clear } = useFlowDraft();
  const { phase, submit } = useSubmit();
  const contractId = route.params && route.params.contractId;
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const catalog = useCatalog('amc_reschedule_reason', 'amc_visit_time');
  const reasons = catalog.groups.amc_reschedule_reason.map((item) => item.label);
  const visitTimes = catalog.groups.amc_visit_time.map((item) => item.label);

  const load = useCallback(async () => {
    if (!contractId) {
      setError('Open reschedule from a contract that has a visit.');
      setLoading(false);
      return;
    }
    setError('');
    try {
      const data = await customerApi.contract(contractId);
      const current = (data && data.contract) || null;
      if (!current) throw new Error('The AMC contract details were not returned.');
      setContract(current);
      const preferredTime = current.visitSchedule && current.visitSchedule.preferredTime;
      if (draft.rescheduleContractId !== current.id) {
        patch({
          rescheduleContractId: current.id,
          requestedNewDate: '',
          requestedNewTime: String(preferredTime || '').slice(0, 5),
          reason: '',
          notes: '',
        });
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [contractId, draft.rescheduleContractId, patch]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const currentDate = contract && contract.visitSchedule && contract.visitSchedule.nextVisitDate;
  const ready = canReschedule(contract);

  async function onSubmit() {
    if (!ready) return;
    const local = validateReschedule(draft, currentDate);
    if (local) {
      setErrors(local);
      setError('');
      return;
    }
    setErrors({});
    const { result, error: submitError } = await submit(
      () => customerApi.createReschedule(buildReschedule(contract, draft)),
    );
    if (submitError) {
      setErrors(fieldErrors(submitError));
      setError(getErrorMessage(submitError));
      return;
    }
    if (!submittedReschedule(result)) {
      setError('The service did not confirm this reschedule.');
      return;
    }
    const reschedule = {
      ...result.reschedule,
      contractNumber: contract.contractNumber,
      contractTitle: labelStatus(contract.amcType || contract.contractType),
    };
    clear();
    navigation.navigate('AmcConfirmation', { reschedule });
  }

  return (
    <Screen
      header={<AppBar title="Reschedule Visit" onBack={() => navigation.goBack()} />}
      headerColor={colors.background}
      refreshing={loading && Boolean(contract)}
      onRefresh={load}
      footer={ready ? (
        <Button
          title="Submit Reschedule Request ›"
          loading={phase === 'submitting'}
          onPress={onSubmit}
        />
      ) : null}
    >
      {error ? <Banner message={error} tone="warning" /> : null}
      {loading && !contract ? <SkeletonStack rows={4} /> : null}
      {contract && !ready ? (
        <Text style={type.muted}>This contract has no scheduled visit, so there is nothing to move.</Text>
      ) : null}
      {ready ? (
        <>
          <View style={[styles.infoCard, { backgroundColor: colors.infoSurface, borderColor: colors.info, borderRadius: radius.card }]}>
            <View style={[styles.infoIcon, { backgroundColor: colors.surface, borderRadius: radius.sm }]}>
              <Glyph name="calendar" color={colors.info} size={19} />
            </View>
            <View style={styles.infoCopy}>
              <Text style={[type.heading, { color: colors.text }]}>Reschedule AMC Visit</Text>
              <Text style={[type.small, { color: colors.textSecondary }]}>
                Request another slot for your next AMC visit. Our team will review your request.
              </Text>
            </View>
          </View>

          <View style={[styles.currentVisit, { backgroundColor: colors.primaryLight, borderColor: colors.primarySoft, borderRadius: radius.card }]}>
            <Text style={[type.small, styles.currentLabel, { color: colors.primary }]}>Currently scheduled</Text>
            <View style={styles.currentDateRow}>
              <Glyph name="calendar" color={colors.primary} size={17} />
              <Text style={[type.heading, { color: colors.text }]}>
                {formatDate(currentDate, { day: '2-digit', month: 'long', year: 'numeric' })}
                {contract.visitSchedule && contract.visitSchedule.preferredTime
                  ? ` — ${contract.visitSchedule.preferredTime}`
                  : ''}
              </Text>
            </View>
            <Text style={[type.small, { color: colors.textSecondary }]} numberOfLines={2}>
              {[
                contract.assignedService && contract.assignedService.engineerName
                  ? `Engineer: ${contract.assignedService.engineerName}`
                  : '',
                contract.coverage,
              ].filter(Boolean).join(' · ')}
            </Text>
          </View>

          <Text style={[type.label, { color: colors.textSecondary }]}>NEW PREFERRED SCHEDULE</Text>
          <View style={styles.scheduleRow}>
            <View style={styles.scheduleField}>
              <DatePickerField
                label="DATE"
                value={draft.requestedNewDate || ''}
                onChange={(requestedNewDate) => patch({ requestedNewDate })}
                minDate={contract.startDate && contract.startDate > todayStamp()
                  ? contract.startDate
                  : todayStamp()}
                maxDate={contract.endDate}
                disabledDates={[currentDate]}
                error={errors.requestedNewDate}
              />
            </View>
            <View style={styles.scheduleField}>
              <Text style={[type.small, styles.fieldLabel, { color: colors.textSecondary }]}>TIME</Text>
              <View style={styles.timeChoices}>
                {visitTimes.map((time) => {
                  const selected = draft.requestedNewTime === time;
                  return (
                    <Pressable
                      key={time}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => patch({ requestedNewTime: time })}
                      style={[
                        styles.timeChoice,
                        {
                          backgroundColor: selected ? colors.primaryLight : colors.surface,
                          borderColor: selected ? colors.primary : colors.border,
                          borderRadius: radius.sm,
                        },
                      ]}
                    >
                      <Text style={[styles.choiceText, { color: selected ? colors.primary : colors.text }]}>{time}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {errors.requestedNewTime ? (
                <Text style={[styles.error, { color: colors.danger }]}>{errors.requestedNewTime}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.reasonSection}>
            <Text style={[type.label, { color: colors.textSecondary }]}>REASON</Text>
            <View style={styles.reasonChoices}>
              {reasons.map((reason) => {
                const selected = draft.reason === reason;
                return (
                  <Pressable
                    key={reason}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => patch({ reason })}
                    style={[
                      styles.reasonChoice,
                      {
                        backgroundColor: selected ? colors.primaryLight : colors.surface,
                        borderColor: selected ? colors.primary : colors.borderStrong,
                        borderRadius: radius.pill,
                      },
                    ]}
                  >
                    <Text style={[styles.choiceText, { color: selected ? colors.primary : colors.textSecondary }]}>
                      {reason}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.reason ? <Text style={[styles.error, { color: colors.danger }]}>{errors.reason}</Text> : null}
          </View>

          <TextField
            label="ADDITIONAL NOTES (OPTIONAL)"
            value={draft.notes || ''}
            onChangeText={(notes) => patch({ notes })}
            placeholder="Add any helpful details for our service team"
            multiline
            error={errors.notes}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 13,
    borderWidth: 1,
  },
  infoIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCopy: {
    flex: 1,
    gap: 4,
  },
  currentVisit: {
    gap: 5,
    padding: 13,
    borderWidth: 1,
  },
  currentLabel: {
    fontWeight: '700',
  },
  currentDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  scheduleField: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  timeChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  timeChoice: {
    minWidth: 48,
    minHeight: 37,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  reasonSection: {
    gap: 8,
  },
  reasonChoices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonChoice: {
    minHeight: 38,
    paddingHorizontal: 13,
    justifyContent: 'center',
    borderWidth: 1,
  },
  choiceText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  error: {
    fontSize: 12,
    fontWeight: '600',
  },
});
