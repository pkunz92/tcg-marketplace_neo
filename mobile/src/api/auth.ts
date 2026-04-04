import { apiClient } from './client';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password1: string;
  password2: string;
}

export interface AuthResponse {
  key: string;
  user?: { pk: number; username: string; email: string };
}

export const authApi = {
  login: (data: LoginPayload) =>
    apiClient.post<AuthResponse>('/auth/login/', data),

  register: (data: RegisterPayload) =>
    apiClient.post<AuthResponse>('/auth/registration/', data),

  logout: () => apiClient.post('/auth/logout/'),

  getProfile: () => apiClient.get('/user/profile/'),
};
