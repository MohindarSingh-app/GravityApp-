import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { siteApi } from '../../api/resources';
import { AppBar } from '../../components/AppBar';
import { Banner } from '../../components/Banner';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { SiteForm } from '../../components/forms/SiteForm';
import { ProgressHeader } from '../../components/ProgressHeader';
import { Screen } from '../../components/Screen';
import { SkeletonStack } from '../../components/Skeleton';
import { canDeleteSites, SITE_TYPES } from '../../constants/catalog';
import { ONBOARDING } from '../../constants/onboarding';
import { useAuth } from '../../hooks/useAuth';
import { LocationCard } from '../../components/ui/LocationCard';
import { ConfirmDialog } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useTheme } from '../../theme/ThemeContext';
import { getErrorMessage } from '../../utils/errors';
import { formatCoordinate } from '../../utils/format';

function typeLabel(value) {
  const match = SITE_TYPES.find((item) => item.value === value);
  return match ? match.label : value;
}

export function SitesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const manage = route.name === 'SitesList';
  const {
    company, onboardingStatus, refreshAccount, user, newCompanyRegistration,
  } = useAuth();
  const { colors, radius, type } = useTheme();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState(null);
  const [continuing, setContinuing] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(null);

  function openNewSite() {
    setEditor({
      isNew: true,
      city: (company && company.city) || '',
      isPrimary: sites.length === 0,
    });
  }

  const load = useCallback(async () => {
    if (!company || !company.id) {
      setSites([]);
      setLoading(false);
      setError('Create the company before adding sites.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await siteApi.list(company.id);
      setSites(data.sites || []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [company]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSite(payload) {
    if (!company || !company.id) {
      throw new Error('Create the company before adding sites.');
    }
    if (editor && editor.id) {
      await siteApi.update(editor.id, payload);
    } else {
      await siteApi.create(company.id, payload);
    }
    setEditor(null);
    await load();
  }

  async function makePrimary(site) {
    setError('');
    try {
      await siteApi.setPrimary(site.id);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function removeSite(site) {
    setPendingRemove(site);
  }

  async function confirmRemove() {
    const site = pendingRemove;
    setPendingRemove(null);
    if (!site) return;
    try {
      await siteApi.remove(site.id);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function onContinue() {
    setContinuing(true);
    setError('');
    try {
      const data = await refreshAccount(
        newCompanyRegistration ? {} : { celebrateOnComplete: true },
      );
      if (newCompanyRegistration && sites.length > 0) {
        navigation.navigate('Profile');
        return;
      }
      if (data.onboardingStatus === ONBOARDING.PROFILE_PENDING) {
        navigation.navigate('Profile');
        return;
      }
      if (data.onboardingStatus === ONBOARDING.ONBOARDING_COMPLETED) {
        navigation.navigate('OnboardingComplete');
        return;
      }
      setError('Add a site before continuing.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setContinuing(false);
    }
  }

  const allowDelete = canDeleteSites(user && user.role);
  const activeSites = sites.filter((site) => site.status === 'active');

  return (
    <Screen
      header={(
        <AppBar
          title={manage ? 'Sites' : 'Sites / Units'}
          onBack={() => (manage ? navigation.goBack() : navigation.navigate('CompanyDetails'))}
        />
      )}
      onRefresh={load}
      refreshing={loading && sites.length > 0}
      footer={!manage && !editor ? (
        <View style={styles.stepActions}>
          <View style={styles.stepAction}>
            <Button
              title="‹ Back"
              variant="secondary"
              onPress={() => navigation.navigate('CompanyDetails')}
              disabled={continuing}
            />
          </View>
          <View style={styles.stepAction}>
            <Button
              title="Next ›"
              onPress={onContinue}
              loading={continuing}
              disabled={activeSites.length === 0}
            />
          </View>
        </View>
      ) : null}
    >
      {manage ? null : (
        <ProgressHeader
          status={newCompanyRegistration ? ONBOARDING.SITES_PENDING : onboardingStatus}
        />
      )}
      <Text style={type.display} accessibilityRole="header">
        {manage ? 'Saved sites' : 'Factory / Sites'}
      </Text>
      <Text style={type.muted}>
        GPS location helps a partner navigate exactly to your site.
      </Text>
      {newCompanyRegistration ? (
        <Text style={type.muted}>
          Your saved sites were copied. Changes here affect only this new company.
        </Text>
      ) : null}
      <Banner message={error} />
      {loading && sites.length === 0 ? <SkeletonStack rows={4} /> : null}
      {!loading && sites.length === 0 && !editor ? (
        <EmptyState
          title="No sites yet"
          message="Add the first site to continue. Its GPS pin is requested only when you tap the location button."
          action={<Button title="Add a site" onPress={openNewSite} />}
        />
      ) : null}
      {sites.map((site, index) => (
        <View
          key={site.id}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card }]}
        >
          <View style={styles.cardHead}>
            <Text style={type.heading}>Site {index + 1}</Text>
            {site.isPrimary ? (
              <StatusBadge label="Primary" status="active" />
            ) : allowDelete ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${site.siteName}`} onPress={() => removeSite(site)}>
                <Text style={[styles.badgeText, { color: colors.danger }]}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
          <Text style={[type.label, styles.caption]}>Site name</Text>
          <Text style={type.heading}>{site.siteName}</Text>
          <Text style={[type.label, styles.caption]}>Full address</Text>
          <Text style={type.body}>{site.fullAddress}</Text>
          {site.latitude !== null && site.latitude !== undefined
            && site.longitude !== null && site.longitude !== undefined
            && Number.isFinite(Number(site.latitude)) && Number.isFinite(Number(site.longitude)) ? (
            <LocationCard
              ready
              detail={`${formatCoordinate(site.latitude)}, ${formatCoordinate(site.longitude)}`}
              onPress={() => setEditor(site)}
            />
          ) : null}
          <Text style={[type.label, styles.caption]}>Site type</Text>
          <Text style={type.body}>{typeLabel(site.siteType)}</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${site.siteName}`} onPress={() => setEditor(site)} style={styles.action}>
              <Text style={[styles.emphasis, { color: colors.accentText }]}>Edit</Text>
            </Pressable>
            {!site.isPrimary ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Make ${site.siteName} primary`} onPress={() => makePrimary(site)} style={styles.action}>
                <Text style={[styles.emphasis, { color: colors.text }]}>Make primary</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
      {sites.length > 0 && !editor ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add another site"
          onPress={openNewSite}
          style={[styles.add, { borderColor: colors.primary, backgroundColor: colors.primaryLight, borderRadius: radius.button }]}
        >
          <Text style={[styles.emphasis, { color: colors.primary }]}>+ Add Another Site</Text>
        </Pressable>
      ) : null}
      {editor ? (
        <SiteForm
          key={editor.id || 'new-site'}
          initial={editor}
          lockPrimary={!editor.id && sites.length === 0}
          submitLabel={editor.id ? 'Save site' : 'Add site'}
          onSubmit={saveSite}
          onCancel={() => setEditor(null)}
        />
      ) : null}
      <ConfirmDialog
        visible={Boolean(pendingRemove)}
        title="Remove site"
        description={pendingRemove ? `Remove ${pendingRemove.siteName}? This cannot be undone.` : ''}
        confirmLabel="Remove"
        cancelLabel="Keep site"
        destructive
        onConfirm={confirmRemove}
        onClose={() => setPendingRemove(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  caption: {
    marginTop: 6,
  },
  gps: {
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  add: {
    minHeight: 48,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  stepActions: {
    flexDirection: 'row',
    gap: 12,
  },
  stepAction: {
    flex: 1,
  },
  action: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: 12,
  },
  emphasis: {
    fontWeight: '600',
  },
});
