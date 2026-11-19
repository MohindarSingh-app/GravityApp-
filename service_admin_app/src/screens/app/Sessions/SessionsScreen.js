import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { sessionApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { DepthCard } from '../../../components/DepthCard';
import { EmptyState } from '../../../components/EmptyState';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { formatWhen } from '../../../utils/format';

export function SessionsScreen() {
  const navigation = useNavigation();
  const { colors, type } = useTheme();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await sessionApi.list();
      setSessions(data.sessions || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function revoke(session) {
    setPending(session);
  }

  async function confirmRevoke() {
    const session = pending;
    setPending(null);
    if (!session) return;
    try {
      await sessionApi.revoke(session.id);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const visible = sessions.filter((session) => !session.revoked);

  return (
    <Screen header={<AppBar title="Sessions" onBack={() => navigation.goBack()} />} onRefresh={load} refreshing={loading && sessions.length > 0}>
      <Text style={type.display} accessibilityRole="header">Sessions</Text>
      <Text style={type.muted}>Active refresh sessions for this account. End this one from Security.</Text>
      <Banner message={error} />
      {loading && sessions.length === 0 ? <SkeletonStack /> : null}
      {!loading && visible.length === 0 ? (
        <EmptyState title="No active sessions" message="Sign in again if this list is empty after a refresh." />
      ) : null}
      {visible.map((session) => (
        <DepthCard
          key={session.id}
          tone={session.current ? 'amc' : 'transit'}
          glyph="device"
          kicker={session.current ? 'This device' : 'Other device'}
          title={session.deviceName || 'Unknown device'}
          detail={`Last used ${formatWhen(session.lastUsedAt || session.createdAt)}${session.ipAddress ? ` · ${session.ipAddress}` : ''}`}
        >
          {!session.current ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Revoke session" onPress={() => revoke(session)} style={styles.hit}>
              <Text style={[styles.emphasis, { color: colors.danger }]}>Revoke</Text>
            </Pressable>
          ) : null}
        </DepthCard>
      ))}
      <ConfirmDialog
        visible={Boolean(pending)}
        title="Revoke session"
        description="That device will need to sign in again."
        confirmLabel="Revoke"
        cancelLabel="Cancel"
        destructive
        onConfirm={confirmRevoke}
        onClose={() => setPending(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    justifyContent: 'center',
  },
  emphasis: {
    fontWeight: '600',
  },
});
