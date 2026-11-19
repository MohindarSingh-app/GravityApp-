import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { LoginScreen } from '../LoginScreen';
import { UserPreferencesProvider } from '../../../providers/UserPreferencesProvider';

jest.mock('../../../providers/AuthProvider', () => ({
  useAuth: () => ({ login: jest.fn() }),
}));

jest.mock('../../../services/api', () => ({
  apiService: { loginRequestOtp: jest.fn() },
}));

describe('LoginScreen', () => {
  const renderLogin = (navigation: { navigate: jest.Mock }) => render(
    <UserPreferencesProvider>
      <LoginScreen navigation={navigation} />
    </UserPreferencesProvider>
  );

  it('renders the sign-in form and auth hero', () => {
    const navigation = { navigate: jest.fn() };
    const screen = renderLogin(navigation);
    expect(screen.getByText('Make every field visit count')).toBeTruthy();
    expect(screen.getByText('Send OTP')).toBeTruthy();
    expect(screen.getByText('Secure OTP login · one mobile account')).toBeTruthy();
    expect(screen.getByLabelText('Service Partner, 9000000099')).toBeTruthy();
  });

  it('fills the selected demo mobile number into the sign-in form', () => {
    const navigation = { navigate: jest.fn() };
    const screen = renderLogin(navigation);

    fireEvent.press(screen.getByLabelText('Panel Maker, 9000000097'));

    expect(screen.getByDisplayValue('9000000097')).toBeTruthy();
  });
});