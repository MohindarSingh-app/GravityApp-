import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { fieldApi } from '../../../api/resources';
import { AppBar } from '../../../components/AppBar';
import { Banner } from '../../../components/Banner';
import { Button } from '../../../components/Button';
import { EmptyState } from '../../../components/EmptyState';
import { Glyph } from '../../../components/Glyph';
import { Screen } from '../../../components/Screen';
import { SkeletonStack } from '../../../components/Skeleton';
import { TextField } from '../../../components/TextField';
import { Card } from '../../../components/ui/Card';
import { ListItem } from '../../../components/ui/ListItem';
import { SegmentedControl } from '../../../components/ui/SegmentedControl';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { canManageCerts } from '../../../constants/catalog';
import { useCatalog } from '../../../flows/useCatalog';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../theme/ThemeContext';
import { getErrorMessage } from '../../../utils/errors';
import { formatWhen } from '../../../utils/format';

const TABS = [
  { id: 'compliance', label: 'Compliance' },
  { id: 'audit', label: 'Audit' },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function expiryIso(value) {
  const text = String(value || '').trim();
  if (!DATE.test(text)) return '';
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString();
}

function certTone(status) {
  const key = String(status || '').toLowerCase();
  if (key === 'valid' || key === 'active') return 'success';
  if (key === 'expiring' || key === 'expired') return 'warning';
  return status;
}

export function ComplianceScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, radius, type } = useTheme();
  const [tab, setTab] = useState('compliance');
  const [certs, setCerts] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reportsError, setReportsError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [expires, setExpires] = useState('');

  const load = useCallback(async () => {
    setError('');
    setReportsError('');
    const [certResult, jobsResult] = await Promise.allSettled([
      fieldApi.certs(),
      fieldApi.jobs(),
    ]);

    if (certResult.status === 'rejected') {
      setError(getErrorMessage(certResult.reason));
    } else {
      setCerts(certResult.value.certs || []);
    }

    if (jobsResult.status === 'rejected') {
      setJobs([]);
      setReportsError(getErrorMessage(jobsResult.reason));
    } else {
      setJobs(jobsResult.value.jobs || []);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const expiring = useMemo(
    () => certs.filter((cert) => ['expiring', 'expired'].includes(String(cert.status || '').toLowerCase())),
    [certs],
  );
  const reports = useMemo(
    () => jobs.filter((job) => job.status === 'completed' || job.status === 'done').slice(0, 6),
    [jobs],
  );
  const canManage = canManageCerts(user && user.role);
  const catalog = useCatalog('compliance_audit');
  const auditTypes = catalog.groups.compliance_audit;
  const renewalQuery = (auditTypes[0] && auditTypes[0].meta && auditTypes[0].meta.query) || '';

  function bookService(query) {
    navigation.navigate('QuickServices', { screen: 'ServiceCategory', params: { query } });
  }

  async function saveCertificate() {
    const expiresAt = expiryIso(expires);
    if (name.trim().length < 2) {
      setError('Enter the certificate name.');
      return;
    }
    if (!expiresAt) {
      setError('Enter an expiry date as YYYY-MM-DD.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fieldApi.createCert({ name: name.trim(), expiresAt });
      setName('');
      setExpires('');
      setNotice('Certificate saved.');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      header={<AppBar title="Compliance & Audit" onBack={() => navigation.goBack()} />}
      headerColor={colors.background}
      refreshing={!loading}
      onRefresh={() => { setLoading(true); load(); }}
    >
      <SegmentedControl tabs={TABS} value={tab} onChange={setTab} />
      <Banner message={error} />
      <Banner message={notice} tone="success" />
      {loading && !certs.length ? <SkeletonStack rows={4} /> : null}

      {tab === 'compliance' ? (
        <>
          {expiring.length ? (
            <View style={[styles.warn, { backgroundColor: colors.warningSurface, borderColor: colors.warning, borderRadius: radius.card }]}>
              <Glyph name="rush" color={colors.warning} size={16} />
              <Text style={[type.body, { color: colors.warning, flex: 1 }]}>
                {expiring.length} certificate{expiring.length === 1 ? '' : 's'} expiring soon
              </Text>
            </View>
          ) : null}

          <Text style={[type.label, { color: colors.text }]}>Certificates</Text>
          {!certs.length && !loading ? (
            <EmptyState glyph="cert" title="No certificates" message="Expiring certificates will count on the board." />
          ) : certs.map((cert) => (
            <Card key={cert.id} style={styles.doc}>
              <View style={[styles.docIcon, { backgroundColor: colors.warningSurface, borderRadius: radius.chip }]}>
                <Glyph name="document" color={colors.warning} size={18} />
              </View>
              <View style={styles.copy}>
                <Text style={type.heading}>{cert.name}</Text>
                <Text style={type.small}>{cert.status} · {formatWhen(cert.expiresAt)}</Text>
              </View>
              <StatusBadge label={cert.status} status={cert.status} tone={certTone(cert.status)} />
            </Card>
          ))}

          <Text style={[type.label, { color: colors.text }]}>Reports & Invoices</Text>
          {reportsError ? (
            <Banner message={`Reports could not be loaded: ${reportsError}`} />
          ) : !loading && !reports.length ? (
            <EmptyState glyph="document" title="No reports yet" message="Completed job reports and GST invoices will appear here." />
          ) : reports.map((job) => (
            <Card key={job.id} style={styles.doc}>
              <View style={[styles.docIcon, { backgroundColor: colors.infoSurface, borderRadius: radius.chip }]}>
                <Glyph name="document" color={colors.info} size={18} />
              </View>
              <View style={styles.copy}>
                <Text style={type.heading}>{job.title}</Text>
                <Text style={type.small}>
                  {[job.code, job.engineerName, job.estimateAmount ? `₹${job.estimateAmount}` : '']
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </Card>
          ))}

          {canManage ? (
            <>
              <Text style={[type.label, { color: colors.text }]}>Add certificate</Text>
              <TextField label="Certificate" value={name} onChangeText={setName} />
              <TextField label="Expires (YYYY-MM-DD)" value={expires} onChangeText={setExpires} />
              <Button title="Save certificate" loading={busy} onPress={saveCertificate} />
            </>
          ) : null}

          {expiring.length ? (
            <Button
              title={`Renew ${expiring[0].name}`}
              variant="outline"
              onPress={() => bookService(renewalQuery)}
            />
          ) : null}
        </>
      ) : (
        <>
          <View style={[styles.warn, { backgroundColor: colors.infoSurface, borderColor: colors.info, borderRadius: radius.card }]}>
            <Glyph name="cert" color={colors.info} size={18} />
            <View style={styles.copy}>
              <Text style={[type.heading, { color: colors.info }]}>Book a New Audit</Text>
              <Text style={[type.small, { color: colors.textSecondary }]}>Certified auditors · Schedule by date & time</Text>
            </View>
          </View>

          <Text style={[type.label, { color: colors.text }]}>Choose audit type</Text>
          {catalog.loading && !auditTypes.length ? <SkeletonStack rows={3} /> : null}
          {!catalog.loading && catalog.error && !auditTypes.length ? <Banner message={catalog.error} /> : null}
          {auditTypes.map((item) => (
            <ListItem
              key={item.code}
              glyph={item.glyph || 'cert'}
              title={item.label}
              subtitle={item.summary}
              onPress={() => bookService((item.meta && item.meta.query) || item.label)}
            />
          ))}

          <Text style={[type.label, { color: colors.text }]}>Past Audit Reports</Text>
          {!reports.length ? (
            <EmptyState glyph="cert" title="No past audits" message="Completed audit reports will appear here." />
          ) : reports.map((job) => (
            <Card key={`audit-${job.id}`} style={styles.doc}>
              <View style={[styles.docIcon, { backgroundColor: colors.successSurface, borderRadius: radius.chip }]}>
                <Glyph name="cert" color={colors.success} size={18} />
              </View>
              <View style={styles.copy}>
                <Text style={type.heading}>{job.title}</Text>
                <Text style={type.small}>{[job.code, formatWhen(job.updatedAt || job.createdAt)].filter(Boolean).join(' · ')}</Text>
              </View>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
  doc: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  docIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
