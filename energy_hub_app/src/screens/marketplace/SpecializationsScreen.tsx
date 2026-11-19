import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../../components/AppButton';
import { AppHeader, goBackOrHome } from '../../components/AppHeader';
import { AppTextInput } from '../../components/AppTextInput';
import { registerThemeStyles, theme } from '../../components/theme';
import { apiService } from '../../services/api';
import { readFileAsBase64 } from '../../services/fileStorage';
import { launchImageLibraryAsync } from '../../services/imagePicker';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import { categorySignature, readSpecializationState } from './specializationProfile';

type SkillGroup = { title: string; options: string[] };
type Specialization = { key: string; title: string; summary: string; icon: string; enabled: boolean; locked?: boolean; groups: SkillGroup[] };
type DeliveryVerification = { status: string; vehicleType?: string; vehicleNumber?: string };
type ExpertiseReviewStatus = 'unsubmitted' | 'pending' | 'approved' | 'rejected';
type LicensePhoto = { uri: string; fileName: string; base64?: string };
type CardSaveState = { saving: boolean; saved: boolean; error: string };

const DELIVERY_VEHICLES = ['Bike / Scooter', 'Car', 'Van / Tempo'];
const skillSelectionKey = (group: string, skill: string) => `${group}::${skill}`;

const DEFAULT_SPECIALIZATIONS: Specialization[] = [
  {
    key: 'electrician', title: 'Electrician', summary: 'Wiring, panels, repair', icon: '⚡', enabled: true,
    groups: [{ title: 'Electrical work', options: ['General Wiring & Repair', 'HT / LT Panel Work', 'MCB / MCCB / RCCB', 'Earthing & Lightning', 'Cable Laying & Termination', 'Transformer Maintenance', 'Energy Meter / Billing'] }],
  },
  {
    key: 'plcScada', title: 'PLC / SCADA', summary: 'Programming, HMI, faults', icon: '▣', enabled: false,
    groups: [
      { title: 'PLC Programming', options: ['Siemens', 'Allen Bradley / Rockwell', 'Mitsubishi', 'Schneider (Modicon)', 'Delta', 'Omron'] },
      { title: 'SCADA', options: ['WinCC', 'iFIX', 'Wonderware', 'Citect'] },
      { title: 'HMI Programming', options: ['Weintek', 'Siemens HMI', 'Delta HMI', 'Pro-face'] },
      { title: 'Communication / Networking', options: ['Profibus', 'Profinet', 'Modbus', 'OPC-UA'] },
    ],
  },
  {
    key: 'vfdDrives', title: 'VFD / Drives', summary: 'Servo, motor, inverter', icon: '↻', enabled: true,
    groups: [
      { title: 'VFD parameter tuning', options: ['ABB Drive', 'Siemens SINAMICS', 'Danfoss', 'Schneider Altivar (ATV)', 'Delta / Yaskawa', 'DC Drive'] },
      { title: 'Servo / motion control', options: ['Yaskawa', 'Panasonic', 'Mitsubishi', 'Siemens', 'Fanuc', 'Bosch Rexroth'] },
      { title: 'Motor service', options: ['Motor Winding / Rewinding'] },
    ],
  },
  { key: 'panelMcc', title: 'Panel / MCC', summary: 'Build, repair, upgrade', icon: '▰', enabled: false, groups: [{ title: 'Panel work', options: ['MCC Panel Fault / Repair', 'VFD Panel Build / Repair', 'Control Panel Wiring', 'Busbar / ACB / VCB', 'Capacitor Bank / APFC'] }] },
  { key: 'cabling', title: 'Cabling', summary: 'HT/LT, fiber, LAN', icon: '⌁', enabled: false, groups: [{ title: 'Cabling', options: ['Power Cable — HT / LT', 'Instrumentation Cabling', 'Fiber Optic', 'Structured LAN / Network'] }] },
  {
    key: 'complianceAudit', title: 'Compliance & Audit', summary: 'IS/IEC, compliance', icon: '▤', enabled: true,
    groups: [{ title: 'Compliance & audit', options: ['IS 5216 Electrical Safety', 'Fire NOC Compliance', 'Energy Audit', 'Arc Flash Study'] }],
  },
];

const REPAIR_CENTER_SPECIALIZATION: Specialization = {
  key: 'repairCenter',
  title: 'Repair Center',
  summary: 'Service-center bench work — hardware & brand match',
  icon: '🏭',
  enabled: true,
  locked: true,
  groups: [
    { title: 'VFD', options: ['ABB', 'Siemens', 'Schneider', 'Delta', 'Danfoss', 'Mitsubishi', 'Yaskawa', 'Fuji Electric', 'L&T / L&K', 'Allen-Bradley'] },
    { title: 'PLC', options: ['Siemens', 'Allen-Bradley', 'Mitsubishi', 'Schneider (Modicon)', 'Delta', 'Omron', 'ABB', 'Fuji Electric'] },
    { title: 'Servo Drives', options: ['Yaskawa', 'Panasonic', 'Mitsubishi', 'Siemens', 'ABB', 'Delta', 'Fanuc', 'Bosch Rexroth'] },
    { title: 'HMI', options: ['Siemens', 'Weintek', 'Delta', 'Pro-face (Schneider)', 'Mitsubishi', 'ABB', 'Omron'] },
    { title: 'Soft Starter', options: ['ABB', 'Siemens', 'Schneider', 'L&T', 'Danfoss'] },
    { title: 'Power Supply', options: ['Mean Well', 'Omron', 'Siemens', 'ABB', 'Phoenix Contact'] },
    { title: 'Temperature Controller', options: ['General / Any Brand'] },
  ],
};

const PANEL_FABRICATION_SPECIALIZATION: Specialization = {
  key: 'panelFabrication',
  title: 'Panel Fabrication',
  summary: 'Manufacturing only — panel type & brand match',
  icon: '🛠️',
  enabled: true,
  locked: true,
  groups: [
    { title: 'New Starter & MCB Panel', options: ['ABB', 'Siemens', 'L&T', 'Schneider', 'Havells'] },
    { title: 'VFD Panel', options: ['ABB', 'Siemens', 'Danfoss', 'Delta', 'Schneider'] },
    { title: 'Control Panel', options: ['Siemens', 'Allen-Bradley', 'Schneider (Modicon)', 'Mitsubishi'] },
    { title: 'Distribution Board', options: ['L&T', 'Schneider', 'Havells', 'ABB', 'Legrand'] },
    { title: 'APFC / Capacitor Bank', options: ['L&T', 'Schneider', 'ABB', 'Epcos'] },
    { title: 'Earthing Systems', options: ['General / Any Brand'] },
  ],
};

const REPAIR_CENTER_DEFAULT_SKILLS = {
  repairCenter: [
    skillSelectionKey('VFD', 'ABB'),
    skillSelectionKey('VFD', 'Siemens'),
    skillSelectionKey('PLC', 'Siemens'),
  ],
};
const PANEL_FABRICATION_DEFAULT_SKILLS = {
  panelFabrication: [
    skillSelectionKey('New Starter & MCB Panel', 'ABB'),
    skillSelectionKey('New Starter & MCB Panel', 'Siemens'),
    skillSelectionKey('VFD Panel', 'ABB'),
    skillSelectionKey('Distribution Board', 'L&T'),
  ],
};

const DEFAULT_SELECTED_SKILLS: Record<string, string[]> = {
  electrician: [
    skillSelectionKey('Electrical work', 'General Wiring & Repair'),
    skillSelectionKey('Electrical work', 'HT / LT Panel Work'),
    skillSelectionKey('Electrical work', 'Earthing & Lightning'),
  ],
  vfdDrives: [
    skillSelectionKey('VFD parameter tuning', 'ABB Drive'),
    skillSelectionKey('VFD parameter tuning', 'Siemens SINAMICS'),
  ],
  complianceAudit: [skillSelectionKey('Compliance & audit', 'IS 5216 Electrical Safety')],
};

export const SpecializationsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { colors } = useUserPreferences();
  const accentColors = {
    primaryLight: colors.primaryLight,
    border: colors.border,
    secondaryText: colors.secondaryText,
    surface: colors.surface,
    primary: colors.primary,
    surfaceVariant: colors.background,
    successLight: '#ECFDF3',
    successDark: theme.colors.successDark,
    warningLight: theme.colors.warningLight,
    warningDark: theme.colors.warningDark,
  };
  const [specializations, setSpecializations] = useState(DEFAULT_SPECIALIZATIONS);
  const [accountRole, setAccountRole] = useState('service_partner');
  const [selectedSkills, setSelectedSkills] = useState<Record<string, string[]>>(DEFAULT_SELECTED_SKILLS);
  const [registrationId, setRegistrationId] = useState<string | null>(null);
  const [isServicePartner, setIsServicePartner] = useState(false);
  const [deliveryExpanded, setDeliveryExpanded] = useState(false);
  const [deliveryVerification, setDeliveryVerification] = useState<DeliveryVerification | null>(null);
  const [vehicleType, setVehicleType] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [licensePhoto, setLicensePhoto] = useState<LicensePhoto | null>(null);
  const [submittingDelivery, setSubmittingDelivery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewStatus, setReviewStatus] = useState<ExpertiseReviewStatus>('unsubmitted');
  const [savedSignatures, setSavedSignatures] = useState<Record<string, string>>({});
  const [cardStates, setCardStates] = useState<Record<string, CardSaveState>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiService.getProfile();
        const profile = response.data || {};
        const role = profile.role || 'service_partner';
        setAccountRole(role);
        const roleSpecializations = role === 'repairing_partner'
          ? [REPAIR_CENTER_SPECIALIZATION]
          : role === 'panel_maker'
            ? [PANEL_FABRICATION_SPECIALIZATION]
            : role === 'supplier'
              ? []
              : DEFAULT_SPECIALIZATIONS;
        setSpecializations(roleSpecializations);
        setSelectedSkills((current) => ({
          ...current,
          ...(role === 'repairing_partner' ? REPAIR_CENTER_DEFAULT_SKILLS : {}),
          ...(role === 'panel_maker' ? PANEL_FABRICATION_DEFAULT_SKILLS : {}),
        }));
        setRegistrationId(profile.registrationId || null);
        const specializationState = readSpecializationState(profile.specializations);
        setReviewStatus(profile.specializationStatus || specializationState.status || 'unsubmitted');
        setIsServicePartner(profile.role === 'service_partner');
        if (profile.role === 'service_partner') {
          const verificationResponse = await apiService.getDeliveryVerification();
          const verification = verificationResponse.data || null;
          setDeliveryVerification(verification);
          setDeliveryExpanded(!verification);
          if (verification) {
            setVehicleType(verification.vehicleType || '');
            setVehicleNumber(verification.vehicleNumber || '');
          }
        }
        const stored = profile.specializations;
        if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
          const storedRecord = stored as Record<string, unknown>;
          setReviewStatus((storedRecord.approvalStatus as ExpertiseReviewStatus) || profile.specializationStatus || 'unsubmitted');
          const categories = storedRecord.categories;
          const storedCategories = categories && typeof categories === 'object' && !Array.isArray(categories)
            ? categories as Record<string, unknown>
            : storedRecord;
          setSpecializations((current) => current.map((item) => {
            const value = storedCategories[item.key];
            const settings = value && typeof value === 'object' && !Array.isArray(value)
              ? value as { enabled?: unknown }
              : null;
            return settings && typeof settings.enabled === 'boolean'
              ? { ...item, enabled: item.locked ? true : settings.enabled }
              : item;
          }));
          setSelectedSkills((current) => {
            const next = { ...current, ...(role === 'repairing_partner' ? REPAIR_CENTER_DEFAULT_SKILLS : {}) };
            Object.entries(storedCategories).forEach(([key, value]) => {
              const settings = value && typeof value === 'object' && !Array.isArray(value)
                ? value as { skills?: unknown; groups?: unknown }
                : null;
              if (!settings) return;
              const storedGroups = settings.groups && typeof settings.groups === 'object' && !Array.isArray(settings.groups)
                ? settings.groups as Record<string, unknown>
                : null;
              if (storedGroups) {
                next[key] = Object.entries(storedGroups).flatMap(([group, skills]) => (
                  Array.isArray(skills) && skills.every((skill) => typeof skill === 'string')
                    ? skills.map((skill) => skillSelectionKey(group, skill))
                    : []
                ));
              } else if (Array.isArray(settings.skills)) {
                const category = roleSpecializations.find((item) => item.key === key);
                const legacySkills = settings.skills.filter((skill): skill is string => typeof skill === 'string');
                next[key] = category
                  ? category.groups.flatMap((group) => legacySkills
                    .filter((skill) => group.options.includes(skill))
                    .map((skill) => skillSelectionKey(group.title, skill)))
                  : legacySkills;
              }
            });
            return next;
          });
        }
        const initialCategories = readSpecializationState(stored).categories;
        const initialSignatures: Record<string, string> = {};
        roleSpecializations.forEach((item) => {
          const storedCategory = initialCategories[item.key];
          const selections = storedCategory?.groups && typeof storedCategory.groups === 'object' && !Array.isArray(storedCategory.groups)
            ? Object.entries(storedCategory.groups).flatMap(([group, skills]) => (
              Array.isArray(skills)
                ? skills.filter((skill): skill is string => typeof skill === 'string').map((skill) => skillSelectionKey(group, skill))
                : []
            ))
            : Array.isArray(storedCategory?.skills)
              ? item.groups.flatMap((group) => (storedCategory.skills as unknown[])
                .filter((skill): skill is string => typeof skill === 'string' && group.options.includes(skill))
                .map((skill) => skillSelectionKey(group.title, skill)) || [])
              : (role === 'repairing_partner'
                ? REPAIR_CENTER_DEFAULT_SKILLS[item.key as keyof typeof REPAIR_CENTER_DEFAULT_SKILLS] || []
                : role === 'panel_maker'
                  ? PANEL_FABRICATION_DEFAULT_SKILLS[item.key as keyof typeof PANEL_FABRICATION_DEFAULT_SKILLS] || []
                  : DEFAULT_SELECTED_SKILLS[item.key] || []);
          initialSignatures[item.key] = categorySignature(item.locked ? true : storedCategory?.enabled ?? item.enabled, selections);
        });
        setSavedSignatures(initialSignatures);
      } catch (loadError: any) {
        setError(loadError.response?.data?.message || 'Could not load your saved specializations.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const toggleCategory = (key: string, enabled: boolean) => {
    setCardStates((current) => ({ ...current, [key]: { saving: false, saved: false, error: '' } }));
    setSpecializations((current) => current.map((item) => item.key === key ? { ...item, enabled } : item));
  };

  const toggleSkill = (key: string, group: string, skill: string) => {
    setCardStates((current) => ({ ...current, [key]: { saving: false, saved: false, error: '' } }));
    setSelectedSkills((current) => {
      const skills = current[key] || [];
      const selection = skillSelectionKey(group, skill);
      return {
        ...current,
        [key]: skills.includes(selection) ? skills.filter((item) => item !== selection) : [...skills, selection],
      };
    });
  };

  const buildPayload = () => ({
    categories: Object.fromEntries(specializations.map((item) => [
      item.key,
      (() => {
        const selected = selectedSkills[item.key] || [];
        const groups = Object.fromEntries(item.groups.map((group) => [
          group.title,
          group.options.filter((skill) => selected.includes(skillSelectionKey(group.title, skill))),
        ]));
        const skills = [...new Set(Object.values(groups).flat())];
        return { enabled: item.locked ? true : item.enabled, skills, groups };
      })(),
    ])),
  });

  const returnToProfileIfPresent = () => {
    const routes = navigation.getState?.()?.routes;
    if (Array.isArray(routes) && routes.some((route: { name?: string }) => route.name === 'PartnerProfile')) {
      navigation.navigate('PartnerProfile');
    }
  };

  const saveCategory = async (key: string) => {
    if (!registrationId) {
      setCardStates((current) => ({
        ...current,
        [key]: { saving: false, saved: false, error: 'Complete partner registration before saving this specialization.' },
      }));
      return;
    }
    setCardStates((current) => ({ ...current, [key]: { saving: true, saved: false, error: '' } }));
    try {
      const response = await apiService.saveSpecializations(registrationId, buildPayload());
      const submittedStatus = response.data?.specializationStatus || 'pending';
      setReviewStatus(submittedStatus);
      const category = specializations.find((item) => item.key === key);
      if (category) {
        setSavedSignatures((current) => ({
          ...current,
          [key]: categorySignature(category.locked ? true : category.enabled, selectedSkills[key] || []),
        }));
      }
      setCardStates((current) => ({ ...current, [key]: { saving: false, saved: true, error: '' } }));
      returnToProfileIfPresent();
    } catch (saveError: any) {
      setCardStates((current) => ({
        ...current,
        [key]: { saving: false, saved: false, error: saveError.response?.data?.message || 'Could not save this specialization.' },
      }));
    }
  };

  const chooseLicensePhoto = async () => {
    try {
      const result = await launchImageLibraryAsync({ quality: 0.8, includeBase64: true });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setLicensePhoto({
          uri: asset.uri,
          fileName: asset.fileName || 'driving-license.jpg',
          base64: asset.base64,
        });
        setError('');
      }
    } catch (pickerError) {
      setError(pickerError instanceof Error ? pickerError.message : 'Could not select the license photo.');
    }
  };

  const submitDelivery = async () => {
    if (!registrationId) {
      setError('Your partner registration was not found. Complete registration before applying for delivery work.');
      return;
    }
    if (!vehicleType || !vehicleNumber.trim() || !licensePhoto) {
      setError('Select a vehicle type, enter its registration number, and add a license photo.');
      return;
    }
    setSubmittingDelivery(true);
    setError('');
    try {
      const file = licensePhoto.base64 || await readFileAsBase64(licensePhoto.uri);
      const uploadResponse = await apiService.uploadDocument(
        registrationId,
        file,
        'driving_license_photo',
        licensePhoto.fileName,
      );
      const licenseDocumentId = Number(uploadResponse.data?.id);
      if (!Number.isInteger(licenseDocumentId) || licenseDocumentId <= 0) {
        throw new Error('The driving license upload did not return a document reference. Please try again.');
      }
      const verificationResponse = await apiService.submitDeliveryVerification({
        vehicleType,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        licenseDocumentId,
      });
      setDeliveryVerification(verificationResponse.data);
      setDeliveryExpanded(false);
      setLicensePhoto(null);
    } catch (submitError: any) {
      setError(submitError.response?.data?.message || submitError.message || 'Could not submit delivery verification.');
    } finally {
      setSubmittingDelivery(false);
    }
  };

  const isCategoryDirty = (category: Specialization) => (
    savedSignatures[category.key] !== categorySignature(
      category.locked ? true : category.enabled,
      selectedSkills[category.key] || [],
    )
  );

  if (loading) {
    return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} style={styles.loader} /></SafeAreaView>;
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Specializations & Brands" onBack={() => goBackOrHome(navigation)} />
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {accountRole !== 'supplier' ? (
          <View style={[styles.infoCard, { backgroundColor: colors.primaryLight, borderColor: accentColors.border }]}>
            <Ionicons name="information-circle-outline" size={19} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.primary }]}>Turn on the categories you work in, then choose the specific brands and skills you know. Jobs are matched to your selected skills.</Text>
          </View>
        ) : null}

        {accountRole === 'supplier' ? (
          <View style={[styles.infoCard, { backgroundColor: colors.primaryLight, borderColor: accentColors.border }]}>
            <Ionicons name="information-circle-outline" size={19} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.primary }]}>Suppliers manage product categories and brands on each catalog listing; an account-wide skills matrix does not apply.</Text>
          </View>
        ) : null}

        {specializations.map((category) => (
          <View key={category.key} style={[styles.categoryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.categoryHeader}>
              <View style={[styles.categoryIcon, { backgroundColor: theme.colors.surfaceVariant }, category.enabled && { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.categoryIconText, { color: colors.primary }]}>{category.icon}</Text>
              </View>
              <View style={styles.categoryCopy}>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>{category.title}</Text>
                <Text style={[styles.categorySummary, { color: colors.secondaryText }]}>{category.summary}</Text>
              </View>
              {category.locked ? (
                <Text style={[styles.activeBadge, { color: accentColors.successDark, backgroundColor: accentColors.successLight }]}>✓ Always active</Text>
              ) : (
                <TouchableOpacity
                  accessibilityRole="switch"
                  accessibilityState={{ checked: category.enabled }}
                  accessibilityLabel={`${category.enabled ? 'Disable' : 'Enable'} ${category.title}`}
                  onPress={() => toggleCategory(category.key, !category.enabled)}
                  activeOpacity={theme.interaction.pressedOpacity}
                  style={[
                    styles.categoryToggle,
                    { borderColor: category.enabled ? theme.colors.success : theme.colors.borderStrong },
                    { backgroundColor: category.enabled ? theme.colors.success : theme.colors.surfaceVariant },
                  ]}
                >
                  <View style={[styles.categoryToggleThumb, category.enabled ? styles.categoryToggleThumbOn : styles.categoryToggleThumbOff]} />
                </TouchableOpacity>
              )}
            </View>
            {category.enabled ? (
              <View style={[styles.skillContent, { borderTopColor: colors.border }]}>
                {category.key === 'repairCenter' ? (
                  <Text style={[styles.infoText, styles.categoryNote, { color: colors.secondaryText }]}>Bench-repair requests are matched to your selected hardware types and brands.</Text>
                ) : null}
                {category.key === 'panelFabrication' ? (
                  <Text style={[styles.infoText, styles.categoryNote, { color: colors.secondaryText }]}>Project requests are matched to your selected panel types and preferred brands. On-site installation is handled by a Service Partner.</Text>
                ) : null}
                {category.groups.map((group) => (
                  <View key={group.title} style={styles.skillGroup}>
                    <Text style={[styles.skillGroupTitle, { color: colors.secondaryText }]}>{group.title}</Text>
                    <View style={styles.skillGrid}>
                      {group.options.map((skill) => {
                        const selected = (selectedSkills[category.key] || []).includes(skillSelectionKey(group.title, skill));
                        return (
                          <TouchableOpacity
                            key={skill}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected }}
                            onPress={() => toggleSkill(category.key, group.title, skill)}
                            style={[styles.skillChip, { backgroundColor: colors.surface, borderColor: accentColors.border }, selected && { ...styles.skillChipSelected, borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                          >
                            <Text style={[styles.skillText, { color: colors.secondaryText }, selected && { ...styles.skillTextSelected, color: colors.primary }]}>{skill}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            <View style={[styles.cardSaveRow, { borderTopColor: colors.border }]}>
              <View style={styles.cardSaveMessage}>
                {cardStates[category.key]?.error ? (
                  <Text accessibilityRole="alert" style={styles.cardError}>{cardStates[category.key].error}</Text>
                ) : cardStates[category.key]?.saved ? (
                  <Text style={styles.cardSaved}>Saved · waiting for approval</Text>
                ) : isCategoryDirty(category) ? (
                  <Text style={[styles.cardDirty, { color: colors.secondaryText }]}>Unsaved changes</Text>
                ) : (
                  <Text style={[styles.cardClean, { color: colors.secondaryText }]}>
                    {reviewStatus === 'approved' ? 'Approved and active' : reviewStatus === 'pending' ? 'Waiting for approval' : 'Up to date'}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Save ${category.title}`}
                disabled={!isCategoryDirty(category) || cardStates[category.key]?.saving}
                onPress={() => saveCategory(category.key)}
                style={[
                  styles.cardSaveButton,
                  { backgroundColor: colors.primary },
                  (!isCategoryDirty(category) || cardStates[category.key]?.saving) && styles.cardSaveButtonDisabled,
                ]}
              >
                {cardStates[category.key]?.saving
                  ? <ActivityIndicator size="small" color={theme.colors.white} />
                  : <Text style={styles.cardSaveButtonText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {isServicePartner ? (
          <View style={styles.deliveryCard}>
            <TouchableOpacity
              onPress={() => setDeliveryExpanded((expanded) => !expanded)}
              style={styles.deliveryHeader}
              accessibilityRole="button"
              accessibilityState={{ expanded: deliveryExpanded }}
            >
              <View style={[styles.deliveryIcon, { backgroundColor: accentColors.warningLight }]}><Text style={[styles.deliveryIconText, { color: accentColors.warningDark }]}>↗</Text></View>
              <View style={styles.deliveryCopy}>
                <Text style={[styles.deliveryTitle, { color: colors.text }]}>Delivery Partner</Text>
                <Text style={[styles.deliverySubtitle, { color: colors.secondaryText }]}>
                  {deliveryVerification?.status === 'pending'
                    ? 'Verification pending'
                    : deliveryVerification?.status === 'approved'
                      ? 'Verified delivery partner'
                      : 'Carry repair-center hardware and earn extra'}
                </Text>
              </View>
              <Text style={styles.deliveryChevron}>{deliveryExpanded ? '−' : '+'}</Text>
            </TouchableOpacity>
            {deliveryExpanded ? (
              <View style={styles.deliveryBody}>
                <Text style={styles.deliveryInfo}>
                  Nearby partners are notified when customers request pickup and drop-off for a repair. You will not receive delivery requests while busy.
                </Text>
                {deliveryVerification?.status === 'pending' ? (
                  <View style={styles.deliveryStatus}>
                    <Text style={styles.deliveryStatusTitle}>Pending verification</Text>
                    <Text style={styles.deliveryStatusText}>Your vehicle and license details are being reviewed. Delivery requests will be available after approval.</Text>
                  </View>
                ) : deliveryVerification?.status === 'approved' ? (
                  <View style={styles.deliveryStatus}>
                    <Text style={styles.deliveryStatusTitle}>Delivery partner verified</Text>
                    <Text style={styles.deliveryStatusText}>{deliveryVerification.vehicleType} · {deliveryVerification.vehicleNumber}</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.deliveryFieldLabel}>Vehicle type</Text>
                    <View style={styles.vehicleOptions}>
                      {DELIVERY_VEHICLES.map((vehicle) => (
                        <TouchableOpacity
                          key={vehicle}
                          onPress={() => setVehicleType(vehicle)}
                          style={[styles.vehicleOption, vehicleType === vehicle && styles.vehicleOptionSelected]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: vehicleType === vehicle }}
                        >
                          <Text style={[styles.vehicleOptionText, vehicleType === vehicle && styles.vehicleOptionTextSelected]}>{vehicle}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <AppTextInput
                      label="Vehicle number"
                      value={vehicleNumber}
                      onChangeText={setVehicleNumber}
                      placeholder="e.g. RJ14 XX 1234"
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity onPress={chooseLicensePhoto} style={styles.licenseUpload} accessibilityRole="button">
                      {licensePhoto ? <Image source={{ uri: licensePhoto.uri }} style={styles.licensePreview} /> : <Text style={styles.licensePlus}>+</Text>}
                      <View style={styles.deliveryCopy}>
                        <Text style={styles.deliveryFieldLabel}>Driving license</Text>
                        <Text style={styles.deliverySubtitle}>{licensePhoto?.fileName || 'Choose a clear photo from your device'}</Text>
                      </View>
                      <Text style={styles.deliveryLink}>{licensePhoto ? 'Change' : 'Add'}</Text>
                    </TouchableOpacity>
                    <AppButton title="Submit for verification" onPress={submitDelivery} loading={submittingDelivery} />
                  </>
                )}
              </View>
            ) : null}
          </View>
        ) : null}

        {accountRole === 'service_partner' ? (
          <>
            <View style={styles.restrictedCard}>
              <Text style={styles.restrictedTitle}>Repair Center — Repairing Partners only</Text>
              <Text style={styles.restrictedCopy}>Requires business registration and a shop licence. Contact support to register as a Repairing Partner.</Text>
            </View>
            <View style={styles.restrictedCard}>
              <Text style={styles.restrictedTitle}>Panel Fabrication — Panel Makers only</Text>
              <Text style={styles.restrictedCopy}>Requires a fabrication unit address and shop licence. Contact support to register as a Panel Maker.</Text>
            </View>
          </>
        ) : null}

        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {accountRole !== 'supplier' ? (
          <>
            {reviewStatus === 'pending' ? <Text style={styles.reviewPending}>Expertise saved — waiting for administrator approval. Matching jobs appear after approval.</Text> : null}
            {reviewStatus === 'approved' ? <Text style={styles.reviewApproved}>Expertise approved. Jobs are matched to your approved skills.</Text> : null}
            {reviewStatus === 'rejected' ? <Text style={styles.reviewRejected}>Expertise was not approved. Update your selections and save again.</Text> : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
};

const build_styles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  page: { padding: theme.spacing.md, paddingBottom: 36 },
  loader: { marginTop: 60 },
  infoCard: { flexDirection: 'row', gap: 10, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.primaryLight, marginBottom: theme.spacing.md },
  infoIcon: { color: theme.colors.primary, fontSize: 15, fontWeight: '800' },
  infoText: { flex: 1, color: theme.colors.primary, fontSize: 12, lineHeight: 18 },
  categoryCard: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, borderWidth: 1, borderColor: theme.colors.border, padding: theme.spacing.md, marginBottom: theme.spacing.sm, ...theme.elevation.low },
  categoryHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' },
  categoryIconActive: { backgroundColor: theme.colors.primaryLight },
  categoryIconText: { color: theme.colors.primary, fontSize: 17, fontWeight: '700' },
  categoryCopy: { flex: 1 },
  categoryTitle: { color: theme.colors.mainText, fontSize: 14, fontWeight: '800' },
  categorySummary: { color: theme.colors.secondaryText, fontSize: 11, marginTop: 2 },
  categoryToggle: { width: 46, height: 26, borderRadius: 13, borderWidth: 1.5, flexShrink: 0 },
  categoryToggleThumb: { position: 'absolute', top: 2, width: 19, height: 19, borderRadius: 10, backgroundColor: theme.colors.white, ...theme.elevation.low },
  categoryToggleThumbOn: { right: 2.5 },
  categoryToggleThumbOff: { left: 2.5 },
  activeBadge: { color: theme.colors.successDark, backgroundColor: theme.colors.successLight, borderRadius: theme.borderRadius.pill, paddingHorizontal: 9, paddingVertical: 5, fontSize: 10, fontWeight: '700', overflow: 'hidden' },
  skillContent: { borderTopWidth: 1, borderTopColor: theme.colors.divider, marginTop: theme.spacing.sm, paddingTop: theme.spacing.md },
  categoryNote: { marginBottom: theme.spacing.sm },
  skillGroup: { marginBottom: theme.spacing.md },
  skillGroupTitle: { color: theme.colors.secondaryText, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 7 },
  skillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  skillChip: { borderWidth: 1, borderColor: theme.colors.borderStrong, backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.pill, paddingHorizontal: 10, paddingVertical: 7 },
  skillChipSelected: { borderColor: theme.colors.primaryAction, backgroundColor: theme.colors.primaryLight },
  skillText: { color: theme.colors.secondaryText, fontSize: 11 },
  skillTextSelected: { color: theme.colors.primary, fontWeight: '700' },
  cardSaveRow: { borderTopWidth: 1, marginTop: theme.spacing.sm, paddingTop: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  cardSaveMessage: { flex: 1 },
  cardDirty: { fontSize: 11, fontWeight: '600' },
  cardClean: { fontSize: 11 },
  cardSaved: { color: theme.colors.successDark, fontSize: 11, fontWeight: '700' },
  cardError: { color: theme.colors.error, fontSize: 11, lineHeight: 15 },
  cardSaveButton: { minWidth: 76, minHeight: 36, borderRadius: theme.borderRadius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  cardSaveButtonDisabled: { opacity: theme.interaction.disabledOpacity },
  cardSaveButtonText: { color: theme.colors.white, fontSize: 12, fontWeight: '800' },
  restrictedCard: { backgroundColor: theme.colors.surfaceVariant, borderColor: theme.colors.border, borderWidth: 1, borderStyle: 'dashed', borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  restrictedTitle: { color: theme.colors.mainText, fontSize: 12, fontWeight: '700' },
  restrictedCopy: { color: theme.colors.secondaryText, fontSize: 11, lineHeight: 16, marginTop: 4 },
  deliveryCard: { backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.lg, borderWidth: 1, borderColor: theme.colors.warning, marginBottom: theme.spacing.md, ...theme.elevation.low },
  deliveryHeader: { minHeight: 68, flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md, gap: 10 },
  deliveryIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.warningLight, alignItems: 'center', justifyContent: 'center' },
  deliveryIconText: { color: theme.colors.warningDark, fontSize: 19, fontWeight: '800' },
  deliveryCopy: { flex: 1 },
  deliveryTitle: { color: theme.colors.mainText, fontSize: 14, fontWeight: '800' },
  deliverySubtitle: { color: theme.colors.secondaryText, fontSize: 11, marginTop: 3 },
  deliveryChevron: { color: theme.colors.warningDark, fontSize: 22, fontWeight: '700', paddingHorizontal: 5 },
  deliveryBody: { borderTopWidth: 1, borderTopColor: theme.colors.divider, padding: theme.spacing.md },
  deliveryInfo: { color: theme.colors.secondaryText, fontSize: 12, lineHeight: 18, marginBottom: theme.spacing.md },
  deliveryFieldLabel: { color: theme.colors.mainText, fontSize: 12, fontWeight: '700', marginBottom: 8 },
  vehicleOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: theme.spacing.md },
  vehicleOption: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.borderRadius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  vehicleOptionSelected: { backgroundColor: theme.colors.warningLight, borderColor: theme.colors.warning },
  vehicleOptionText: { color: theme.colors.secondaryText, fontSize: 11, fontWeight: '600' },
  vehicleOptionTextSelected: { color: theme.colors.warningDark },
  licenseUpload: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.borderRadius.md, padding: 10, marginBottom: theme.spacing.md },
  licensePreview: { width: 60, height: 56, borderRadius: theme.borderRadius.sm },
  licensePlus: { width: 60, height: 56, textAlign: 'center', textAlignVertical: 'center', color: theme.colors.primary, fontSize: 26, backgroundColor: theme.colors.primaryLight, borderRadius: theme.borderRadius.sm, overflow: 'hidden' },
  deliveryLink: { color: theme.colors.primary, fontSize: 11, fontWeight: '700' },
  deliveryStatus: { backgroundColor: theme.colors.warningLight, borderRadius: theme.borderRadius.md, padding: theme.spacing.md },
  deliveryStatusTitle: { color: theme.colors.warningDark, fontSize: 13, fontWeight: '800' },
  deliveryStatusText: { color: theme.colors.warningDark, fontSize: 11, lineHeight: 16, marginTop: 4 },
  error: { color: theme.colors.error, marginVertical: theme.spacing.sm },
  reviewPending: { color: theme.colors.warningDark, backgroundColor: theme.colors.warningLight, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, fontSize: 12, lineHeight: 18, marginTop: theme.spacing.md },
  reviewApproved: { color: theme.colors.successDark, backgroundColor: theme.colors.successLight, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, fontSize: 12, lineHeight: 18, marginTop: theme.spacing.md },
  reviewRejected: { color: theme.colors.errorDark, backgroundColor: theme.colors.errorLight, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, fontSize: 12, lineHeight: 18, marginTop: theme.spacing.md },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
