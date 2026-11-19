import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../providers/AuthProvider';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import { AppButton } from '../../components/AppButton';
import { AppTextInput } from '../../components/AppTextInput';
import { apiService } from '../../services/api';
import { launchImageLibraryAsync } from '../../services/imagePicker';
import { UserRole } from '../../types';
import { registerThemeStyles, theme } from '../../components/theme';
import { AppearanceSwitch } from '../../components/AppearanceSwitch';
import { categorySkills, readSpecializationState, SpecializationCategoryMap } from './specializationProfile';

/* Profile colors follow the active light or dark theme. */
const build_UI = () => ({
  red: theme.colors.error,
  redLight: theme.colors.errorLight,
  redText: theme.colors.errorDark,
  green: theme.colors.success,
  greenLight: theme.colors.successLight,
  greenText: theme.colors.successDark,
  blue: theme.colors.primary,
  blueLight: theme.colors.primaryLight,
  blueBorder: theme.colors.borderStrong,
  blueText: theme.colors.brandInk,
  amber: theme.colors.warning,
  amberText: theme.colors.warningDark,
  amberText2: theme.colors.warningDark,
  amberLight: theme.colors.warningLight,
  amberLine: theme.colors.border,
  purple: theme.colors.brandInk,
  purpleLight: theme.colors.primaryLight,
  text: theme.colors.mainText,
  text2: theme.colors.secondaryText,
  text3: theme.colors.textMuted,
  bd: theme.colors.border,
  bd2: theme.colors.borderStrong,
  bg: theme.colors.background,
  surface: theme.colors.surface,
});
let UI = build_UI();
registerThemeStyles(() => { UI = build_UI(); });


const SPECIALIZATION_LABELS: Record<string, string> = {
  electrician: 'Electrician',
  plcScada: 'PLC / SCADA',
  vfdDrives: 'VFD / Drives',
  panelMcc: 'Panel / MCC',
  cabling: 'Cabling',
  complianceAudit: 'Compliance & Audit',
  repairCenter: 'Repair Center',
  panelFabrication: 'Panel Fabrication',
};

interface ProfileData {
  fullName?: string;
  businessName?: string;
  role?: string;
  city?: string;
  state?: string;
  yearsExperience?: number;
  rating?: number;
  jobsCompleted?: number;
  status?: string;
  specializationStatus?: 'unsubmitted' | 'pending' | 'approved' | 'rejected';
  specializationDetails?: Record<string, { enabled?: boolean; skills?: string[] }>;
  serviceAreaDetails?: Array<{ name: string; pincode: string }>;
  roleAccounts?: Array<{ role: string; status: string; userId: number; registrationId?: number | null }>;
  profilePhoto?: string;
  verificationStatus?: string;
  specializations?: Record<string, { enabled?: boolean; skills?: string[] } | string>;
  documents?: Array<{ type?: string; fileName?: string; status?: string }>;
  mobile?: string;
  email?: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContact?: string;
  qualification?: string;
  qualificationDetails?: string;
  serviceArea?: string;
  serviceAreas?: string[];
  bankDetails?: {
    accountHolderName?: string;
    accountNumberMasked?: string;
    bankName?: string;
    ifscCode?: string;
  };
  isOnline?: boolean;
  isBusy?: boolean;
  partnerSince?: string;
  id?: string | number;
}

export const PartnerProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, logout, login } = useAuth();
  const { avatarUri, setAvatarUri } = useUserPreferences();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [openCard, setOpenCard] = useState<string | null>(null);
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [personalDraft, setPersonalDraft] = useState({
    fullName: '',
    dateOfBirth: '',
    address: '',
    emergencyContact: '',
    qualificationDetails: '',
  });
  const [userServiceAreaDetails, setUserServiceAreaDetails] = useState<Array<{ name: string; pincode: string }>>([]);

  useFocusEffect(useCallback(() => {
    let active = true;
    apiService.getProfile()
      .then((response) => {
        if (active) {
          const loadedProfile = response.data || {};
          setProfile(loadedProfile);
          setUserServiceAreaDetails(Array.isArray(loadedProfile.serviceAreaDetails) ? loadedProfile.serviceAreaDetails : []);
          setPersonalDraft({
            fullName: loadedProfile.fullName || '',
            dateOfBirth: loadedProfile.dateOfBirth || '',
            address: loadedProfile.address || '',
            emergencyContact: loadedProfile.emergencyContact || '',
            qualificationDetails: loadedProfile.qualificationDetails || loadedProfile.qualification || '',
          });
        }
      })
      .catch(() => {
        if (active) setProfile({
          fullName: user?.mobile ? `Partner ${user.mobile.slice(-4)}` : 'Energy Partner',
          mobile: user?.mobile,
          email: user?.email,
          role: user?.role,
          status: user?.status,
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [user]));

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: UI.bg }]}>
        <ActivityIndicator color={UI.blue} style={styles.loader} />
      </SafeAreaView>
    );
  }

  const roleLabel = theme_roleLabel(profile?.role || user?.role);
  const name = profile?.fullName || profile?.businessName || user?.mobile || 'Partner';
  const location = [profile?.city, profile?.state].filter(Boolean).join(', ') || 'Location not added';
  const experience = profile?.yearsExperience;
  const rating = Number(profile?.rating || 0);
  const jobs = Number(profile?.jobsCompleted || 0);
  const isApproved = (profile?.status || user?.status) === 'approved';

  const specializationState = readSpecializationState(profile?.specializations, profile?.specializationDetails);
  const expertiseStatus = profile?.specializationStatus || specializationState.status || 'unsubmitted';
  const selectedExpertise = (categories: SpecializationCategoryMap) => Object.fromEntries(
    Object.entries(categories).filter(([, value]) => value?.enabled !== false && (value?.enabled || categorySkills(value).length > 0)),
  ) as SpecializationCategoryMap;
  const selectedCategories = selectedExpertise(specializationState.categories);
  const approvedExpertise: SpecializationCategoryMap = Object.keys(specializationState.approvedCategories).length
    ? selectedExpertise(specializationState.approvedCategories)
    : expertiseStatus === 'approved' ? selectedCategories : {};
  const pendingExpertise: SpecializationCategoryMap = expertiseStatus === 'pending' ? selectedCategories : {};
  const savedExpertise: SpecializationCategoryMap = !Object.keys(approvedExpertise).length && !Object.keys(pendingExpertise).length
    ? selectedCategories
    : {};
  const expertiseItems = (categories: SpecializationCategoryMap) => Object.entries(categories).flatMap(([key, value]) => {
    const skills = categorySkills(value);
    if (!value?.enabled && !skills.length) return [];
    return (skills.length ? skills : [SPECIALIZATION_LABELS[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2')])
      .map((label) => ({ id: `${key}:${label}`, label }));
  });
  const approvedItems = expertiseItems(approvedExpertise);
  const approvedIds = new Set(approvedItems.map((item) => item.id));
  const pendingItems = expertiseItems(pendingExpertise).filter((item) => !approvedIds.has(item.id));
  const savedItems = expertiseItems(savedExpertise).filter((item) => !approvedIds.has(item.id));
  const activeSpecializationCount = Object.values(approvedExpertise).filter((value) => value.enabled || categorySkills(value).length).length
    || Object.values(savedExpertise).filter((value) => value.enabled || categorySkills(value).length).length;
  const documents: Array<{ type?: string; fileName?: string; status?: string }> = profile?.documents || [];
  const serviceAreas: string[] = Array.isArray(profile?.serviceAreas)
    ? profile!.serviceAreas!
    : profile?.serviceArea
      ? String(profile.serviceArea).split(',').map((area) => area.trim()).filter(Boolean)
      : [];
  const bank = profile?.bankDetails || {};

  const currentRole = (profile?.role || user?.role || 'service_partner') as UserRole;
  const availableRoleAccounts = (profile as any)?.roleAccounts || [];
  const profileDirty = JSON.stringify(userServiceAreaDetails) !== JSON.stringify(profile?.serviceAreaDetails || []);
  const saveServiceAreas = async () => {
    setSaving(true);
    setProfileError('');
    try {
      await apiService.updatePartnerProfile({ serviceAreaDetails: userServiceAreaDetails });
      const refreshed = await apiService.getProfile();
      setProfile(refreshed.data || {});
      setUserServiceAreaDetails(refreshed.data?.serviceAreaDetails || userServiceAreaDetails);
    } catch (saveError: any) {
      setProfileError(saveError.response?.data?.message || 'Could not save profile details.');
    } finally {
      setSaving(false);
    }
  };
  const addServiceArea = () => setUserServiceAreaDetails((current) => [...current, { name: '', pincode: '' }]);
  const updateServiceArea = (index: number, field: 'name' | 'pincode', value: string) => setUserServiceAreaDetails((current) => current.map((area, itemIndex) => itemIndex === index ? { ...area, [field]: field === 'pincode' ? value.replace(/\D/g, '').slice(0, 6) : value } : area));
  const removeServiceArea = (index: number) => setUserServiceAreaDetails((current) => current.filter((_, itemIndex) => itemIndex !== index));
  const beginPersonalEdit = () => {
    setOpenCard('personal');
    setEditingPersonal(true);
    setProfileError('');
  };
  const savePersonal = async () => {
    setSaving(true);
    setProfileError('');
    try {
      await apiService.updatePartnerProfile(personalDraft);
      const refreshed = await apiService.getProfile();
      setProfile(refreshed.data || {});
      setEditingPersonal(false);
    } catch (saveError: any) {
      setProfileError(saveError.response?.data?.message || 'Could not save personal details.');
    } finally {
      setSaving(false);
    }
  };
  const getInitial = (n: string) => n.slice(0, 2).toUpperCase();
  const displayValue = (value?: string | number | null) => value === undefined || value === null || value === '' ? 'Not provided' : String(value);
  const statusLabel = (profile?.status || user?.status || 'under_review').replace(/_/g, String.fromCharCode(32));
  const documentStatusColor = (status?: string) => status === 'verified' || status === 'approved'
    ? UI.greenText
    : status === 'rejected'
      ? UI.red
      : UI.text3;
  const toggleCard = (key: string) => setOpenCard((current) => current === key ? null : key);
  const verifiedDocs = documents.filter((d) => d.status === 'verified' || d.status === 'approved').length;

  return (
    <View style={[styles.container, { backgroundColor: UI.bg }]}>
      {/* ══ Sticky .tb header — red back chevron, bold title, gear ══ */}
      <SafeAreaView edges={['top']} style={[styles.headerWrap, { backgroundColor: UI.surface }]}>
        <View style={[styles.tb, { borderBottomColor: UI.bd }]}>
          <TouchableOpacity accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={styles.tbSide}>
            <Text style={[styles.tbBack, { color: UI.red }]}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={[styles.tbTitle, { color: UI.text }]}>My Profile</Text>
          <TouchableOpacity
            accessibilityLabel="Edit profile"
            onPress={beginPersonalEdit}
            style={styles.tbSide}
          >
            <Ionicons name="settings-outline" size={19} color={UI.text2} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={styles.page}>

        {/* ══ COMPACT hero — tight paddings so the card height stays small ══ */}
        <View style={[styles.hero, { borderBottomColor: UI.bd, backgroundColor: UI.surface }]}>
          <View style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}><Text style={styles.avatarInitial}>{getInitial(name)}</Text></View>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Choose profile photo"
              onPress={async () => {
                try {
                  const result = await launchImageLibraryAsync({ quality: 0.8 });
                  if (!result.canceled && result.assets[0]) await setAvatarUri(result.assets[0].uri);
                } catch (pickerError) {
                  setProfileError(pickerError instanceof Error ? pickerError.message : 'Could not select a profile photo.');
                }
              }}
              style={styles.avatarCamera}
            >
              <Ionicons name="camera" size={10} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.heroCenter}>
            <Text style={[styles.heroName, { color: UI.text }]}>{name}</Text>
            <Text style={[styles.heroRole, { color: UI.text2 }]}>{roleLabel}</Text>
            <Text style={[styles.heroMeta, { color: UI.text3 }]} numberOfLines={1}>
              📍 {location}{experience ? `  •  ${experience} yrs` : ''}
            </Text>
          </View>
        </View>

        {availableRoleAccounts.length > 0 ? (
          <View style={styles.roleAccountRow}>
            {availableRoleAccounts.map((account: { role: string; status: string; registrationId?: number | null }) => {
              const active = account.role === currentRole;
              return (
                <TouchableOpacity
                  key={account.role}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  disabled={active || saving}
                  onPress={async () => {
                    setSaving(true);
                    try {
                      const result = await apiService.switchPartnerRole(account.role);
                      await login(result.data.token, { ...user!, ...result.data.user, token: result.data.token, refreshToken: user?.refreshToken || '' });
                      navigation.navigate('Home');
                    } catch (switchError: any) {
                      setProfileError(switchError.response?.data?.message || 'Could not switch role.');
                    } finally { setSaving(false); }
                  }}
                  style={[styles.roleAccountButton, active && styles.roleAccountButtonActive]}
                >
                  <Text style={[styles.roleAccountText, active && styles.roleAccountTextActive]}>{theme_roleLabel(account.role)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        {profileError ? <Text style={styles.profileError}>{profileError}</Text> : null}

        {/* Verified / rating / status mini strip — single compact row */}
        <View style={styles.stripRow}>
          <View style={[styles.badge, { backgroundColor: isApproved ? UI.greenLight : UI.amberLight }]}>
            <Text style={[styles.badgeText, { color: isApproved ? UI.greenText : UI.amberText2 }]}>
              {isApproved ? '✓ Verified Partner' : `⏳ ${statusLabel}`}
            </Text>
          </View>
          {profile?.verificationStatus ? (
            <View style={[styles.badge, { backgroundColor: UI.blueLight }]}>
              <Text style={[styles.badgeText, { color: UI.blueText }]}>🔑 ID Verified</Text>
            </View>
          ) : null}
          <View style={[styles.badge, { backgroundColor: UI.blueLight, borderColor: UI.blueBorder, borderWidth: 1 }]}>
            <Text style={[styles.badgeText, { color: UI.blueText }]}>★ {rating.toFixed(1)} · {jobs} jobs</Text>
          </View>
        </View>

        <View style={[styles.card, { borderColor: UI.bd }]}>
          <TouchableOpacity activeOpacity={0.85} accessibilityLabel="Service areas" onPress={() => toggleCard('areas')} style={styles.cardHead}>
            <View style={[styles.cardIcon, { backgroundColor: UI.greenLight }]}><Ionicons name="map-outline" size={16} color={UI.greenText} /></View>
            <View style={styles.flexOne}>
              <Text style={[styles.cardTitle, { color: UI.text }]}>Service Areas</Text>
              <Text style={[styles.cardSub, { color: UI.text3 }]}>{userServiceAreaDetails.length ? `${userServiceAreaDetails.length} PIN-code areas` : serviceAreas.length ? `${serviceAreas.length} saved areas` : 'No areas added'}</Text>
            </View>
            <Ionicons name={openCard === 'areas' ? 'chevron-up' : 'chevron-forward'} size={16} color={UI.text3} />
          </TouchableOpacity>
          {openCard === 'areas' ? (
            <View style={styles.cardBody}>
              {userServiceAreaDetails.map((area, idx) => (
                <View key={`pin-area-${idx}`} style={styles.areaEditRow}>
                  <AppTextInput label="Area / City" value={area.name} onChangeText={(value) => updateServiceArea(idx, 'name', value)} />
                  <AppTextInput label="6-digit PIN code" value={area.pincode} onChangeText={(value) => updateServiceArea(idx, 'pincode', value)} keyboardType="numeric" maxLength={6} />
                  <TouchableOpacity onPress={() => removeServiceArea(idx)}><Text style={styles.removeArea}>Remove area</Text></TouchableOpacity>
                </View>
              ))}
              {!userServiceAreaDetails.length && serviceAreas.map((area, idx) => <Text key={`${area}-${idx}`} style={[styles.emptyCopy, { color: UI.text2 }]}>{area}</Text>)}
              <TouchableOpacity accessibilityRole="button" onPress={addServiceArea} style={styles.addAreaButton}><Text style={styles.addAreaText}>+ Add PIN-code area</Text></TouchableOpacity>
              <AppButton title={saving ? 'Saving…' : 'Save service areas'} onPress={saveServiceAreas} loading={saving} disabled={!profileDirty} style={styles.saveProfileButton} />
              {profileError ? <Text style={styles.profileError}>{profileError}</Text> : null}
            </View>
          ) : null}
        </View>

        {/* example.html profile summary: editing lives on one dedicated screen. */}
        <Text style={styles.sectionTitle}>{currentRole === 'supplier' ? 'Product Categories' : 'Specialization'}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={currentRole === 'supplier' ? 'Manage product categories' : 'Edit specializations and brands'}
          activeOpacity={0.85}
          onPress={() => navigation.navigate(currentRole === 'supplier' ? 'SupplierCatalog' : 'Specializations')}
          style={[styles.specializationCard, { borderColor: UI.bd }]}
        >
          {approvedItems.length ? (
            <View style={styles.expertiseSection}>
              <View style={styles.expertiseHeading}>
                <Ionicons name="checkmark-circle" size={15} color={UI.greenText} />
                <Text style={[styles.expertiseHeadingText, { color: UI.greenText }]}>Approved · active for matching</Text>
              </View>
              <View style={styles.chipWrap}>
                {approvedItems.map((item) => (
                  <View key={item.id} style={styles.approvedTag}>
                    <Text style={styles.approvedTagText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {pendingItems.length ? (
            <View style={[styles.expertiseSection, approvedItems.length ? styles.pendingSection : null]}>
              <View style={styles.expertiseHeading}>
                <Ionicons name="time-outline" size={15} color={UI.amberText2} />
                <Text style={[styles.expertiseHeadingText, { color: UI.amberText2 }]}>Waiting for approval</Text>
              </View>
              <View style={styles.chipWrap}>
                {pendingItems.map((item) => (
                  <View key={item.id} style={styles.pendingTag}>
                    <Text style={styles.pendingTagText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
          {savedItems.length ? (
            <View style={styles.chipWrap}>
              {savedItems.map((item) => (
                <View key={item.id} style={styles.approvedTag}>
                  <Text style={styles.approvedTagText}>{item.label}</Text>
                </View>
              ))}
            </View>
          ) : null}
          {!approvedItems.length && !pendingItems.length && !savedItems.length ? (
            <View style={styles.chipWrap}>
              <Text style={[styles.emptyCopy, { color: UI.text3 }]}>No specializations selected</Text>
            </View>
          ) : null}
          <View style={styles.specializationFooter}>
            <Text style={[styles.specializationCaption, { color: UI.text2 }]}>
              {currentRole === 'supplier'
                ? `${activeSpecializationCount} product ${activeSpecializationCount === 1 ? 'category' : 'categories'} active`
                : approvedItems.length
                  ? `${activeSpecializationCount} approved ${activeSpecializationCount === 1 ? 'category' : 'categories'} · ${approvedItems.length} active ${approvedItems.length === 1 ? 'skill' : 'skills'}${pendingItems.length ? ` · ${pendingItems.length} pending` : ''}`
                  : pendingItems.length
                    ? `${pendingItems.length} ${pendingItems.length === 1 ? 'selection is' : 'selections are'} under review`
                    : savedItems.length
                      ? `${savedItems.length} selected ${savedItems.length === 1 ? 'skill' : 'skills'}`
                      : 'Choose expertise to improve job matching'}
            </Text>
            <Text style={styles.specializationEdit}>Edit ›</Text>
          </View>
        </TouchableOpacity>

        {/* ══ PERSONAL & CONTACT — collapsed card, tap to open ══ */}
        <View style={[styles.card, { borderColor: UI.bd }]}>
          <TouchableOpacity activeOpacity={0.85} accessibilityLabel="Personal details" onPress={() => toggleCard('personal')} style={styles.cardHead}>
            <View style={[styles.cardIcon, { backgroundColor: UI.blueLight }]}><Ionicons name="person-outline" size={16} color={UI.blueText} /></View>
            <View style={styles.flexOne}>
              <Text style={[styles.cardTitle, { color: UI.text }]}>Personal & Contact</Text>
              <Text style={[styles.cardSub, { color: UI.text3 }]}>{displayValue(profile?.mobile || user?.mobile)}</Text>
            </View>
            <Ionicons name={openCard === 'personal' ? 'chevron-up' : 'chevron-forward'} size={16} color={UI.text3} />
          </TouchableOpacity>
          {openCard === 'personal' ? (
            <View style={styles.cardBody}>
              {editingPersonal ? (
                <>
                  <AppTextInput label="Full name" value={personalDraft.fullName} onChangeText={(value) => setPersonalDraft((current) => ({ ...current, fullName: value }))} />
                  <AppTextInput label="Date of birth (YYYY-MM-DD)" value={personalDraft.dateOfBirth} onChangeText={(value) => setPersonalDraft((current) => ({ ...current, dateOfBirth: value }))} />
                  <AppTextInput label="Address" value={personalDraft.address} onChangeText={(value) => setPersonalDraft((current) => ({ ...current, address: value }))} multiline />
                  <AppTextInput label="Emergency contact" value={personalDraft.emergencyContact} onChangeText={(value) => setPersonalDraft((current) => ({ ...current, emergencyContact: value.replace(/\D/g, '').slice(0, 10) }))} keyboardType="phone-pad" />
                  <AppTextInput label="Qualification details" value={personalDraft.qualificationDetails} onChangeText={(value) => setPersonalDraft((current) => ({ ...current, qualificationDetails: value }))} />
                  <AppButton title="Save personal details" onPress={savePersonal} loading={saving} />
                </>
              ) : (
                <>
                  <DetailRow icon="call-outline" label="Mobile" value={displayValue(profile?.mobile || user?.mobile)} />
                  <DetailRow icon="mail-outline" label="Email" value={displayValue(profile?.email || user?.email)} />
                  <DetailRow icon="calendar-outline" label="Date of birth" value={displayValue(profile?.dateOfBirth)} />
                  <DetailRow icon="location-outline" label="Address" value={displayValue(profile?.address)} />
                  <DetailRow icon="alert-circle-outline" label="Emergency contact" value={displayValue(profile?.emergencyContact)} last />
                </>
              )}
            </View>
          ) : null}
        </View>

        {/* ══ BUSINESS & SERVICE — collapsed card ══ */}
        <TouchableOpacity activeOpacity={0.85} accessibilityLabel="Business details" onPress={() => toggleCard('business')} style={[styles.card, { borderColor: UI.bd }]}>
          <View style={styles.cardHead}>
            <View style={[styles.cardIcon, { backgroundColor: UI.purpleLight }]}><Ionicons name="business-outline" size={16} color={UI.purple} /></View>
            <View style={styles.flexOne}>
              <Text style={[styles.cardTitle, { color: UI.text }]}>Business & Service</Text>
              <Text style={[styles.cardSub, { color: UI.text3 }]}>{displayValue(profile?.businessName)}</Text>
            </View>
            <Ionicons name={openCard === 'business' ? 'chevron-up' : 'chevron-forward'} size={16} color={UI.text3} />
          </View>
          {openCard === 'business' ? (
            <View style={styles.cardBody}>
              <DetailRow icon="business-outline" label="Business name" value={displayValue(profile?.businessName)} />
              <DetailRow icon="school-outline" label="Qualification" value={displayValue(profile?.qualification)} />
              <DetailRow icon="briefcase-outline" label="Experience" value={experience ? `${experience} years` : 'Not provided'} />
              <DetailRow icon="ribbon-outline" label="Partner status" value={statusLabel} />
              <DetailRow icon="time-outline" label="Partner since" value={profile?.partnerSince ? new Date(profile.partnerSince).toLocaleDateString('en-IN') : 'Not provided'} last />
            </View>
          ) : null}
        </TouchableOpacity>

        {/* ══ BANKING & PAYOUT — collapsed card (example.html menu item) ══ */}
        <TouchableOpacity activeOpacity={0.85} accessibilityLabel="Bank and payout details" onPress={() => toggleCard('bank')} style={[styles.card, { borderColor: UI.bd }]}>
          <View style={styles.cardHead}>
            <View style={[styles.cardIcon, { backgroundColor: UI.amberLight }]}><Ionicons name="server-outline" size={16} color={UI.amberText2} /></View>
            <View style={styles.flexOne}>
              <Text style={[styles.cardTitle, { color: UI.text }]}>Bank & Payout Details</Text>
              <Text style={[styles.cardSub, { color: UI.text3 }]}>{bank.accountNumberMasked ? `${bank.bankName || 'Bank'} · ${bank.accountNumberMasked}` : 'Not added'}</Text>
            </View>
            <Ionicons name={openCard === 'bank' ? 'chevron-up' : 'chevron-forward'} size={16} color={UI.text3} />
          </View>
          {openCard === 'bank' ? (
            <View style={styles.cardBody}>
              <DetailRow icon="person-outline" label="Account holder" value={displayValue(bank.accountHolderName)} />
              <DetailRow icon="card-outline" label="Account number" value={displayValue(bank.accountNumberMasked)} />
              <DetailRow icon="business-outline" label="Bank" value={displayValue(bank.bankName)} />
              <DetailRow icon="keypad-outline" label="IFSC" value={displayValue(bank.ifscCode)} last />
              <Text style={[styles.privacyNote, { color: UI.text3 }]}>Account number is masked for your security.</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        {/* ══ DOCUMENTS & CERTIFICATIONS — collapsed card ══ */}
        <TouchableOpacity activeOpacity={0.85} accessibilityLabel="Documents" onPress={() => toggleCard('docs')} style={[styles.card, { borderColor: UI.bd }]}>
          <View style={styles.cardHead}>
            <View style={[styles.cardIcon, { backgroundColor: UI.greenLight }]}><Ionicons name="document-text-outline" size={16} color={UI.greenText} /></View>
            <View style={styles.flexOne}>
              <Text style={[styles.cardTitle, { color: UI.text }]}>Documents & Certifications</Text>
              <Text style={[styles.cardSub, { color: UI.text3 }]}>{documents.length ? `${verifiedDocs} verified · ${documents.length} total` : 'No documents uploaded'}</Text>
            </View>
            <Ionicons name={openCard === 'docs' ? 'chevron-up' : 'chevron-forward'} size={16} color={UI.text3} />
          </View>
          {openCard === 'docs' ? (
            <View style={styles.cardBody}>
              {documents.length > 0 ? documents.map((doc, idx) => (
                <View key={`${doc.type || 'document'}-${idx}`} style={[styles.docRow, idx === documents.length - 1 ? null : styles.rowLastBorder]}>
                  <Ionicons name={doc.status === 'verified' || doc.status === 'approved' ? 'ribbon' : 'document-text-outline'} size={17} color={documentStatusColor(doc.status)} />
                  <View style={styles.flexOne}>
                    <Text style={[styles.docName, { color: UI.text }]}>{doc.type?.replaceAll('_', ' ') || doc.fileName || 'Document'}</Text>
                    <Text style={[styles.docStatus, { color: documentStatusColor(doc.status) }]}>{(doc.status || 'pending').replaceAll('_', ' ')}</Text>
                  </View>
                  <Ionicons
                    name={doc.status === 'verified' || doc.status === 'approved' ? 'checkmark-circle' : doc.status === 'rejected' ? 'close-circle' : 'time-outline'}
                    size={17}
                    color={documentStatusColor(doc.status)}
                  />
                </View>
              )) : (
                <Text style={[styles.emptyCopy, { color: UI.text3 }]}>No documents are available on your profile yet.</Text>
              )}
            </View>
          ) : null}
        </TouchableOpacity>

        <AppearanceSwitch />

        {/* ══ Menu — Help + Edit + Logout ══ */}
        <View style={[styles.menuBlock, { marginTop: 18 }]}>
          <MenuRow
            emoji="🎧"
            bg={UI.blueLight}
            label="Help & Support"
            sub="FAQs, contacts, payout queries and policies"
            onPress={() => navigation.navigate('HelpSupport')}
          />
          <MenuRow
            emoji="✏️"
            bg={UI.amberLight}
            label="Edit personal details"
            sub="Update personal and qualification information"
            onPress={beginPersonalEdit}
          />
          <MenuRow
            emoji="🔒"
            bg={UI.redLight}
            label="Logout"
            onPress={logout}
            danger
            last
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
};

/* Menu row — mockup .menu-row: 34px tinted emoji chip + chevron */
const MenuRow: React.FC<{
  emoji: string;
  bg: string;
  label: string;
  sub?: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}> = ({ emoji, bg, label, sub, onPress, danger = false, last = false }) => (
  <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={0.85} style={[styles.menuRow, last ? null : styles.menuRowBorder, { borderBottomColor: UI.bd }]}>
    <View style={[styles.micon, { backgroundColor: bg }]}><Text style={styles.miconText}>{emoji}</Text></View>
    <View style={styles.flexOne}>
      <Text style={[styles.mlabel, { color: danger ? UI.red : UI.text }]}>{label}</Text>
      {sub ? <Text style={[styles.msub, { color: UI.text3 }]}>{sub}</Text> : null}
    </View>
    <Text style={[styles.marr, { color: UI.text3 }]}>›</Text>
  </TouchableOpacity>
);

/* Detail row — hairline separated label/value pair inside expanded cards */
const DetailRow: React.FC<{
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  last?: boolean;
}> = ({ icon, label, value, last = false }) => (
  <View style={[styles.detailRow, { borderBottomColor: UI.bd }, last && styles.rowLast]}>
    <Ionicons name={icon} size={16} color={UI.blue} style={styles.detailIcon} />
    <View style={styles.flexOne}>
      <Text style={[styles.detailLabel, { color: UI.text2 }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: UI.text }]}>{value}</Text>
    </View>
  </View>
);

const theme_roleLabel = (role?: string) => ({
  service_partner: 'Service Partner',
  repairing_partner: 'Repairing Partner',
  panel_maker: 'Panel Maker',
  supplier: 'Supplier',
}[role || 'service_partner'] || 'Partner');

const build_styles = () => StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 60 },
  flexOne: { flex: 1 },

  headerWrap: { backgroundColor: UI.surface },
  tb: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 46, paddingHorizontal: 18, borderBottomWidth: 1 },
  tbSide: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center' },
  tbBack: { fontSize: 25, fontWeight: '700', marginTop: -3 },
  tbTitle: { fontSize: 15, fontWeight: '700' },

  page: { paddingBottom: 32 },

  /* COMPACT hero — horizontal layout: 64px avatar + text block, tight padding */
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 14, paddingBottom: 14, paddingHorizontal: 18, borderBottomWidth: 1, backgroundColor: UI.surface },
  avatarWrap: { position: 'relative' },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: UI.blueLight, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 22, fontWeight: '800', color: UI.blueText },
  avatarImage: { width: 64, height: 64, borderRadius: 32 },
  avatarCamera: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: UI.red, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  heroCenter: { flex: 1 },
  heroName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  heroRole: { fontSize: 12.5, fontWeight: '500', marginTop: 2 },
  heroMeta: { fontSize: 11.5, fontWeight: '500', marginTop: 3 },

  /* mini badge strip below the hero */
  stripRow: { flexDirection: 'row', gap: 8, marginTop: 12, paddingHorizontal: 18, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  /* Collapsible info cards */
  card: { backgroundColor: UI.surface, borderWidth: 1, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginTop: 12, marginHorizontal: 18 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  cardIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '600' },
  cardSub: { fontSize: 11.5, fontWeight: '500', marginTop: 2 },
  cardBody: { marginTop: 12, paddingTop: 2 },
  privacyNote: { fontSize: 11, marginTop: 8 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  expertiseSection: { gap: 8 },
  pendingSection: { borderTopWidth: 1, borderTopColor: UI.bd, marginTop: 12, paddingTop: 12 },
  expertiseHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  expertiseHeadingText: { fontSize: 11.5, fontWeight: '800' },
  approvedTag: { backgroundColor: UI.greenLight, borderColor: UI.green, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  approvedTagText: { fontSize: 12, fontWeight: '700', color: UI.greenText },
  pendingTag: { backgroundColor: UI.amberLight, borderColor: UI.amber, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  pendingTagText: { fontSize: 12, fontWeight: '700', color: UI.amberText2 },
  sectionTitle: { marginHorizontal: 18, marginTop: 18, marginBottom: 8, color: UI.text2, fontSize: 11, fontWeight: '800', letterSpacing: 0.55, textTransform: 'uppercase' },
  specializationCard: { backgroundColor: UI.surface, borderWidth: 1, borderRadius: 12, padding: 14, marginHorizontal: 18, marginBottom: 2 },
  specializationFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  specializationCaption: { flex: 1, fontSize: 12, lineHeight: 17 },
  specializationEdit: { color: UI.red, fontSize: 13, fontWeight: '700' },

  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1 },
  docName: { fontSize: 13, fontWeight: '700' },
  docStatus: { fontSize: 11, marginTop: 1, fontWeight: '500' },

  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  detailIcon: { marginTop: 2, width: 18 },
  detailLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  detailValue: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  emptyCopy: { fontSize: 13, paddingVertical: 6 },

  /* role account switcher under the hero */
  roleAccountRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 18, marginTop: 12 },
  roleAccountButton: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: UI.bd2, backgroundColor: UI.surface },
  roleAccountButtonActive: { backgroundColor: UI.blueLight, borderColor: UI.blue, borderWidth: 1.5 },
  roleAccountText: { fontSize: 11.5, fontWeight: '700', color: UI.text2 },
  roleAccountTextActive: { color: UI.blueText },
  profileError: { fontSize: 11.5, fontWeight: '600', color: UI.red, marginHorizontal: 18, marginTop: 10 },

  areaEditRow: { gap: 8, marginBottom: 12 },
  removeArea: { fontSize: 12, fontWeight: '700', color: UI.red, alignSelf: 'flex-end', paddingVertical: 4 },
  addAreaButton: { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: UI.blue, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginTop: 4 },
  addAreaText: { fontSize: 12.5, fontWeight: '700', color: UI.blueText },
  saveProfileButton: { marginTop: 12 },

  /* menu list */
  menuBlock: { backgroundColor: UI.surface, borderWidth: 1, borderColor: UI.bd, borderRadius: 12, overflow: 'hidden', marginHorizontal: 18 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 18, borderBottomWidth: 1 },
  menuRowBorder: { borderBottomWidth: 1 },
  micon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  miconText: { fontSize: 15 },
  mlabel: { fontSize: 14, fontWeight: '600' },
  msub: { fontSize: 11, marginTop: 2 },
  marr: { fontSize: 18, fontWeight: '600' },
  rowLast: { borderBottomWidth: 0 },
  rowLastBorder: { borderBottomWidth: 1 },
  bottomSpacer: { height: 24 },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
