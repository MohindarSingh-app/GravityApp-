import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { describe, expect, it, jest } from '@jest/globals';
import { RegistrationFlowScreen } from '../RegistrationFlowScreen';
import { RegistrationProvider } from '../../../providers/RegistrationProvider';
import { UserPreferencesProvider } from '../../../providers/UserPreferencesProvider';
import { RootStackParamList } from '../../../navigation/RootNavigator';

jest.mock('../../../services/api', () => ({
  apiService: {
    getDocumentChecklist: () => Promise.resolve({ data: [] as Array<{ type: string; uploaded?: boolean }> }),
  },
}));

const Stack = createNativeStackNavigator<RootStackParamList>();

describe('RegistrationFlowScreen', () => {
  it('shows registration sections with stepper matching example.html', async () => {
    const screen = render(
      <UserPreferencesProvider>
        <RegistrationProvider>
          <NavigationContainer>
            <Stack.Navigator id="RegistrationStack">
              <Stack.Screen
                name="PersonalInfo"
                component={RegistrationFlowScreen}
                initialParams={{ registrationId: 'reg-1', mobile: '9876543210', email: 'partner@example.com' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </RegistrationProvider>
      </UserPreferencesProvider>
    );

    await waitFor(() => expect(screen.getByText('Personal')).toBeTruthy());
    expect(screen.getByText('Professional')).toBeTruthy();
    expect(screen.getByText('Documents')).toBeTruthy();
    expect(screen.getByText('Review')).toBeTruthy();
    expect(screen.getByText(/Step \d+ of 5/)).toBeTruthy();
    expect(screen.getByText('Current Address')).toBeTruthy();
    expect(screen.getByText('Emergency Contact Name')).toBeTruthy();
    expect(screen.getByText('Emergency Contact Phone')).toBeTruthy();
    expect(screen.getByText('Add profile photo')).toBeTruthy();
    expect(screen.getByText('Tell us about yourself')).toBeTruthy();
  });
});
