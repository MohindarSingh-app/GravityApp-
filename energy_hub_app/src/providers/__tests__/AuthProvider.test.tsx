import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { apiService } from '../../services/api';
import { AuthProvider, useAuth } from '../AuthProvider';

jest.mock('../../services/secureStorage', () => ({
  secureStorage: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

jest.mock('../../services/api', () => ({
  apiService: {
    setToken: jest.fn(async () => undefined),
    logout: jest.fn(async () => undefined),
  },
}));

const AuthProbe = () => {
  const { login, user } = useAuth();
  return (
    <>
      <Text>{user?.mobile || 'Signed out'}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={() => login('access-token', {
          id: '1',
          mobile: '9000000099',
          email: 'demo@energyhub.local',
          role: 'service_partner',
          status: 'approved',
          token: 'access-token',
          refreshToken: 'refresh-token',
        })}
      >
        <Text>Sign in</Text>
      </TouchableOpacity>
    </>
  );
};

describe('AuthProvider', () => {
  it('sets the API authorization token when a session is created', async () => {
    const screen = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await act(async () => {
      fireEvent.press(screen.getByText('Sign in'));
    });

    expect(apiService.setToken).toHaveBeenCalledWith('access-token');
    expect(screen.getByText('9000000099')).toBeTruthy();
  });
});
