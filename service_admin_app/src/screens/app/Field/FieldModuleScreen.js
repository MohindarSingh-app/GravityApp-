import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { fieldApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { DepthCard } from '../../../components/DepthCard';
import { EmptyState } from '../../../components/EmptyState';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { TextField } from '../../../components/TextField';
import {
  canManageCerts, canUpdateJobs, canUseMarketplace,
} from '../../../constants/catalog';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { formatWhen } from '../../../utils/format';
import { jobStatusLabel } from '../Dashboard/dashboardView';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function expiryIso(value) {
  const text = String(value || '').trim();
  if (!DATE.test(text)) return '';
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  const [year, month, day] = text.split('-').map(Number);
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return '';
  return parsed.toISOString();
}

const TITLES = {
  Emergency: 'Emergency',
  Jobs: 'Jobs',
  Amc: 'AMC',
  Projects: 'Projects',
  Marketplace: 'Marketplace',
  Compliance: 'Compliance',
  RepairCenter: 'Repair center',
  Expert: 'Talk to an expert',
};

export function FieldModuleScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();
  const { type } = useTheme();
  const mode = route.name;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      if (mode === 'Emergency') {
        const data = await fieldApi.signals('emergency');
        setRows(data.signals || []);
      } else if (mode === 'Jobs') {
        const data = await fieldApi.jobs();
        setRows(data.jobs || []);
      } else if (mode === 'Marketplace') {
        const data = await fieldApi.products();
        setRows(data.products || []);
      } else if (mode === 'Compliance') {
        const data = await fieldApi.certs();
        setRows(data.certs || []);
      } else {
        setRows([]);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  async function submit(action) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      setTitle('');
      setDetail('');
      setNotice('Saved.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const role = user && user.role;

  return (
    <Screen
      header={<AppBar title={TITLES[mode] || 'Field'} onBack={() => navigation.goBack()} />}
      refreshing={loading && rows.length > 0}
      onRefresh={load}
    >
      <Text style={type.display} accessibilityRole="header">{TITLES[mode]}</Text>
      <Banner message={error} />
      <Banner message={notice} tone="success" />
      {loading && rows.length === 0 ? <SkeletonStack rows={4} /> : null}

      {mode === 'Emergency' ? (
        <>
          <Text style={type.muted}>A rush visit is opened against this company and timed for 30 minutes.</Text>
          <TextField label="What stopped" value={title} onChangeText={setTitle} />
          <TextField label="Where and what you see" value={detail} onChangeText={setDetail} />
          <Button
            title="Raise emergency"
            loading={busy}
            onPress={() => {
              if (title.trim().length < 2 || detail.trim().length < 2) {
                setError('Describe what stopped and where you see it.');
                return;
              }
              submit(() => fieldApi.createSignal({
                kind: 'emergency',
                title: title.trim(),
                detail: detail.trim(),
              }));
            }}
          />
          {rows.map((item) => (
            <DepthCard
              key={item.id}
              tone="emergency"
              glyph="rush"
              kicker="Emergency"
              title={item.title}
              detail={`${item.detail || ''} · ${formatWhen(item.createdAt)}`}
            />
          ))}
        </>
      ) : null}

      {mode === 'Jobs' ? (
        rows.length === 0 && !loading ? (
          <EmptyState title="No jobs yet" message="Book a service or raise an emergency first." />
        ) : rows.map((job) => (
          <DepthCard
            key={job.id}
            tone={job.priority === 'emergency' ? 'emergency' : 'repair'}
            glyph="jobs"
            kicker={job.code}
            title={job.title}
            detail={`${job.location || 'Company site'} · ${jobStatusLabel(job.status)}${job.etaMinutes ? ` · ETA ${job.etaMinutes} min` : ''}`}
          >
            {job.marketplacePublished ? (
              <Text style={type.muted}>Published to Energy Hub. Partner updates appear here automatically.</Text>
            ) : null}
            {!job.marketplacePublished && canUpdateJobs(role) && ['open', 'accepted', 'on_the_way', 'in_progress'].includes(job.status) ? (
              <View style={styles.actions}>
                {job.status === 'open' ? (
                  <Button title="Accept" variant="secondary" onPress={() => submit(() => fieldApi.setJobStatus(job.id, { status: 'accepted' }))} />
                ) : null}
                {job.status === 'accepted' ? (
                  <Button title="On the way" variant="secondary" onPress={() => submit(() => fieldApi.setJobStatus(job.id, { status: 'on_the_way', etaMinutes: 30 }))} />
                ) : null}
                {job.status !== 'in_progress' && job.status !== 'open' ? (
                  <Button title="Start work" variant="secondary" onPress={() => submit(() => fieldApi.setJobStatus(job.id, { status: 'in_progress' }))} />
                ) : null}
                <Button title="Mark done" onPress={() => submit(() => fieldApi.setJobStatus(job.id, { status: 'completed' }))} />
              </View>
            ) : null}
          </DepthCard>
        ))
      ) : null}

      {mode === 'Marketplace' ? (
        canUseMarketplace(role) ? rows.map((product) => (
          <DepthCard
            key={product.id}
            variant="poster"
            tone="market"
            glyph="box"
            kicker={product.sku}
            title={product.name}
            detail={product.summary}
          />
        )) : <Text style={type.muted}>Marketplace is open to purchase, maintenance, and the owner.</Text>
      ) : null}

      {mode === 'Compliance' ? (
        <>
          {canManageCerts(role) ? (
            <>
              <TextField label="Certificate" value={title} onChangeText={setTitle} />
              <TextField label="Expires (YYYY-MM-DD)" value={detail} onChangeText={setDetail} />
              <Button
                title="Save certificate"
                loading={busy}
                onPress={() => {
                  const expiresAt = expiryIso(detail);
                  if (title.trim().length < 2) {
                    setError('Enter the certificate name.');
                    return;
                  }
                  if (!expiresAt) {
                    setError('Enter an expiry date as YYYY-MM-DD.');
                    return;
                  }
                  submit(() => fieldApi.createCert({
                    name: title.trim(),
                    expiresAt,
                  }));
                }}
              />
            </>
          ) : null}
          {rows.length === 0 && !loading ? (
            <EmptyState title="No certificates" message="Expiring certificates will count on the board." />
          ) : rows.map((cert) => (
            <DepthCard
              key={cert.id}
              variant="poster"
              tone="cert"
              glyph="shield"
              title={cert.name}
              detail={`${cert.status} · ${formatWhen(cert.expiresAt)}`}
            />
          ))}
        </>
      ) : null}

      {mode === 'Expert' ? (
        <>
          <DepthCard
            tone="project"
            glyph="user"
            kicker="FREE"
            title="Talk to an expert"
            detail="Not sure what to book? An automation expert will guide you — no obligation."
          />
          <Text style={type.muted}>This asks for a call. It does not book a paid visit.</Text>
          <TextField label="Topic" value={title} onChangeText={setTitle} />
          <TextField label="What you want to ask" value={detail} onChangeText={setDetail} />
          <Button
            title="Request a call"
            loading={busy}
            onPress={() => {
              if (title.trim().length < 2 || detail.trim().length < 2) {
                setError('Enter the topic and what you want to ask.');
                return;
              }
              submit(() => fieldApi.createSignal({
                kind: 'expert',
                title: title.trim(),
                detail: detail.trim(),
              }));
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 8,
    marginTop: 8,
  },
});
