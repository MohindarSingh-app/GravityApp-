export type UserRole = 'service_partner' | 'repairing_partner' | 'panel_maker' | 'supplier';
export type AccountRole = UserRole | 'admin';

export type ApplicationStatus = 
  | 'pending'
  | 'under_review' 
  | 'needs_information' 
  | 'approved' 
  | 'rejected' 
  | 'suspended';

export interface AuthUser {
  id: string;
  mobile: string;
  email: string;
  role?: AccountRole;
  status: ApplicationStatus;
  token: string;
  refreshToken?: string;
}

export interface LoginRequest {
  mobile: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    userId: string;
    mobile: string;
    otpSent: boolean;
  };
}

export interface OtpVerifyRequest {
  mobile: string;
  otp: string;
  purpose: 'login' | 'registration';
}

export interface OtpVerifyResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    refreshToken: string;
    user: AuthUser;
    requiresRegistration: boolean;
  };
}

export interface RegisterStartRequest {
  mobile: string;
  email: string;
}

export interface RegisterStartResponse {
  success: boolean;
  message: string;
  data?: {
    registrationId: string;
    otpSent: boolean;
  };
}

export interface PersonalDetails {
  fullName: string;
  dateOfBirth: string;
  address: string;
  emergencyContactName?: string;
  emergencyContact: string;
  profilePhoto?: string;
}

export interface ProfessionalDetails {
  experience: string;
  qualification: string;
  partnerType: UserRole;
  categories: string[];
}

export interface BankDetails {
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
  bankName: string;
}

export interface DocumentInfo {
  id: string;
  type: string;
  url: string;
  status: 'pending' | 'verified' | 'rejected';
}

export interface RegistrationState {
  registrationId: string;
  mobile: string;
  email: string;
  personalDetails?: PersonalDetails;
  professionalDetails?: ProfessionalDetails;
  bankDetails?: BankDetails;
  documents: DocumentInfo[];
  serviceArea?: string;
  travelRadiusKm?: number;
  currentStep: number;
  isSubmitted: boolean;
  consent: boolean;
}

export interface ApiError {
  code: number;
  message: string;
  details?: any;
}

export interface ThemeColors {
  primaryBackground: string;
  mainCard: string;
  primaryAction: string;
  secondaryHighlight: string;
  mainText: string;
  secondaryText: string;
  error: string;
  success: string;
}