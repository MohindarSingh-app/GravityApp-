import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { errorCodes, isErrorWithCode, keepLocalCopy, pick, types } from '@react-native-documents/picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../../components/AppButton';
import { AppHeader } from '../../components/AppHeader';
import { AppTextInput } from '../../components/AppTextInput';
import { ErrorMessage } from '../../components/ErrorMessage';
import { SelectionCard } from '../../components/SelectionCard';
import { StepProgress } from '../../components/StepProgress';
import { theme } from '../../components/theme';
import { useRegistration } from '../../providers/RegistrationProvider';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import { apiService } from '../../services/api';
import { readFileAsBase64 } from '../../services/fileStorage';
import { launchImageLibraryAsync } from '../../services/imagePicker';
import { PersonalDetails, ProfessionalDetails, UserRole } from '../../types';

type SectionId = 'personal' | 'professional' | 'documents' | 'serviceArea' | 'review';
type DocumentStatus = 'pending' | 'uploading' | 'uploaded' | 'rejected';
interface RegistrationDocument {
  id: string;
  required: boolean;
  status: DocumentStatus;
  fileName?: string;
}

const PARTNER_TYPES: Array<{ value: UserRole; label: string }> = [
  { value: 'service_partner', label: 'Service Partner' },
  { value: 'repairing_partner', label: 'Repairing Partner' },
  { value: 'panel_maker', label: 'Panel Maker' },
  { value: 'supplier', label: 'Supplier' },
];

const EXPERIENCE_OPTIONS = ['Less than 1 year', '1 – 3 years', '3 – 5 years', '5 – 10 years', '10+ years'];
const QUALIFICATION_OPTIONS = [
  'ITI — Electrician Trade',
  'Diploma — Electrical/Electronics',
  'B.Tech / B.E. — Electrical/Electronics',
  'Other Technical Certification',
];
const SERVICE_AREAS = [
  'Sitapura',
  'Vishwakarma',
  'Malviya Nagar',
  'Mansarovar',
  'Bindayaka',
  'Jagatpura',
  '22 Godam',
  'Bais Godam',
  'Other / All Jaipur',
];

const AREA_PINCODES: Record<string, string> = {
  Sitapura: '302022',
  Vishwakarma: '302013',
  'Malviya Nagar': '302017',
  Mansarovar: '302020',
  Bindayaka: '302012',
  Jagatpura: '302017',
  '22 Godam': '302006',
  'Bais Godam': '302006',
  'Other / All Jaipur': '302001',
};
const TRAVEL_RADII = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 15, label: '15 km' },
  { value: 25, label: '25 km' },
  { value: 0, label: 'No limit (full city)' },
];
const CATEGORIES_BY_ROLE: Record<UserRole, { title: string; options: string[] }> = {
  service_partner: {
    title: 'Primary service categories',
    options: ['Electrician', 'PLC / SCADA', 'VFD / Drives', 'Panel / MCC', 'Cabling', 'Compliance & Audit'],
  },
  repairing_partner: {
    title: 'Hardware you repair',
    options: ['VFD', 'PLC', 'Servo Drives', 'HMI', 'Soft Starter', 'Power Supply', 'Temperature Controller'],
  },
  panel_maker: {
    title: 'Panel types you fabricate',
    options: ['New Starter & MCB Panel', 'VFD Panel', 'Control Panel', 'Distribution Board', 'APFC / Capacitor Bank', 'Earthing Systems'],
  },
  supplier: {
    title: 'Product categories you supply',
    options: ['Switchgear', 'Cables & Wires', 'VFD / Drives', 'PLC / Automation', 'Panel Components', 'Tools & Safety Gear', 'Lighting'],
  },
};
const DOCUMENTS_BY_ROLE: Record<UserRole, Array<{ id: string; label: string; required: boolean }>> = {
  service_partner: [
    { id: 'id_proof', label: 'ID Proof', required: true },
    { id: 'address_proof', label: 'Address Proof', required: true },
    { id: 'educational_certificate', label: 'Educational Certificate', required: true },
    { id: 'certification', label: 'Professional Certifications', required: false },
  ],
  repairing_partner: [
    { id: 'business_registration', label: 'Business Registration', required: true },
    { id: 'gst', label: 'GST Certificate', required: true },
    { id: 'workshop_address', label: 'Workshop Address Proof', required: true },
    { id: 'owner_id', label: "Owner's ID Proof", required: true },
    { id: 'oem_certificate', label: 'Brand / OEM Certifications', required: false },
  ],
  panel_maker: [
    { id: 'gst', label: 'GST Certificate', required: true },
    { id: 'shop_license', label: 'Shop License', required: true },
    { id: 'fabrication_unit_address', label: 'Fabrication Unit Address Proof', required: true },
    { id: 'owner_id', label: "Owner's ID Proof", required: true },
    { id: 'oem_certificate', label: 'Brand / OEM Certifications', required: false },
  ],
  supplier: [
    { id: 'gst', label: 'GST Certificate', required: true },
    { id: 'shop_license', label: 'Shop License', required: true },
    { id: 'address_proof', label: 'Business Address Proof', required: true },
    { id: 'owner_id', label: "Owner's ID Proof", required: true },
  ],
};

const SECTION_LABELS: Record<SectionId, string> = {
  personal: 'Personal',
  professional: 'Professional',
  documents: 'Documents',
  serviceArea: 'Area',
  review: 'Review',
};

const SECTION_ORDER: SectionId[] = ['personal', 'professional', 'documents', 'serviceArea', 'review'];

const SECTION_STEP: Record<SectionId, number> = {
  personal: 1,
  professional: 2,
  documents: 3,
  serviceArea: 4,
  review: 5,
};

const INFO_BOXES: Record<SectionId, { icon: string; text: string }> = {
  personal: {
    icon: '💡',
    text: 'Keep your details accurate. They will be verified during onboarding.',
  },
  professional: {
    icon: 'ℹ️',
    text: 'After approval, you will be able to set up your detailed Specializations & Brand matrix in your profile.',
  },
  documents: {
    icon: '📄',
    text: 'All documents must be clear and valid.',
  },
  serviceArea: {
    icon: '📍',
    text: 'You can update your service areas later from your profile.',
  },
  review: {
    icon: '✅',
    text: 'Make sure everything is correct before submitting.',
  },
};

interface RegistrationFlowProps {
  route: { params: { registrationId: string; mobile: string; email: string; partnerRole?: UserRole } };
  navigation: any;
}

export const RegistrationFlowScreen: React.FC<RegistrationFlowProps> = ({ route, navigation }) => {
  const { registrationId, mobile, email, partnerRole } = route.params;
  const { draft, saveDraft, clearDraft } = useRegistration();
  const { colors } = useUserPreferences();
  const [activeSection, setActiveSection] = useState<SectionId | null>('personal');
  const [completedSections, setCompletedSections] = useState<SectionId[]>([]);
  const [working, setWorking] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [personal, setPersonal] = useState<PersonalDetails>({
    fullName: draft?.personalDetails?.fullName || '',
    dateOfBirth: draft?.personalDetails?.dateOfBirth || '',
    address: draft?.personalDetails?.address || '',
    emergencyContactName: draft?.personalDetails?.emergencyContactName || '',
    emergencyContact: draft?.personalDetails?.emergencyContact || '',
    profilePhoto: draft?.personalDetails?.profilePhoto || '',
  });
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState('image/jpeg');
  const [partnerType, setPartnerType] = useState<UserRole | null>(
    partnerRole || draft?.professionalDetails?.partnerType || null
  );
  const [experience, setExperience] = useState(draft?.professionalDetails?.experience || '');
  const [qualification, setQualification] = useState(draft?.professionalDetails?.qualification || '');
  const [categories, setCategories] = useState<string[]>(draft?.professionalDetails?.categories || []);
  const [documents, setDocuments] = useState<RegistrationDocument[]>([]);
  const [bankDetails, setBankDetails] = useState({
    accountNumber: draft?.bankDetails?.accountNumber || '',
    ifscCode: draft?.bankDetails?.ifscCode || '',
    accountHolderName: draft?.bankDetails?.accountHolderName || '',
    bankName: draft?.bankDetails?.bankName || '',
  });
  const [serviceAreas, setServiceAreas] = useState<string[]>(
    draft?.serviceArea ? draft.serviceArea.split(', ').filter(Boolean) : []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [travelRadiusKm, setTravelRadiusKm] = useState(draft?.travelRadiusKm ?? 15);
  const filteredAreas = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return SERVICE_AREAS;
    return SERVICE_AREAS.filter((area) => {
      const pincode = AREA_PINCODES[area] || '';
      return area.toLowerCase().includes(q) || pincode.includes(q);
    });
  }, [searchQuery]);
  const [consent, setConsent] = useState(false);

  const needsServiceArea = partnerType === 'service_partner' || partnerType === 'repairing_partner';
  const sections = useMemo<Array<{ id: SectionId; title: string; caption: string }>>(() => {
    const flow: Array<{ id: SectionId; title: string; caption: string }> = [
      { id: 'personal', title: 'Personal Details', caption: 'Tell us about yourself' },
      { id: 'professional', title: 'Professional Details', caption: 'Your role and expertise' },
      { id: 'documents', title: 'Documents', caption: 'Required for verification before you go live' },
    ];
    if (needsServiceArea) flow.push({ id: 'serviceArea', title: 'Service Area', caption: 'Select the areas you are willing to travel to for jobs' });
    flow.push({ id: 'review', title: 'Review & Submit', caption: 'Check your application before submitting' });
    return flow;
  }, [needsServiceArea]);

  const currentStep = useMemo(() => {
    return SECTION_ORDER.indexOf(activeSection) + 1;
  }, [activeSection]);

  const roleDocuments = partnerType ? DOCUMENTS_BY_ROLE[partnerType] : [];

  useEffect(() => {
    if (!partnerType) return;
    const required = DOCUMENTS_BY_ROLE[partnerType];
    setDocuments((current) => required.map((item) => {
      const saved = draft?.documents?.find((document: RegistrationDocument) => document.id === item.id);
      const previous = current.find((document) => document.id === item.id);
      return {
        id: item.id,
        required: item.required,
        status: saved?.status || previous?.status || 'pending',
        fileName: saved?.fileName || previous?.fileName,
      };
    }));
  }, [partnerType]);

  useEffect(() => {
    if (!registrationId || !partnerType) return;
    apiService.getDocumentChecklist(registrationId)
      .then((response) => {
        if (!Array.isArray(response.data)) return;
        setDocuments((current) => current.map((document) => {
          const item = response.data.find((entry: { type: string; uploaded?: boolean }) => entry.type === document.id);
          return item?.uploaded ? { ...document, status: 'uploaded' } : document;
        }));
      })
      .catch((loadError: any) => {
        setError(loadError.response?.data?.message || 'Could not load the document checklist.');
      });
  }, [registrationId, partnerType]);

  const markCompleted = (section: SectionId) => {
    setCompletedSections((current) => current.includes(section) ? current : [...current, section]);
  };

  const savePersonal = async () => {
    if (!personal.fullName.trim() || !personal.dateOfBirth.trim() || !personal.address.trim() || !personal.emergencyContactName?.trim() || !personal.emergencyContact.trim()) {
      setError('Complete all required personal details to continue.');
      return false;
    }
    let encodedPhoto = photoBase64;
    let mimeType = photoMimeType;
    if (personal.profilePhoto && !encodedPhoto) {
      encodedPhoto = await readFileAsBase64(personal.profilePhoto);
      mimeType = personal.profilePhoto.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    }
    await apiService.savePersonalDetails(registrationId, {
      fullName: personal.fullName,
      dateOfBirth: personal.dateOfBirth,
      address: personal.address,
      emergencyContactName: personal.emergencyContactName,
      emergencyContact: personal.emergencyContact,
      ...(encodedPhoto ? { profilePhotoBase64: `data:${mimeType};base64,${encodedPhoto}` } : {}),
    });
    await saveDraft({ registrationId, mobile, email, currentStep: 1, personalDetails: personal });
    return true;
  };

  const saveProfessional = async () => {
    if (
      !partnerType
      || !EXPERIENCE_OPTIONS.includes(experience)
      || !QUALIFICATION_OPTIONS.includes(qualification)
      || !categories.some((category) => CATEGORIES_BY_ROLE[partnerType].options.includes(category))
    ) {
      setError('Choose a partner role, experience, qualification and at least one category.');
      return false;
    }
    const professionalDetails: ProfessionalDetails = {
      partnerType,
      experience,
      qualification,
      categories: categories.filter((category) => CATEGORIES_BY_ROLE[partnerType].options.includes(category)),
    };
    await apiService.saveProfessionalDetails(registrationId, professionalDetails);
    await saveDraft({ registrationId, mobile, email, currentStep: 2, personalDetails: personal, professionalDetails });
    return true;
  };

  const uploadDocument = async (documentId: string) => {
    setError('');
    setUploadingId(documentId);
    try {
      let asset;
      try {
        [asset] = await pick({ type: [types.images, types.pdf], mode: 'import' });
      } catch (pickerError) {
        if (isErrorWithCode(pickerError) && pickerError.code === errorCodes.OPERATION_CANCELED) return;
        throw pickerError;
      }
      if (!asset.hasRequestedType) throw new Error('Choose a PDF or image document.');
      setDocuments((current) => current.map((document) => (
        document.id === documentId ? { ...document, status: 'uploading' } : document
      )));
      const [copy] = await keepLocalCopy({
        files: [{ uri: asset.uri, fileName: asset.name || 'upload' }],
        destination: 'cachesDirectory',
      });
      if (copy.status !== 'success') throw new Error(copy.copyError);
      const base64 = await readFileAsBase64(copy.localUri);
      const fileName = asset.name || 'upload';
      await apiService.uploadDocument(registrationId, base64, documentId, fileName);
      setDocuments((current) => current.map((document) => (
        document.id === documentId ? { ...document, status: 'uploaded', fileName } : document
      )));
    } catch (uploadError: any) {
      setDocuments((current) => current.map((document) => (
        document.id === documentId ? { ...document, status: 'pending' } : document
      )));
      setError(uploadError.response?.data?.message || uploadError.message || 'Could not upload this document.');
    } finally {
      setUploadingId(null);
    }
  };

  const saveDocumentsAndBank = async () => {
    if (!partnerType || !bankDetails.accountNumber.trim() || !bankDetails.ifscCode.trim()
      || !bankDetails.accountHolderName.trim()) {
      setError('Complete all bank and payout details to continue.');
      return false;
    }
    if (documents.some((document) => document.required && document.status !== 'uploaded')) {
      setError('Upload all required documents to continue.');
      return false;
    }
    await apiService.saveBankDetails(registrationId, bankDetails);
    await saveDraft({
      registrationId,
      mobile,
      email,
      currentStep: 3,
      personalDetails: personal,
      professionalDetails: { partnerType, experience, qualification, categories },
      bankDetails,
      documents,
    });
    return true;
  };

  const saveServiceArea = async () => {
    if (!serviceAreas.length) {
      setError('Select at least one service area to continue.');
      return false;
    }
    await apiService.saveServiceArea(registrationId, serviceAreas, travelRadiusKm);
    await saveDraft({
      registrationId,
      mobile,
      email,
      currentStep: 4,
      personalDetails: personal,
      professionalDetails: { partnerType, experience, qualification, categories },
      bankDetails,
      documents,
      serviceArea: serviceAreas.join(', '),
      travelRadiusKm,
    });
    return true;
  };

  const continueSection = async (section: SectionId) => {
    setError('');
    setWorking(true);
    try {
      let saved = true;
      if (section === 'personal') saved = await savePersonal();
      if (section === 'professional') saved = await saveProfessional();
      if (section === 'documents') saved = await saveDocumentsAndBank();
      if (section === 'serviceArea') saved = await saveServiceArea();
      if (!saved) return;

      markCompleted(section);
      const nextSection = sections[sections.findIndex((item) => item.id === section) + 1];
      if (nextSection) setActiveSection(nextSection.id);
    } catch (saveError: any) {
      setError(saveError.response?.data?.message || saveError.message || 'Could not save this section. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const choosePhoto = async () => {
    setError('');
    try {
      const result = await launchImageLibraryAsync({
        quality: 0.7,
        includeBase64: true,
      });
      const asset = result.assets?.[0];
      if (!result.canceled && asset) {
        setPersonal((current) => ({ ...current, profilePhoto: asset.uri }));
        setPhotoBase64(asset.base64 || null);
        setPhotoMimeType(asset.mimeType?.toLowerCase() === 'image/png' ? 'image/png' : 'image/jpeg');
      }
    } catch (pickerError) {
      setError(pickerError instanceof Error ? pickerError.message : 'Could not select a profile photo.');
    }
  };

  const submitApplication = async () => {
    setError('');
    if (!consent) {
      setError('Confirm that the information is accurate before submitting.');
      return;
    }
    setWorking(true);
    try {
      await apiService.submitApplication(registrationId, true);
      await clearDraft();
      navigation.replace('Status', {
        registrationId,
        status: 'under_review',
        message: 'Your application has been submitted and is under review.',
      });
    } catch (submitError: any) {
      setError(submitError.response?.data?.message || 'Could not submit the application. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const toggleCategory = (category: string) => {
    setCategories((current) => current.includes(category)
      ? current.filter((value) => value !== category)
      : [...current, category]);
  };

  const renderSection = (section: SectionId) => {
    if (section === 'personal') {
      const stepLabels = ['Personal', 'Professional', 'Documents', 'Area', 'Review'];
      const initials = personal.fullName
        .split(' ')
        .map((part) => part.charAt(0).toUpperCase())
        .filter(Boolean)
        .slice(0, 2)
        .join('');
      return (
        <>
          <StepProgress currentStep={currentStep} totalSteps={5} stepLabels={stepLabels} />
          <TouchableOpacity style={styles.photoPicker} onPress={choosePhoto} accessibilityRole="button">
            {personal.profilePhoto ? (
              <Image source={{ uri: personal.profilePhoto }} style={[styles.photo, { borderRadius: 60 }]} />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: colors.primary, fontSize: 28, fontWeight: '800' }}>{initials || '?'}</Text>
              </View>
            )}
            <Text style={[styles.photoLabel, { color: colors.primary }]}>{personal.profilePhoto ? 'Change profile photo' : 'Add profile photo'}</Text>
          </TouchableOpacity>
          <AppTextInput label="Full Name" value={personal.fullName} onChangeText={(value) => setPersonal({ ...personal, fullName: value })} />
          <AppTextInput label="Date of Birth" value={personal.dateOfBirth} onChangeText={(value) => setPersonal({ ...personal, dateOfBirth: value })} placeholder="DD/MM/YYYY" />
          <AppTextInput label="Current Address" value={personal.address} onChangeText={(value) => setPersonal({ ...personal, address: value })} multiline />
          <Text style={styles.fieldLabel}>Emergency contact</Text>
          <AppTextInput label="Emergency Contact Name" value={personal.emergencyContactName || ''} onChangeText={(value) => setPersonal({ ...personal, emergencyContactName: value })} />
          <AppTextInput
            label="Emergency Contact Phone"
            value={personal.emergencyContact}
            onChangeText={(value) => setPersonal({ ...personal, emergencyContact: value.replace(/\D/g, '').slice(0, 10) })}
            keyboardType="phone-pad"
            maxLength={10}
            styleOverride={{ paddingLeft: 40 }}
          />
          <Text style={styles.helper}>+91 India</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>💡</Text>
            <Text style={styles.infoText}>Keep your details accurate. They will be verified during onboarding.</Text>
          </View>
        </>
      );
    }

    if (section === 'professional') {
      const stepLabels = ['Personal', 'Professional', 'Documents', 'Area', 'Review'];
      return (
        <>
          <StepProgress currentStep={currentStep} totalSteps={5} stepLabels={stepLabels} />
          <Text style={styles.fieldLabel}>Partner Type</Text>
          {partnerRole ? (
            <Text style={[styles.helper, { color: colors.text }]}>
              {theme.roleLabels[partnerRole]}
            </Text>
          ) : (
            <View style={styles.roleGrid}>
              {PARTNER_TYPES.map((option) => (
                <SelectionCard
                  key={option.value}
                  title={option.label}
                  value={option.value}
                  selected={partnerType === option.value}
                  onPress={() => {
                    if (partnerType !== option.value) {
                      setCategories([]);
                      setPartnerType(option.value);
                    }
                  }}
                />
              ))}
            </View>
          )}
          {partnerType ? (
            <>
              <Text style={styles.fieldLabel}>{CATEGORIES_BY_ROLE[partnerType].title}</Text>
              <Text style={styles.helper}>Select all categories that describe your work.</Text>
              <View style={styles.roleGrid}>
                {CATEGORIES_BY_ROLE[partnerType].options.map((category) => (
                  <SelectionCard
                    key={category}
                    title={category}
                    value={category}
                    selected={categories.includes(category)}
                    onPress={() => toggleCategory(category)}
                  />
                ))}
              </View>
            </>
          ) : null}
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>After approval, you will be able to set up your detailed Specializations & Brand matrix in your profile.</Text>
          </View>
        </>
      );
    }

    if (section === 'documents') {
      const stepLabels = ['Personal', 'Professional', 'Documents', 'Area', 'Review'];
      return (
        <>
          <StepProgress currentStep={currentStep} totalSteps={5} stepLabels={stepLabels} />
          {!partnerType ? (
            <Text style={styles.helper}>Select your partner role in Professional details first to see the correct document checklist.</Text>
          ) : (
            <>
              <Text style={styles.helper}>Upload the required documents for your role. PDF and image files are supported.</Text>
              {roleDocuments.map((item) => {
                const document = documents.find((entry) => entry.id === item.id);
                const status = document?.status || 'pending';
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.documentRow, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => uploadDocument(item.id)}
                    disabled={uploadingId === item.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Upload ${item.label}${item.required ? ', required' : ', optional'}`}
                  >
                    <View style={[styles.documentIcon, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name={status === 'uploaded' ? 'checkmark-circle' : 'document-attach-outline'} size={21} color={status === 'uploaded' ? theme.colors.success : colors.primary} />
                    </View>
                    <View style={styles.documentCopy}>
                      <Text style={[styles.documentTitle, { color: colors.text }]}>{item.label}</Text>
                      <Text style={styles.helper}>{document?.fileName || (item.required ? 'Required · Tap to upload' : 'Optional · Tap to upload')}</Text>
                    </View>
                    {uploadingId === item.id
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Text style={[styles.documentStatus, { color: status === 'uploaded' ? theme.colors.success : colors.primary }]}>{status === 'uploaded' ? 'Uploaded' : 'Upload'}</Text>}
                  </TouchableOpacity>
                );
              })}
            </>
          )}
          <Text style={styles.fieldLabel}>Bank and payout details</Text>
          <AppTextInput label="Account Number" value={bankDetails.accountNumber} onChangeText={(value) => setBankDetails({ ...bankDetails, accountNumber: value })} keyboardType="numeric" />
          <AppTextInput label="IFSC Code" value={bankDetails.ifscCode} onChangeText={(value) => setBankDetails({ ...bankDetails, ifscCode: value })} autoCapitalize="characters" />
          <AppTextInput label={partnerType === 'service_partner' ? 'Account Holder Name' : 'Business Name'} value={bankDetails.accountHolderName} onChangeText={(value) => setBankDetails({ ...bankDetails, accountHolderName: value })} />
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>📄</Text>
            <Text style={styles.infoText}>All documents must be clear and valid.</Text>
          </View>
        </>
      );
    }

    if (section === 'serviceArea') {
      const stepLabels = ['Personal', 'Professional', 'Documents', 'Area', 'Review'];

      return (
        <>
          <StepProgress currentStep={currentStep} totalSteps={5} stepLabels={stepLabels} />
          <Text style={styles.helper}>Select every zone where you can take service requests.</Text>
          <AppTextInput
            label="Search by Pincode or Area Name"
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="e.g. 302022 or Sitapura"
          />
          <Text style={styles.helper}>Search results ({filteredAreas.length})</Text>
          <View style={styles.roleGrid}>
            {filteredAreas.map((area) => (
              <SelectionCard
                key={area}
                title={area}
                value={area}
                selected={serviceAreas.includes(area)}
                onPress={() => setServiceAreas((current) => current.includes(area)
                  ? current.filter((item) => item !== area)
                  : [...current, area])}
              />
            ))}
          </View>
          {filteredAreas.length === 0 && searchQuery.trim() !== '' ? (
            <Text style={styles.helper}>No area found for this pincode or name.</Text>
          ) : null}
          <Text style={styles.fieldLabel}>Maximum travel radius</Text>
          <View style={styles.optionGrid}>
            {TRAVEL_RADII.map((option) => (
              <Choice key={option.value} title={option.label} selected={travelRadiusKm === option.value} onPress={() => setTravelRadiusKm(option.value)} />
            ))}
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>You can update your service areas later from your profile.</Text>
          </View>
        </>
      );
    }

    const stepLabels = ['Personal', 'Professional', 'Documents', 'Area', 'Review'];
    return (
      <>
        <StepProgress currentStep={currentStep} totalSteps={5} stepLabels={stepLabels} />
        <Text style={[styles.reviewHeading, { color: colors.text }]}>Application summary</Text>
        <ReviewRow label="Name" value={personal.fullName} />
        <ReviewRow label="Mobile" value={mobile} />
        <ReviewRow label="Email" value={email || 'Not provided'} />
        <ReviewRow label="Partner role" value={partnerType ? theme.roleLabels[partnerType] : 'Not selected'} />
        <ReviewRow label="Experience" value={experience} />
        <ReviewRow label="Qualification" value={qualification} />
        <ReviewRow label="Categories" value={categories.join(', ')} />
        <ReviewRow
          label="Required documents"
          value={`${documents.filter((document) => document.required && document.status === 'uploaded').length} of ${roleDocuments.filter((document) => document.required).length} uploaded`}
        />
        <ReviewRow label="Service areas" value={needsServiceArea ? serviceAreas.join(', ') : 'Not required for this role'} />
        {needsServiceArea ? <ReviewRow label="Travel radius" value={travelRadiusKm === 0 ? 'No fixed limit' : `${travelRadiusKm} km`} /> : null}
        <Pressable
          style={styles.consentRow}
          onPress={() => setConsent((current) => !current)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consent }}
        >
          <View style={[styles.checkbox, consent && { backgroundColor: colors.primary, borderColor: colors.primary }]}>{consent ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}</View>
          <Text style={styles.helper}>I confirm that the information provided is accurate and agree to the terms and conditions.</Text>
        </Pressable>
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>✅</Text>
          <Text style={styles.infoText}>Make sure everything is correct before submitting.</Text>
        </View>
      </>
    );
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    page: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.md, width: '100%', maxWidth: 760, alignSelf: 'center' },
    introCard: { padding: theme.spacing.md, borderRadius: 18, marginBottom: theme.spacing.md, backgroundColor: colors.primaryLight, borderWidth: 1, borderColor: '#D5E2FF' },
    introTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
    introTitle: { color: colors.primary, fontSize: 17, fontWeight: '800', flex: 1 },
    progressLabel: { color: colors.primary, fontSize: 11, fontWeight: '800' },
    introCopy: { color: colors.secondaryText, fontSize: 13, lineHeight: 19, marginTop: 4 },
    progressTrack: { height: 5, borderRadius: 99, backgroundColor: '#D4E1F5', marginTop: 13, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 99, backgroundColor: colors.primary },
    section: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, marginBottom: theme.spacing.sm, overflow: 'hidden', ...theme.elevation.low },
    sectionActive: { borderColor: colors.primary },
    sectionHeader: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, gap: theme.spacing.sm },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs },
    sectionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight },
    sectionCopy: { flex: 1 },
    sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
    sectionCaption: { color: colors.secondaryText, fontSize: 11, marginTop: 3 },
    completionIcon: { color: theme.colors.success, fontSize: 16 },
    sectionBody: { borderTopWidth: 1, borderTopColor: colors.border, padding: theme.spacing.md },
    photoPicker: { alignItems: 'center', marginBottom: theme.spacing.md },
    photo: { width: 100, height: 100, borderRadius: 50 },
    photoPlaceholder: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
    photoLabel: { fontSize: 12, fontWeight: '700', marginTop: 8 },
    fieldLabel: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: theme.spacing.md, marginBottom: theme.spacing.sm },
    helper: { color: colors.secondaryText, fontSize: 12, lineHeight: 18, marginBottom: theme.spacing.sm },
    optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs },
    choice: { minHeight: 38, borderWidth: 1, borderColor: colors.border, borderRadius: theme.borderRadius.md, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center', backgroundColor: colors.surface },
    choiceSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
    choiceText: { color: colors.secondaryText, fontSize: 12, fontWeight: '600' },
    choiceTextSelected: { color: colors.primary, fontWeight: '800' },
    roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginBottom: theme.spacing.xs },
    documentRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: theme.spacing.sm, marginBottom: theme.spacing.xs, gap: theme.spacing.sm },
    documentIcon: { width: 36, height: 36, borderRadius: theme.borderRadius.sm, alignItems: 'center', justifyContent: 'center' },
    documentCopy: { flex: 1 },
    documentTitle: { fontSize: 13, fontWeight: '700' },
    documentStatus: { fontSize: 11, fontWeight: '800' },
    continueButton: { marginTop: theme.spacing.md },
    reviewHeading: { fontSize: 16, fontWeight: '800', marginBottom: theme.spacing.sm },
    reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
    reviewLabel: { color: colors.secondaryText, fontSize: 12 },
    reviewValue: { color: colors.text, flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '700' },
    consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm, marginVertical: theme.spacing.md },
    checkbox: { width: 22, height: 22, borderWidth: 1.5, borderColor: colors.border, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
    error: { marginBottom: theme.spacing.sm },
    stickyAction: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: theme.spacing.md, paddingTop: 10, paddingBottom: 10, ...theme.elevation.medium },
    stickyActionInner: { width: '100%', maxWidth: 728, alignSelf: 'center' },
    infoBox: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginTop: theme.spacing.md, padding: theme.spacing.sm, backgroundColor: colors.primaryLight, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: colors.primary },
    infoIcon: { fontSize: 18 },
    infoText: { color: colors.primary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  });

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <AppHeader title="Partner registration" subtitle="Complete each section to submit your application" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.introCard}>
            <View style={styles.introTop}>
              <Text style={styles.introTitle}>Your application, one step at a time</Text>
              <Text style={styles.progressLabel}>{completedSections.length}/{sections.length} complete</Text>
            </View>
            <Text style={styles.introCopy}>Complete a section and it will save before the next one opens. You can reopen saved sections to make changes.</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(completedSections.length / sections.length) * 100}%` }]} />
            </View>
          </View>
          {error ? <ErrorMessage message={error} /> : null}
          {sections.map((section, index) => {
            const expanded = activeSection === section.id;
            const completed = completedSections.includes(section.id);
            const canOpen = sections.slice(0, index).every((previous) => completedSections.includes(previous.id));
            const icon = section.id === 'personal' ? 'person-outline'
              : section.id === 'professional' ? 'briefcase-outline'
                : section.id === 'documents' ? 'documents-outline'
                  : section.id === 'serviceArea' ? 'map-outline' : 'checkmark-done-outline';
            return (
              <View key={section.id} style={[styles.section, expanded && styles.sectionActive]}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  disabled={!canOpen || working}
                  onPress={() => setActiveSection(expanded ? null : section.id)}
                  style={styles.sectionHeader}
                >
                  <View style={styles.sectionIcon}><Ionicons name={icon} size={19} color={colors.primary} /></View>
                  <View style={styles.sectionCopy}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={[styles.sectionTitle, { fontWeight: '800' }]}>{SECTION_LABELS[section.id]} {SECTION_STEP[section.id]}</Text>
                      <Text style={styles.sectionCaption}>{section.caption}</Text>
                    </View>
                  </View>
                  {completed
                    ? <Ionicons name="checkmark-circle" size={20} color={theme.colors.success} />
                    : !canOpen ? <Ionicons name="lock-closed-outline" size={17} color={colors.secondaryText} /> : null}
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={19} color={colors.secondaryText} />
                </TouchableOpacity>
                {expanded ? (
                  <View style={styles.sectionBody}>
                    {renderSection(section.id)}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
        {activeSection ? (
          <View style={styles.stickyAction}>
            <View style={styles.stickyActionInner}>
              {activeSection === 'review' ? (
                <AppButton title="Submit application" onPress={submitApplication} loading={working} disabled={!consent} />
              ) : (
                <AppButton
                  title={activeSection === 'personal' ? 'Save personal details'
                    : activeSection === 'professional' ? 'Save professional details'
                      : activeSection === 'documents' ? 'Save documents & payout' : 'Save service areas'}
                  onPress={() => continueSection(activeSection)}
                  loading={working}
                />
              )}
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Choice: React.FC<{ title: string; selected: boolean; onPress: () => void }> = ({ title, selected, onPress }) => {
  const { colors } = useUserPreferences();
  return (
    <TouchableOpacity
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        choiceStyles.choice,
        { backgroundColor: selected ? colors.primaryLight : colors.surface, borderColor: selected ? colors.primary : colors.border },
      ]}
    >
      <Text style={[choiceStyles.choiceText, { color: selected ? colors.primary : colors.secondaryText }, selected && choiceStyles.choiceTextSelected]}>{title}</Text>
    </TouchableOpacity>
  );
};

const choiceStyles = StyleSheet.create({
  choice: { minHeight: 38, borderWidth: 1, borderRadius: theme.borderRadius.md, paddingHorizontal: 10, paddingVertical: 8, justifyContent: 'center' },
  choiceText: { fontSize: 12, fontWeight: '600' },
  choiceTextSelected: { fontWeight: '800' },
});

const ReviewRow: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  const { colors } = useUserPreferences();
  return (
    <View style={[reviewStyles.row, { borderBottomColor: colors.border }]}>
      <Text style={[reviewStyles.label, { color: colors.secondaryText }]}>{label}</Text>
      <Text style={[reviewStyles.value, { color: colors.text }]}>{value || 'Not provided'}</Text>
    </View>
  );
};

const reviewStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md, paddingVertical: 10, borderBottomWidth: 1 },
  label: { fontSize: 12 },
  value: { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '700' },
});
