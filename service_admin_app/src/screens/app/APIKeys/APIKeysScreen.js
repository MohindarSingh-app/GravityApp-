import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { apiKeyApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { DepthCard } from '../../../components/DepthCard';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { TextField } from '../../../components/TextField';
import { canManageApiKeys } from '../../../constants/catalog';
import { useAuth } from '../../../hooks/useAuth';
import { ConfirmDialog } from '../../../components/ui/Modal';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { formatWhen } from '../../../utils/format';

export function APIKeysScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, radius, type } = useTheme();
  const allowed = canManageApiKeys(user && user.role);
  const [keys, setKeys] = useState([]);
  const [name, setName] = useState('');
  const [revealed, setRevealed] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null);

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiKeyApi.list();
      setKeys(data.apiKeys || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [allowed]);

  useEffect(() => {
    load();
  }, [load]);

  async function createKey() {
    if (name.trim().length < 2) {
      setError('Key name must be at least 2 characters.');
      return;
    }
    setBusy(true);
    setError('');
    setRevealed('');
    try {
      const data = await apiKeyApi.create({ name: name.trim() });
      setRevealed(data.apiKey && data.apiKey.key ? data.apiKey.key : '');
      setName('');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function confirm(title, work) {
    setPending({ title, work });
  }

  async function runPending() {
    const next = pending;
    setPending(null);
    if (next && next.work) await next.work();
  }

  async function revoke(id) {
    setError('');
    try {
      await apiKeyApi.revoke(id);
      setRevealed('');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function rotate(id) {
    setError('');
    setRevealed('');
    try {
      const data = await apiKeyApi.rotate(id);
      setRevealed(data.apiKey && data.apiKey.key ? data.apiKey.key : '');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <Screen header={<AppBar title="API keys" onBack={() => navigation.goBack()} />} onRefresh={load} refreshing={loading && keys.length > 0}>
      <Text style={type.display} accessibilityRole="header">API keys</Text>
      <Text style={type.muted}>
        A full key is shown once, when it is created or rotated. Only a prefix is kept after that.
      </Text>
      {!allowed ? (
        <EmptyState title="Restricted" message="Only a Director / Owner or Maintenance Head can manage API keys." />
      ) : null}
      <Banner message={error} />
      {revealed ? (
        <View accessibilityLabel="New API key" style={[styles.secret, { backgroundColor: colors.warningSurface, borderRadius: radius.md }]}>
          <Text style={[type.label, { color: colors.warning }]}>Copy this key now</Text>
          <Text selectable style={[type.body, { color: colors.warning }]}>{revealed}</Text>
        </View>
      ) : null}
      {allowed ? (
        <>
          <TextField label="Key name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Button title="Create key" onPress={createKey} loading={busy} />
        </>
      ) : null}
      {loading ? <SkeletonStack /> : null}
      {!loading && allowed && keys.length === 0 ? (
        <EmptyState title="No keys" message="Create a key for a server or integration. It will not be shown again." />
      ) : null}
      {keys.map((item) => (
        <DepthCard
          key={item.id}
          tone={item.revokedAt ? 'repair' : 'project'}
          glyph="key"
          kicker={item.keyPrefix ? `${item.keyPrefix}…` : 'Key'}
          title={item.name || item.keyName}
          detail={item.revokedAt ? `Revoked ${formatWhen(item.revokedAt)}` : `Created ${formatWhen(item.createdAt)}`}
        >
          {!item.revokedAt ? (
            <View style={styles.row}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Rotate ${item.name || 'key'}`} onPress={() => confirm('Rotate key', () => rotate(item.id))} style={styles.hit}>
                <Text style={[styles.emphasis, { color: colors.accentText }]}>Rotate</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`Revoke ${item.name || 'key'}`} onPress={() => confirm('Revoke key', () => revoke(item.id))} style={styles.hit}>
                <Text style={[styles.emphasis, { color: colors.danger }]}>Revoke</Text>
              </Pressable>
            </View>
          ) : null}
        </DepthCard>
      ))}
      <ConfirmDialog
        visible={Boolean(pending)}
        title={pending ? pending.title : ''}
        description="This key will stop working."
        confirmLabel={pending ? pending.title : 'Confirm'}
        cancelLabel="Cancel"
        destructive
        onConfirm={runPending}
        onClose={() => setPending(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  secret: {
    padding: 14,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  hit: {
    minHeight: 44,
    justifyContent: 'center',
  },
  emphasis: {
    fontWeight: '600',
  },
});
