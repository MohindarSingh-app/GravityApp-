import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { OtpScreen } from '../OtpScreen';
import { UserPreferencesProvider } from '../../../providers/UserPreferencesProvider';

const mockLogin = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockVerifyOtp = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('../../../providers/AuthProvider', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

jest.mock('../../../services/api', () => ({
  apiService: { verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args) },
}));

describe('OtpScreen', () => {
  it('routes a provisioned administrator to dispatcher scheduling', async () => {
    mockLogin.mockResolvedValue(undefined);
    mockVerifyOtp.mockResolvedValue({
      success: true,
      data: {
        token: 'admin-token',
        refreshToken: 'admin-refresh-token',
        user: {
          id: 8,
          mobile: '9000000015',
          email: 'admin@example.com',
          role: 'admin',
          status: 'approved',
        },
        requiresRegistration: false,
      },
    });
    const navigation = { replace: jest.fn() };
    const screen = render(
      <UserPreferencesProvider>
        <OtpScreen
          route={{ params: { mobile: '9000000015', purpose: 'login' } }}
          navigation={navigation}
        />
      </UserPreferencesProvider>
    );

    fireEvent.changeText(screen.getByLabelText('One-time password'), '123456');
    fireEvent.press(screen.getByText('Verify & Continue'));

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('AdminSchedule'));
  });
});
