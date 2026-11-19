import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { UserPreferencesProvider } from '../../../providers/UserPreferencesProvider';
import { apiService } from '../../../services/api';
import { JobDetailScreen } from '../JobDetailScreen';

jest.mock('../../../components/AppHeader', () => ({
  AppHeader: ({ title }: { title: string }) => {
    const ReactModule = require('react');
    const { Text } = require('react-native');
    return ReactModule.createElement(Text, null, title);
  },
  goBackOrHome: jest.fn(),
}));

describe('JobDetailScreen', () => {
  it('reveals the workflow inline after accepting without navigating away', async () => {
    const getJob = jest.spyOn(apiService, 'getJob')
      .mockResolvedValueOnce({ data: { id: 7, status: 'open', stage: 'open', referenceId: 'JOB-7' } })
      .mockResolvedValue({ data: { id: 7, status: 'accepted', stage: 'accepted', referenceId: 'JOB-7' } });
    const acceptJob = jest.spyOn(apiService, 'acceptJob')
      .mockResolvedValue({ data: { id: 7, status: 'accepted', stage: 'accepted', referenceId: 'JOB-7' } });

    const navigation = { canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() };
    const screen = render(
      <UserPreferencesProvider>
        <JobDetailScreen
          navigation={navigation}
          route={{ params: { jobId: 7, job: { id: 7, status: 'open', referenceId: 'JOB-7' } } }}
        />
      </UserPreferencesProvider>
    );

    fireEvent.press(await screen.findByText('Accept request'));
    await waitFor(() => expect(acceptJob).toHaveBeenCalledWith(7));
    expect(await screen.findByText('Check in at site')).toBeTruthy();
    expect(await screen.findByText('Job Workflow')).toBeTruthy();
    expect(navigation.navigate).not.toHaveBeenCalled();

    getJob.mockRestore();
    acceptJob.mockRestore();
  });
});
