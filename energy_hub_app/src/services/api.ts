import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import Config from 'react-native-config';
import { NativeModules, Platform } from 'react-native';
import { isAndroidEmulator, isMetroLoopback, resolveApiHost } from './apiHost';
import { secureStorage } from './secureStorage';

const CONFIGURED_API_HOST = Config.API_URL;

if (!__DEV__ && (!CONFIGURED_API_HOST || !CONFIGURED_API_HOST.startsWith('https://'))) {
  throw new Error('Production builds require an HTTPS API_URL in the app .env file.');
}

const androidConstants = Platform.constants as { Fingerprint?: string; Model?: string; Brand?: string };
const androidDetails = Platform.OS === 'android'
  ? `${androidConstants.Fingerprint || ''} ${androidConstants.Model || ''} ${androidConstants.Brand || ''}`
  : '';
const bundleUrl = NativeModules.SourceCode?.scriptURL;
const androidEmulator = isAndroidEmulator(androidDetails);
const preserveAndroidLoopback = Platform.OS === 'android'
  && __DEV__
  && !androidEmulator
  && isMetroLoopback(bundleUrl);
const API_HOST = resolveApiHost(
  CONFIGURED_API_HOST,
  Platform.OS,
  bundleUrl,
  preserveAndroidLoopback,
  androidEmulator,
);
const API_BASE_URL = `${API_HOST}/api/v1`;

if (__DEV__) {
  console.info(`[EnergyHub] API endpoint: ${API_BASE_URL}`);
}

export class ApiService {
  private client: AxiosInstance;
  private authToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        if (this.authToken) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        return config;
      },
      (error: AxiosError) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const refreshToken = await secureStorage.getItem('refreshToken');
            if (refreshToken) {
              const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                refreshToken,
              });
              const { token } = response.data.data;
              this.setToken(token);
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            this.clearToken();
            return Promise.reject(refreshError);
          }
        }
        return Promise.reject(error);
      }
    );
  }

  async setToken(token: string) {
    this.authToken = token;
    await secureStorage.setItem('token', token);
  }

  async getToken(): Promise<string | null> {
    if (this.authToken) return this.authToken;
    const token = await secureStorage.getItem('token');
    this.authToken = token;
    return token;
  }

  async clearToken() {
    this.authToken = null;
    await secureStorage.removeItem('token');
    await secureStorage.removeItem('refreshToken');
  }

  async initialize() {
    this.authToken = await secureStorage.getItem('token');
  }

  // Auth endpoints
  async loginRequestOtp(mobile: string, purpose: 'login' | 'registration' = 'login') {
    const response = await this.client.post('/auth/otp/request', { mobile, purpose });
    return response.data;
  }

  async verifyOtp(mobile: string, otp: string, purpose: 'login' | 'registration') {
    const response = await this.client.post('/auth/otp/verify', { mobile, otp, purpose });
    return response.data;
  }

  async selectPartnerRole(roleSelectionToken: string, role: string) {
    const response = await this.client.post('/auth/role/select', { roleSelectionToken, role });
    return response.data;
  }

  async registerStart(mobile: string, email: string, role?: string) {
    const response = await this.client.post('/registration/start', { mobile, email, role });
    return response.data;
  }

  async requestEmailVerification(registrationId: string, email: string) {
    const response = await this.client.post('/registration/email-verification/request', {
      registrationId,
      email,
    });
    return response.data;
  }

  async verifyEmail(registrationId: string, otp: string) {
    const response = await this.client.post('/registration/email-verification/verify', {
      registrationId,
      otp,
    });
    return response.data;
  }

  async savePersonalDetails(registrationId: string, data: any) {
    const response = await this.client.put(`/registration/${registrationId}/personal-details`, data);
    return response.data;
  }

  async saveProfessionalDetails(registrationId: string, data: any) {
    const response = await this.client.put(`/registration/${registrationId}/professional-details`, data);
    return response.data;
  }

  async uploadDocument(registrationId: string, file: string, type: string, name?: string) {
    const response = await this.client.post(`/registration/${registrationId}/documents`, {
      file,
      type,
      name,
    });
    return response.data;
  }

  async getDocumentChecklist(registrationId: string) {
    const response = await this.client.get(`/registration/${registrationId}/checklist`);
    return response.data;
  }

  async saveBankDetails(registrationId: string, data: any) {
    const response = await this.client.put(`/registration/${registrationId}/bank-details`, data);
    return response.data;
  }

  async saveServiceArea(registrationId: string, serviceAreas: string[], travelRadiusKm: number) {
    const response = await this.client.put(`/registration/${registrationId}/service-area`, {
      serviceAreas,
      travelRadiusKm,
    });
    return response.data;
  }

  async saveSpecializations(registrationId: string, specializations: Record<string, unknown>) {
    const response = await this.client.put(`/registration/${registrationId}/specializations`, specializations);
    return response.data;
  }

  async getDeliveryVerification() {
    const response = await this.client.get('/partner/delivery-verification');
    return response.data;
  }

  async submitDeliveryVerification(data: {
    vehicleType: string;
    vehicleNumber: string;
    licenseDocumentId: number;
  }) {
    const response = await this.client.post('/partner/delivery-verification', data);
    return response.data;
  }

  async submitApplication(registrationId: string, consent: boolean) {
    const response = await this.client.post(`/registration/${registrationId}/submit`, {
      consent,
    });
    return response.data;
  }

  async getApplicationStatus(registrationId: string) {
    const response = await this.client.get(`/registration/${registrationId}/status`);
    return response.data;
  }

  async getDashboardData(role?: string) {
    const response = role
      ? await this.client.get(`/dashboard/${role}`)
      : await this.client.get('/dashboard');
    return response.data;
  }

  // ---- partner profile ---------------------------------------------------

  async getProfile() {
    const response = await this.client.get('/partner/profile');
    return response.data;
  }

  async updatePartnerProfile(data: Record<string, unknown>) {
    const response = await this.client.put('/partner/profile', data);
    return response.data;
  }

  async switchPartnerRole(role: string) {
    const response = await this.client.post('/partner/role/switch', { role });
    return response.data;
  }

  async setOnlineStatus(online: boolean) {
    const response = await this.client.post('/partner/status', { online });
    return response.data;
  }

  // ---- job marketplace ---------------------------------------------------

  async listOpenJobs() {
    const response = await this.client.get('/jobs/open');
    return response.data;
  }

  async listMyJobs() {
    const response = await this.client.get('/jobs/mine');
    return response.data;
  }

  async listAdminSchedule() {
    const response = await this.client.get('/admin/schedule');
    return response.data;
  }

  async setJobSchedule(jobId: number | string, scheduledAt: string | null) {
    const response = await this.client.put(`/admin/schedule/${jobId}`, { scheduledAt });
    return response.data;
  }

  async listPartnerApplications() {
    const response = await this.client.get('/admin/applications');
    return response.data;
  }

  async listExpertiseReviews() {
    const response = await this.client.get('/admin/expertise-reviews');
    return response.data;
  }

  async reviewPartnerExpertise(registrationId: number | string, decision: 'approved' | 'rejected', reason = '') {
    const response = await this.client.put(`/admin/applications/${registrationId}/expertise-review`, { decision, reason });
    return response.data;
  }

  async getJob(jobId: number | string) {
    const response = await this.client.get(`/jobs/${jobId}`);
    return response.data;
  }

  async getWorkflowSteps() {
    const response = await this.client.get('/jobs/workflow/steps');
    return response.data;
  }

  async acceptJob(jobId: number | string) {
    const response = await this.client.post(`/jobs/${jobId}/accept`);
    return response.data;
  }

  async declineJob(jobId: number | string, reason?: string) {
    const response = await this.client.post(`/jobs/${jobId}/decline`, { reason });
    return response.data;
  }

  // ---- five step field workflow ------------------------------------------

  async checkIn(jobId: number | string) {
    const response = await this.client.post(`/jobs/${jobId}/workflow/check-in`);
    return response.data;
  }

  async saveDiagnosis(jobId: number | string, data: any) {
    const response = await this.client.post(`/jobs/${jobId}/workflow/diagnosis`, data);
    return response.data;
  }

  async saveParts(jobId: number | string, parts: any[]) {
    const response = await this.client.post(`/jobs/${jobId}/workflow/parts`, { parts });
    return response.data;
  }

  async savePhotos(jobId: number | string, photos: any[]) {
    const response = await this.client.post(`/jobs/${jobId}/workflow/photos`, { photos });
    return response.data;
  }

  async completeJob(jobId: number | string, data: any) {
    const response = await this.client.post(`/jobs/${jobId}/workflow/complete`, data);
    return response.data;
  }

  async requestMaskedCall(jobId: number | string) {
    const response = await this.client.post(`/jobs/${jobId}/masked-call`);
    return response.data;
  }

  // ---- delivery ----------------------------------------------------------

  async listOpenDeliveryJobs() {
    const response = await this.client.get('/delivery/open');
    return response.data;
  }

  async acceptDelivery(jobId: number | string) {
    const response = await this.client.post(`/delivery/${jobId}/accept`);
    return response.data;
  }

  async confirmDeliveryArrival(jobId: number | string, data: any) {
    const response = await this.client.post(`/delivery/${jobId}/arrival`, data);
    return response.data;
  }

  async completeDelivery(jobId: number | string) {
    const response = await this.client.post(`/delivery/${jobId}/complete`);
    return response.data;
  }

  // ---- workshop / panel --------------------------------------------------

  async advanceJobStage(jobId: number | string, data?: any) {
    const response = await this.client.post(`/jobs/${jobId}/stage`, data || {});
    return response.data;
  }

  async completeWorkshopJob(jobId: number | string, data?: any) {
    const response = await this.client.post(`/jobs/${jobId}/workshop/complete`, data || {});
    return response.data;
  }

  // ---- supplier marketplace ----------------------------------------------

  async listProducts(filters?: { category?: string; status?: string }) {
    const response = await this.client.get('/marketplace/products', { params: filters });
    return response.data;
  }

  async listMyProducts(filters?: { category?: string; status?: string }) {
    const response = await this.client.get('/marketplace/products/mine', { params: filters });
    return response.data;
  }

  async createProduct(data: any) {
    const response = await this.client.post('/marketplace/products', data);
    return response.data;
  }

  async updateProduct(productId: number | string, data: any) {
    const response = await this.client.put(`/marketplace/products/${productId}`, data);
    return response.data;
  }

  async deleteProduct(productId: number | string) {
    const response = await this.client.delete(`/marketplace/products/${productId}`);
    return response.data;
  }

  async listInventory() {
    const response = await this.client.get('/marketplace/inventory');
    return response.data;
  }

  async addInventoryItem(data: any) {
    const response = await this.client.post('/marketplace/inventory', data);
    return response.data;
  }

  async updateInventoryItem(itemId: number | string, data: any) {
    const response = await this.client.put(`/marketplace/inventory/${itemId}`, data);
    return response.data;
  }

  // ---- earnings & notifications ------------------------------------------

  async listEarnings(status?: string) {
    const response = await this.client.get('/marketplace/earnings', { params: { status } });
    return response.data;
  }

  async getEarningsSummary() {
    const response = await this.client.get('/marketplace/earnings/summary');
    return response.data;
  }

  async listNotifications() {
    const response = await this.client.get('/marketplace/notifications');
    return response.data;
  }

  async markNotificationRead(notificationId: number | string) {
    const response = await this.client.post(`/marketplace/notifications/${notificationId}/read`);
    return response.data;
  }

  async logout() {
    try {
      await this.client.post('/auth/logout');
    } catch (e) {
      // ignore logout errors
    }
    await this.clearToken();
  }
}

export const apiService = new ApiService();