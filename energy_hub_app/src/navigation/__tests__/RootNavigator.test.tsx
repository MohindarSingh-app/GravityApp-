import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import { RootNavigator } from '../RootNavigator';
import { UserPreferencesProvider } from '../../providers/UserPreferencesProvider';

const mockAuthState = {
  isLoading: true,
  isAuthenticated: false,
  user: null as any,
  previewRole: null as any,
  setPreviewRole: jest.fn(),
  logout: jest.fn(),
};

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('../../services/api', () => ({
  apiService: {
    initialize: jest.fn(),
    getDashboardData: () => Promise.resolve({ data: { stats: {}, activeJobs: [], profile: {} } }),
    listOpenJobs: () => Promise.resolve({ data: [] }),
    listNotifications: () => Promise.resolve({ data: [
      { id: 'notice-1', title: 'New matched request', body: 'A new service request is ready.', isRead: false },
      { id: 'notice-2', title: 'Old update', body: 'This update has been read.', isRead: true },
    ] }),
    markNotificationRead: () => Promise.resolve({ data: { success: true } }),
    listProducts: () => Promise.resolve({ data: [] }),
    listMyProducts: () => Promise.resolve({ data: [] }),
    listAdminSchedule: () => Promise.resolve({ data: [
      {
        id: 31,
        referenceId: 'DEMO-ADMIN-001',
        title: 'VFD inspection',
        jobType: 'service',
        status: 'accepted',
        siteArea: 'Jaipur',
        assignedPartnerBusinessName: 'Test Services',
        scheduledAt: null,
      },
    ] }),
    setJobSchedule: jest.fn(() => Promise.resolve({ data: { scheduledAt: '2026-10-28T04:30:00.000Z' } })),
    listExpertiseReviews: () => Promise.resolve({ data: [] }),
    listMyJobs: () => Promise.resolve({ data: [
      {
        id: 21,
        referenceId: 'DEMO-SVC-2026-001',
        title: 'VFD Wiring — Compressor Room',
        equipment: 'VFD Drive',
        customerName: 'Anita Sharma',
        customerCompany: 'Rajasthan Motors',
        siteArea: 'Vishwakarma Industrial Area',
        status: 'in_progress',
        stage: 'checked_in',
        basePay: 1400,
        startedAt: '2026-10-27T10:30:00+05:30',
        estimatedDurationHours: 3,
        repairCenterRecommended: true,
      },
      { id: 22, status: 'completed' },
      { id: 23, status: 'completed' },
      { id: 24, status: 'completed' },
    ] }),
    listEarnings: () => Promise.resolve({ data: [{
      id: 51,
      jobId: 5,
      source: 'service',
      status: 'pending',
      netAmount: 1850,
      createdAt: new Date().toISOString(),
    }] }),
    getEarningsSummary: () => Promise.resolve({
      data: { totalNet: 1850, pendingAmount: 1850, counts: { total: 1 } },
    }),
    getProfile: () => Promise.resolve({
      data: { role: 'service_partner', fullName: 'Test Partner', isOnline: false, isBusy: false, jobsCompleted: 3, rating: 4.8, roleAccounts: [{ role: 'service_partner', status: 'approved', userId: 1 }] },
    }),
  },
}));

jest.mock('../../providers/AuthProvider', () => ({
  useAuth: () => mockAuthState,
}));

jest.mock('../../providers/RegistrationProvider', () => ({
  RegistrationProvider: ({ children }: { children: React.ReactNode }) => children,
  useRegistration: () => ({
    draft: null,
    isReady: true,
    saveDraft: () => Promise.resolve(),
    loadDraft: () => Promise.resolve(null),
    clearDraft: () => Promise.resolve(),
  }),
}));

describe('RootNavigator', () => {
  const renderNavigator = () => render(
    <UserPreferencesProvider>
      <RootNavigator />
    </UserPreferencesProvider>
  );

  it('renders the splash route while restoring a session', () => {
    mockAuthState.isLoading = true;
    mockAuthState.isAuthenticated = false;
    mockAuthState.user = null;
    const screen = renderNavigator();
    expect(screen.getByLabelText('Loading EnergyHub')).toBeTruthy();
    expect(screen.getByLabelText('Gravity Hub logo')).toBeTruthy();
    expect(screen.queryByText('EH')).toBeNull();
  });

  it('shows the real logo instead of the EH placeholder on the welcome screen', async () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = false;
    mockAuthState.user = null;
    const screen = renderNavigator();

    expect(await screen.findByLabelText('Gravity Hub logo')).toBeTruthy();
    expect(screen.queryByText('EH')).toBeNull();
  });

  it('mounts authenticated marketplace routes for a restored session', async () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { id: '1', mobile: '9876543210', role: 'service_partner', status: 'approved' };
    const screen = renderNavigator();
    await waitFor(() => expect(screen.getByLabelText('Home')).toBeTruthy());
    expect(screen.getByText('Good day,')).toBeTruthy();
    expect(screen.getByLabelText('New Jobs')).toBeTruthy();
    expect(screen.getByLabelText('Active')).toBeTruthy();
    expect(screen.getByLabelText('Earnings')).toBeTruthy();
    expect(screen.queryByLabelText('Schedule')).toBeNull();
    expect(screen.getByLabelText('Profile')).toBeTruthy();
    expect(screen.getByText('Service work overview')).toBeTruthy();
  });

  it('routes a pre-provisioned admin to the dispatcher schedule module', async () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { id: '9', mobile: '9000000015', role: 'admin', status: 'approved' };
    const screen = renderNavigator();

    expect(await screen.findByText('Dispatcher schedule')).toBeTruthy();
    expect(screen.getByText('VFD inspection')).toBeTruthy();
    expect(screen.getByText(/DEMO-ADMIN-001 · Test Services · Jaipur/)).toBeTruthy();
    expect(screen.getByLabelText('Schedule')).toBeTruthy();
    expect(screen.queryByText('Good day,')).toBeNull();

    fireEvent.changeText(screen.getByLabelText('Appointment date for DEMO-ADMIN-001'), '2026-10-28');
    fireEvent.changeText(screen.getByLabelText('Appointment time for DEMO-ADMIN-001'), '10:00');
    fireEvent.press(screen.getByText('Save appointment'));
    await waitFor(() => expect(screen.getByText(/Appointment saved/)).toBeTruthy());
  });

  it('opens the partner profile from the home header', async () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { id: '1', mobile: '9876543210', role: 'service_partner', status: 'approved' };
    const screen = renderNavigator();

    fireEvent.press(screen.getByLabelText('Open partner profile'));
    expect(await screen.findByText('My Profile')).toBeTruthy();
  });

  it('opens schedule as a tab inside the active service-partner destination', async () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { id: '1', mobile: '9876543210', role: 'service_partner', status: 'approved' };
    const screen = renderNavigator();

    expect(screen.queryByLabelText('Schedule')).toBeNull();
    fireEvent.press(screen.getByLabelText('Active'));
    expect(await screen.findByLabelText('Active jobs tab')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Schedule tab'));
    await waitFor(() => expect(screen.getByText('TIME TO BE CONFIRMED')).toBeTruthy());
  });

  it('provides logout from the partner profile screen', async () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { id: '1', mobile: '9876543210', role: 'service_partner', status: 'approved' };
    mockAuthState.logout.mockClear();
    const screen = renderNavigator();

    fireEvent.press(screen.getByLabelText('Open partner profile'));
    expect(await screen.findByText('My Profile')).toBeTruthy();
    fireEvent.press(screen.getByText('Logout'));

    await waitFor(() => expect(mockAuthState.logout).toHaveBeenCalledTimes(1));
  });

  it('shows live earnings periods and filters service versus delivery', async () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { id: '1', mobile: '9876543210', role: 'service_partner', status: 'approved' };
    const screen = renderNavigator();

    fireEvent.press(screen.getByLabelText('Earnings'));

    expect(await screen.findByText('Today')).toBeTruthy();
    expect(screen.getByText('This week')).toBeTruthy();
    expect(screen.getByText('This month')).toBeTruthy();
    expect(screen.getAllByText('₹1,850').length).toBeGreaterThan(0);
    expect(screen.getByText('Service payout')).toBeTruthy();
    expect(screen.getByText(/Job #5/)).toBeTruthy();
    fireEvent.press(screen.getByText('Delivery'));
    expect(await screen.findByText('No delivery earnings yet')).toBeTruthy();
  });

  it('returns to the dashboard using the screen back action', async () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { id: '1', mobile: '9876543210', role: 'service_partner', status: 'approved' };
    const screen = renderNavigator();

    fireEvent.press(screen.getByLabelText('Active'));
    await waitFor(() => expect(screen.getAllByText('VFD Wiring — Compressor Room').length).toBeGreaterThan(0));
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getByText('Rating')).toBeTruthy();
    expect(screen.getByText(/Started .* · Est\. 3 hrs/)).toBeTruthy();
    expect(screen.getByLabelText('Schedule tab')).toBeTruthy();
    expect(screen.getByText('₹1,850')).toBeTruthy();
    expect(screen.getByText(/Repair recommendation — DEMO-SVC-2026-001/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Go back'));

    await waitFor(() => expect(screen.getByText('Good day,')).toBeTruthy());
  });

  it('opens the incoming hardware screen from a repairing partner dashboard', async () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { id: '1', mobile: '9876543210', role: 'repairing_partner', status: 'approved' };
    const screen = renderNavigator();

    fireEvent.press(screen.getByLabelText('Incoming'));

    expect(screen.getByText('Workshop intake')).toBeTruthy();
    expect(screen.getByText('New requests')).toBeTruthy();
  });

  it('opens the supplier product form as a separate screen', async () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { id: '1', mobile: '9876543210', role: 'supplier', status: 'approved' };
    const screen = renderNavigator();

    fireEvent.press(screen.getByLabelText('Catalog'));
    expect(await screen.findByText('+ Add product')).toBeTruthy();
    fireEvent.press(screen.getByText('+ Add product'));

    expect(await screen.findByText('Manage supplier listing details')).toBeTruthy();
    expect(screen.getByText('Product images')).toBeTruthy();
    expect(screen.getByText('Save product')).toBeTruthy();
  });

  it('shows role-specific bottom navigation for a panel maker', async () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { id: '1', mobile: '9876543210', role: 'panel_maker', status: 'approved' };
    const screen = renderNavigator();

    await waitFor(() => expect(screen.getByLabelText('New Requests')).toBeTruthy());
    expect(screen.getByLabelText('Home')).toBeTruthy();
    expect(screen.getByLabelText('Queue')).toBeTruthy();
    expect(screen.getByLabelText('Earnings')).toBeTruthy();
    expect(screen.getByLabelText('Profile')).toBeTruthy();
    expect(screen.queryByLabelText('Schedule')).toBeNull();
    fireEvent.press(screen.getByLabelText('Queue'));
    expect(await screen.findByText('Currently fabricating')).toBeTruthy();
    expect(screen.queryByText('Schedule')).toBeNull();
  });

  it('renders the profile edit entry and logout from the profile screen', async () => {
    mockAuthState.isLoading = false;
    mockAuthState.isAuthenticated = true;
    mockAuthState.user = { id: '1', mobile: '9876543210', role: 'service_partner', status: 'approved' };
    mockAuthState.previewRole = null;
    const screen = renderNavigator();

    fireEvent.press(screen.getByLabelText('Open partner profile'));
    await waitFor(() => expect(screen.getByText('Edit personal details')).toBeTruthy());
    expect(screen.getByText('Logout')).toBeTruthy();
  });
});