import { StyleSheet, Text, View } from 'react-native';
import { ONBOARDING, ONBOARDING_STEPS, stepIndexForStatus } from '../constants/onboarding';
import { useTheme } from '../theme/ThemeContext';

export function ProgressHeader({ status, authenticated = true }) {
  const { colors } = useTheme();
  const index = stepIndexForStatus(status, authenticated);
  const finished = status === ONBOARDING.ONBOARDING_COMPLETED;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: ONBOARDING_STEPS.length, now: finished ? ONBOARDING_STEPS.length : index + 1 }}
      accessibilityLabel={`Onboarding, ${ONBOARDING_STEPS[index].label}, step ${index + 1} of ${ONBOARDING_STEPS.length}`}
      style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.labels}>
        <Text style={[styles.kicker, { color: colors.primary }]}>SETUP YOUR WORKSPACE</Text>
        <Text style={[styles.current, { color: colors.text }]}>
          {finished ? 'All set' : `${index + 1} of ${ONBOARDING_STEPS.length} · ${ONBOARDING_STEPS[index].label}`}
        </Text>
      </View>
      <View style={styles.track}>
        {ONBOARDING_STEPS.map((step, stepIndex) => (
          <View
            key={step.key}
            style={[
              styles.segment,
              { backgroundColor: finished || stepIndex <= index ? colors.primary : colors.surfaceTertiary },
            ]}
          />
        ))}
      </View>
      <View style={styles.steps}>
        {ONBOARDING_STEPS.map((step, stepIndex) => {
          const done = finished || stepIndex < index;
          const active = !finished && stepIndex === index;
          return (
            <Text
              key={step.key}
              style={[
                styles.label,
                { color: active || done ? colors.primary : colors.textTertiary },
              ]}
              numberOfLines={1}
            >
              {done ? '✓ ' : ''}{step.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    padding: 16,
    borderWidth: 1.5,
    borderRadius: 22,
  },
  labels: {
    gap: 3,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  current: {
    fontSize: 16,
    fontWeight: '800',
  },
  track: {
    height: 7,
    flexDirection: 'row',
    gap: 5,
  },
  segment: {
    flex: 1,
    borderRadius: 8,
  },
  steps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
  },
});
