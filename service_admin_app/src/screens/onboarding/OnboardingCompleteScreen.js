import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { DepthCard } from '../../components/DepthCard';
import { FadeIn } from '../../components/FadeIn';
import { ProgressHeader } from '../../components/ProgressHeader';
import { Screen } from '../../components/Screen';
import { ONBOARDING } from '../../constants/onboarding';
import { roleLabel } from '../../constants/catalog';
import { useCatalog } from '../../flows/useCatalog';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../theme/ThemeContext';

export function OnboardingCompleteScreen() {
  const { company, user, dismissCelebration } = useAuth();
  const { type } = useTheme();
  useCatalog('account_role');

  return (
    <Screen footer={<Button title="Open dashboard" onPress={dismissCelebration} />}>
      <FadeIn>
        <View style={styles.block}>
          <ProgressHeader status={ONBOARDING.ONBOARDING_COMPLETED} />
          <Text style={type.display} accessibilityRole="header">You are ready</Text>
          <Text style={type.muted}>
            {company ? `${company.companyName} is set up` : 'The account is set up'}
            {user ? ` for ${user.fullName || roleLabel(user.role)}.` : '.'}
          </Text>
          <DepthCard
            tone="amc"
            glyph="spark"
            kicker="Saved with the account"
            title={company ? company.companyName : 'Company'}
            detail={`${company ? `${company.industry || 'Industry'} · ${company.city || 'City'}` : ''}${user ? ` · ${roleLabel(user.role)}` : ''}`}
          />
        </View>
      </FadeIn>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 16,
    paddingTop: 12,
  },
});
