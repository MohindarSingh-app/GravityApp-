import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { UserPreferencesProvider } from '../../../providers/UserPreferencesProvider';
import { apiService } from '../../../services/api';
import { PartnerProfileScreen } from '../PartnerProfileScreen';
import { SpecializationsScreen } from '../SpecializationsScreen';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const ReactModule = require('react');
    ReactModule.useEffect(effect, []);
  },
}));

jest.mock('../../../providers/AuthProvider', () => ({
  useAuth: () => ({
    user: { role: 'service_partner', status: 'approved', mobile: '9999999999' },
    logout: jest.fn(),
    login: jest.fn(),
  }),
}));

jest.mock('../../../components/AppHeader', () => ({
  AppHeader: ({ title }: { title: string }) => {
    const ReactModule = require('react');
    const { Text } = require('react-native');
    return ReactModule.createElement(Text, null, title);
  },
  goBackOrHome: jest.fn(),
}));

describe('specialization profile screens', () => {
  it('saves one dirty card with the complete category payload and returns to profile', async () => {
    jest.spyOn(apiService, 'getProfile').mockResolvedValueOnce({
      data: { role: 'service_partner', registrationId: '42', specializations: { categories: {} } },
    });
    jest.spyOn(apiService, 'getDeliveryVerification').mockResolvedValueOnce({ data: { status: 'approved' } });
    const save = jest.spyOn(apiService, 'saveSpecializations').mockResolvedValueOnce({
      data: { specializationStatus: 'pending' },
    });
    const navigation = {
      getState: () => ({ routes: [{ name: 'PartnerProfile' }, { name: 'Specializations' }] }),
      navigate: jest.fn(),
    };
    const screen = render(
      <UserPreferencesProvider>
        <SpecializationsScreen navigation={navigation} />
      </UserPreferencesProvider>,
    );

    fireEvent.press(await screen.findByText('MCB / MCCB / RCCB'));
    fireEvent.press(screen.getByLabelText('Save Electrician'));

    await waitFor(() => expect(save).toHaveBeenCalled());
    const payload = save.mock.calls[0][1] as { categories: Record<string, unknown> };
    expect(Object.keys(payload.categories)).toHaveLength(6);
    expect(navigation.navigate).toHaveBeenCalledWith('PartnerProfile');
  });

  it('shows approved expertise separately from pending additions', async () => {
    jest.spyOn(apiService, 'getProfile').mockResolvedValueOnce({
      data: {
        role: 'service_partner',
        status: 'approved',
        specializationStatus: 'pending',
        specializations: {
          approvalStatus: 'pending',
          approvedCategories: {
            plcScada: { enabled: true, skills: ['Siemens'] },
          },
          categories: {
            plcScada: { enabled: true, skills: ['Siemens', 'Omron'] },
          },
        },
      },
    });
    const screen = render(
      <UserPreferencesProvider>
        <PartnerProfileScreen navigation={{ goBack: jest.fn(), navigate: jest.fn() }} />
      </UserPreferencesProvider>,
    );

    expect(await screen.findByText('Approved · active for matching')).toBeTruthy();
    expect(screen.getByText('Waiting for approval')).toBeTruthy();
    expect(screen.getByText('Siemens')).toBeTruthy();
    expect(screen.getByText('Omron')).toBeTruthy();
  });
});
