import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../providers/AuthProvider';
import { apiService } from '../../services/api';
import { theme } from '../../components/theme';
import { AppHeader } from '../../components/AppHeader';
import { ApplicationStatusCard } from '../../components/ApplicationStatusCard';
import { AppButton } from '../../components/AppButton';
import { LoadingOverlay } from '../../components/LoadingOverlay';

interface StatusScreenProps {
  route: { params: { registrationId: string; status: string; message?: string } };
  navigation: any;
}

export const StatusScreen: React.FC<StatusScreenProps> = ({ route, navigation }) => {
  useUserPreferences();

  const { registrationId, status: initialStatus, message: initialMessage } = route.params;
  const [status, setStatus] = useState(initialStatus);
  const [message, setMessage] = useState(initialMessage);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    if (registrationId) {
      fetchStatus();
    }
  }, [registrationId]);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await apiService.getApplicationStatus(registrationId);
      setStatus(response.data.status || status);
      setMessage(response.data.message || message);
      setReason(response.data.reason || null);
    } catch (err: any) {
      // Use initial values if fetch fails
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.primaryBackground,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
    },
    card: {
      backgroundColor: theme.colors.mainCard,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing.xl,
      alignItems: 'center',
      ...theme.elevation.card,
    },
    buttonContainer: {
      marginTop: theme.spacing.lg,
      width: '100%',
      maxWidth: 600,
      alignSelf: 'center',
    },
    logoutButton: {
      marginTop: theme.spacing.lg,
      paddingVertical: 14,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      alignItems: 'center',
    },
    logoutText: {
      color: theme.colors.secondaryText,
      fontSize: 14,
      fontWeight: '600' as const,
    },
    heading: { color: theme.colors.mainText, fontSize: 24, lineHeight: 31, fontWeight: '800', letterSpacing: -0.4, textAlign: 'center' },
    subheading: { color: theme.colors.secondaryText, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5, marginBottom: theme.spacing.md },
    statusSurface: { backgroundColor: theme.colors.mainCard, borderRadius: 24, paddingVertical: theme.spacing.sm, maxWidth: 600, width: '100%', alignSelf: 'center', ...theme.elevation.card },
    timeline: { marginTop: theme.spacing.md, backgroundColor: theme.colors.primaryLight, borderRadius: 16, padding: theme.spacing.md, maxWidth: 600, width: '100%', alignSelf: 'center' },
    timelineTitle: { color: theme.colors.brandInk, fontSize: 13, fontWeight: '800' },
    timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
    timelineText: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 18, flex: 1 },
    refreshButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: theme.spacing.md, paddingVertical: 11 },
    refreshText: { color: theme.colors.primary, fontSize: 13, fontWeight: '700' },
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <LoadingOverlay visible={loading} text="Loading..." />
      <AppHeader title="Application Status" subtitle="Track your EnergyHub Partner application" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>{user?.mobile ? 'Your partner application' : 'Application overview'}</Text>
        <Text style={styles.subheading}>We’ll keep this page updated as your application moves through review.</Text>
        <View style={styles.statusSurface}>
          <ApplicationStatusCard status={status} message={message} reason={reason} />
        </View>
        <View style={styles.timeline}>
          <Text style={styles.timelineTitle}>What happens next</Text>
          <View style={styles.timelineRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.timelineText}>
              {status === 'approved'
                ? 'Your workspace is ready. Continue to the dashboard to start using EnergyHub.'
                : 'Our team verifies your details and documents. You’ll see any required action here.'}
            </Text>
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={fetchStatus} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={17} color={theme.colors.primary} />
            <Text style={styles.refreshText}>Refresh status</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.buttonContainer}>
          {status === 'approved' && (
            <AppButton title="Go to Dashboard" onPress={() => navigation.navigate('Home')} />
          )}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};