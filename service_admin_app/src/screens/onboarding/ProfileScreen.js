import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { companyApi, profileApi } from '../../api/resources';
import { AppBar } from '../../components/AppBar';
import { Glyph } from '../../components/Glyph';
import { ProfileForm } from '../../components/forms/ProfileForm';
import { ProgressHeader } from '../../components/ProgressHeader';
import { Screen } from '../../components/Screen';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { ListItem } from '../../components/ui/ListItem';
import { Button } from '../../components/Button';
import { Banner } from '../../components/Banner';
import { ONBOARDING } from '../../constants/onboarding';
import { roleLabel } from '../../constants/catalog';
import { useCatalog } from '../../flows/useCatalog';
import { useCompanySites } from '../../flows/useCompanySites';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../theme/ThemeContext';
import { avatarUri } from '../../utils/avatar';
import { getErrorMessage } from '../../utils/errors';
import { pickProfilePhoto } from '../../utils/pickPhoto';

export function ProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const settings = route.name === 'ProfileSettings';
  const {
    user,
    company,
    onboardingStatus,
    refreshAccount,
    logout,
    newCompanyRegistration,
  } = useAuth();
  const { colors, space, type } = useTheme();
  useCatalog('account_role');
  const { sites } = useCompanySites();
  const [photoError, setPhotoError] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [companyError, setCompanyError] = useState('');
  const [switchingCompany, setSwitchingCompany] = useState('');

  useEffect(() => {
    if (!settings) return undefined;
    let active = true;
    companyApi.mine()
      .then((data) => {
        if (active) setCompanies(data.companies || []);
      })
      .catch((error) => {
        if (active) setCompanyError(getErrorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [settings]);

  async function onSubmit({ fullName, email, role, secondaryPhone }) {
    const body = { fullName, role, secondaryPhone };
    if (email) body.email = email.toLowerCase();
    const saved = settings ? await profileApi.update(body) : await profileApi.create(body);
    if (settings) setEditingProfile(false);
    const account = await refreshAccount({
      celebrate: !settings
        && !newCompanyRegistration
        && saved.onboardingStatus === ONBOARDING.ONBOARDING_COMPLETED,
    });
    if (!settings && (account.onboardingStatus === ONBOARDING.ONBOARDING_COMPLETED || saved.onboardingStatus === ONBOARDING.ONBOARDING_COMPLETED)) {
      navigation.navigate('OnboardingComplete');
    }
  }

  async function selectCompany(nextCompany) {
    setSwitchingCompany(nextCompany.id);
    setCompanyError('');
    try {
      await companyApi.select(nextCompany.id);
      await refreshAccount();
      const data = await companyApi.mine();
      setCompanies(data.companies || []);
    } catch (error) {
      setCompanyError(getErrorMessage(error));
    } finally {
      setSwitchingCompany('');
    }
  }

  async function onPickPhoto() {
    setPhotoError('');
    setPhotoBusy(true);
    try {
      const image = await pickProfilePhoto();
      if (!image) return;
      await profileApi.avatar({ image });
      await refreshAccount();
    } catch (err) {
      setPhotoError(getErrorMessage(err));
    } finally {
      setPhotoBusy(false);
    }
  }

  const fullName = user && (user.fullName || user.name) ? user.fullName || user.name : '';
  const phone = user && user.phone ? user.phone : '';
  const photo = avatarUri(user && user.avatarUrl);

  if (settings) {
    const contact = [phone, user && user.email].filter(Boolean).join(' · ');

    return (
      <Screen
        header={(
          <View style={[styles.profileHeader, { backgroundColor: colors.deepSurface }]}> 
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => navigation.goBack()}
              hitSlop={8}
              style={[styles.headerBack, { backgroundColor: colors.primary }]}
            >
              <Glyph name="back" color={colors.onAccent} size={20} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={[styles.headerEyebrow, { color: colors.primarySoft }]} numberOfLines={1}>
                {company ? company.companyName : 'ACCOUNT CENTER'}
              </Text>
              <Text style={[type.heading, { color: colors.onDeepSurface }]} numberOfLines={1}>
                {fullName || 'Profile & settings'}
              </Text>
            </View>
            <Glyph name="user" color={colors.primarySoft} size={24} />
          </View>
        )}
        headerColor={colors.background}
        statusBarStyle="dark-content"
        contentGap={space.lg * 0.7}
      >
        <Card style={[styles.heroCard, { backgroundColor: colors.deepSurface, borderColor: colors.deepSurface }]}> 
          <View style={styles.photoWrap}>
            <Avatar name={fullName || 'You'} uri={photo} size={60} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              onPress={onPickPhoto}
              disabled={photoBusy}
              hitSlop={8}
              style={[styles.camera, { backgroundColor: colors.primary }]}
            >
              <Glyph name="camera" color={colors.textOnPrimary} size={16} />
            </Pressable>
          </View>
          <View style={styles.heroCopy}>
            <Text style={[type.display, { color: colors.onDeepSurface }]} accessibilityRole="header">
              {fullName || 'Your profile'}
            </Text>
            <Text style={[type.muted, { color: colors.primarySoft }]}>
              {roleLabel(user && user.role)}
            </Text>
          </View>
        </Card>
        <Banner message={photoError} />
        <Banner message={companyError} />

        <View style={styles.infoSection}>
          <Text style={[type.label, { color: colors.textSecondary }]}>COMPANY DETAILS</Text>
          <View style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <InfoRow label="Company Name" value={company && company.companyName} />
            <InfoRow label="GST Number" value={company && (company.gstNumber || company.gst)} />
            <InfoRow label="Industry" value={company && company.industry} />
            <InfoRow label="Email" value={user && user.email} />
            <InfoRow label="Registered Mobile Number" value={phone} />
            <InfoRow label="Alternate Mobile Number" value={user && user.secondaryPhone} last />
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={[type.label, { color: colors.textSecondary }]}>SAVED SITES</Text>
          <View style={[styles.infoCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            {sites.length ? sites.map((site, index) => (
              <View
                key={site.id}
                style={[styles.siteRow, index === sites.length - 1 && styles.lastRow]}
              >
                <Glyph name={site.isPrimary ? 'pin' : 'plant'} color={colors.accentText} size={19} />
                <View style={styles.siteCopy}>
                  <Text style={[type.heading, styles.siteName]} numberOfLines={1}>
                    {site.siteName}{site.city ? ` — ${site.city}` : ''}
                  </Text>
                  <Text style={type.small} numberOfLines={2}>
                    {site.fullAddress || site.address || site.city || 'Location not set'}
                  </Text>
                </View>
                {site.isPrimary ? (
                  <Text style={[styles.primaryTag, { color: colors.success, backgroundColor: colors.successSurface }]}>
                    Primary
                  </Text>
                ) : null}
              </View>
            )) : (
              <Text style={type.muted}>No sites saved yet.</Text>
            )}
          </View>
        </View>

        <View style={styles.profileActions}>
        <View style={styles.editableHeading}>
          <Text style={[type.label, { color: colors.textSecondary }]}>EDITABLE SECTIONS</Text>
          <Text style={type.small}>Choose what you want to update.</Text>
        </View>
        <ActionCard
          glyph="user"
          title={editingProfile ? 'Close profile' : 'My profile'}
          subtitle={contact || 'Add contact information'}
          onPress={() => setEditingProfile((current) => !current)}
          colors={colors}
          type={type}
          horizontal
          style={styles.profileActionWide}
        />
        <View style={styles.profileActionRow}>
          <ActionCard
            glyph="plant"
            title="Company"
            subtitle={company ? company.companyName : 'Add company details'}
            onPress={() => navigation.navigate('Company')}
            colors={colors}
            type={type}
            horizontal
            style={styles.profileActionHalf}
          />
          <ActionCard
            glyph="pin"
            title="Sites"
            subtitle={`${sites.length} saved · Add or edit locations`}
            onPress={() => navigation.navigate('SitesList')}
            colors={colors}
            type={type}
            horizontal
            style={styles.profileActionHalf}
          />
        </View>
        </View>
        {editingProfile ? (
          <Card style={styles.editCard}>
            <ProfileForm
              key={user ? `${user.id}-edit` : 'profile-edit'}
              initialName={fullName}
              initialEmail={user && user.email ? user.email : ''}
              initialPhone={phone}
              initialSecondaryPhone={user && user.secondaryPhone ? user.secondaryPhone : ''}
              submitLabel="Save changes"
              onSubmit={onSubmit}
            />
          </Card>
        ) : null}
        {companies.length > 1 ? (
          <View style={styles.companyList}>
            <Text style={type.heading}>Your companies</Text>
            {companies.map((item) => (
              <ListItem
                key={item.id}
                compact
                glyph="plant"
                title={item.companyName}
                subtitle={`${item.city || 'Location not set'}${item.id === switchingCompany ? ' · Switching…' : ''}`}
                onPress={item.isActive ? undefined : () => selectCompany(item)}
                showChevron={!item.isActive}
                trailing={item.isActive ? (
                  <Text style={[styles.actionText, { color: colors.success }]}>Active</Text>
                ) : null}
              />
            ))}
          </View>
        ) : null}
        <ListItem compact glyph="sun" title="Appearance" onPress={() => navigation.navigate('Appearance')} />
        <ListItem compact glyph="bell" title="Notifications" onPress={() => navigation.navigate('Notifications')} />
        <ListItem compact glyph="cover" title="Help & Support" onPress={() => navigation.navigate('HelpSupport')} />
        <Button title="Logout" variant="danger" onPress={logout} />
      </Screen>
    );
  }

  return (
    <Screen
      header={(
        <AppBar
          title="Your Profile"
          onBack={() => navigation.navigate('Sites')}
        />
      )}
    >
      <ProgressHeader
        status={newCompanyRegistration ? ONBOARDING.PROFILE_PENDING : onboardingStatus}
      />
      <Text style={type.display} accessibilityRole="header">About you</Text>
      <Text style={type.muted}>You can change this later in Settings</Text>
      <ProfileForm
        key={user ? user.id : 'profile'}
        initialName={fullName}
        initialEmail={user && user.email ? user.email : ''}
        initialPhone={phone}
        initialSecondaryPhone={user && user.secondaryPhone ? user.secondaryPhone : ''}
        initialRole={user && user.role ? user.role : 'SITE_ENGINEER'}
        showRole
        note="Your role controls which company tools and actions are available to you."
        submitLabel="Complete"
        onBack={() => navigation.navigate('Sites')}
        onSubmit={onSubmit}
      />
    </Screen>
  );
}

function ActionCard({ glyph, title, subtitle, onPress, colors, type, horizontal = false, style }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.profileAction,
        horizontal && styles.profileActionHorizontal,
        style,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.actionPressed,
      ]}
    >
      <View style={[styles.profileActionIcon, { backgroundColor: colors.primaryLight }]}>
        <Glyph name={glyph} color={colors.primary} size={20} />
      </View>
      <View style={styles.profileActionCopy}>
        <Text style={[type.heading, styles.profileActionTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[type.small, styles.profileActionSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function InfoRow({ label, value, last = false }) {
  const { colors, type } = useTheme();
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }, last && styles.lastRow]}>
      <Text style={[type.small, styles.infoLabel]}>{label}</Text>
      <Text style={[type.body, styles.infoValue]} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  profileHeader: {
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  headerBack: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  heroCard: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  photoWrap: {
    position: 'relative',
  },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontWeight: '700',
  },
  editCard: {
    minHeight: 0,
  },
  companyList: {
    gap: 10,
  },
  profileActions: {
    gap: 8,
  },
  profileAction: {
    minWidth: 0,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 9,
    borderWidth: 1,
    borderRadius: 13,
  },
  editableHeading: {
    gap: 2,
  },
  profileActionWide: {
    width: '100%',
  },
  profileActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  profileActionHalf: {
    flex: 1,
  },
  profileActionHorizontal: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileActionIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  profileActionTitle: {
    fontSize: 13,
  },
  profileActionCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  profileActionSubtitle: {
    fontSize: 10,
    lineHeight: 14,
  },
  actionPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  infoSection: {
    gap: 8,
  },
  infoCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  infoRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
  },
  infoLabel: {
    flex: 1,
  },
  infoValue: {
    flex: 1.1,
    textAlign: 'right',
    fontWeight: '600',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  siteRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
  },
  siteCopy: {
    flex: 1,
    gap: 3,
  },
  siteName: {
    fontSize: 14,
  },
  primaryTag: {
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    fontSize: 11,
    fontWeight: '700',
  },
});
