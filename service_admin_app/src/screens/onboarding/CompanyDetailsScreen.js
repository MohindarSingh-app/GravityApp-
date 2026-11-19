import { useNavigation, useRoute } from '@react-navigation/native';
import { Text } from 'react-native';
import { companyApi } from '../../api/resources';
import { AppBar } from '../../components/AppBar';
import { CompanyForm } from '../../components/forms/CompanyForm';
import { ProgressHeader } from '../../components/ProgressHeader';
import { Screen } from '../../components/Screen';
import { ONBOARDING } from '../../constants/onboarding';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../theme/ThemeContext';

export function CompanyDetailsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const {
    company, onboardingStatus, refreshAccount, newCompanyRegistration, logout,
  } = useAuth();
  const { type } = useTheme();
  const settings = route.name === 'Company';

  async function goBack() {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    await logout();
  }

  async function onSubmit(payload) {
    const body = {
      companyName: payload.companyName,
      gst: payload.gst,
      industry: payload.industry,
      city: payload.city,
    };
    if (newCompanyRegistration && company && company.id) {
      await companyApi.create({ ...body, copyFromCompanyId: company.id });
    } else if (company && company.id) {
      await companyApi.update(company.id, body);
    } else {
      await companyApi.create(body);
    }
    await refreshAccount();
    if (!settings) navigation.navigate('Sites');
  }

  return (
    <Screen
      header={(
        <AppBar
          title="Company Details"
          onBack={settings ? () => navigation.goBack() : undefined}
        />
      )}
    >
      {settings ? null : (
        <ProgressHeader
          status={newCompanyRegistration ? ONBOARDING.COMPANY_PENDING : onboardingStatus}
        />
      )}
      <Text style={type.display} accessibilityRole="header">Company details</Text>
      <Text style={type.muted}>
        {settings
          ? 'Edits are saved to the currently selected company workspace.'
          : newCompanyRegistration
            ? 'Your saved company details are copied into a new workspace. Changes here will not edit the original company.'
            : 'Just once — auto-filled in every booking.'}
      </Text>
      <CompanyForm
        key={company ? company.id : 'new'}
        initial={company ? {
          companyName: company.companyName || '',
          gst: company.gstNumber || company.gst || '',
          industry: company.industry || '',
          city: company.city || '',
          companySize: company.companySize || '',
          contactName: company.contactName || '',
        } : undefined}
        submitLabel={settings ? 'Save company' : 'Next ›'}
        onBack={settings ? undefined : goBack}
        onSubmit={onSubmit}
      />
    </Screen>
  );
}
