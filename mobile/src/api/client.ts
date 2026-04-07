import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Override in .env or via EAS environment variable
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
});

// Attach JWT Bearer token on every request
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Refresh expired access token on 401, then retry once
let _refreshPromise: Promise<string | null> | null = null;

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    // Deduplicate concurrent refresh attempts
    if (!_refreshPromise) {
      _refreshPromise = (async () => {
        try {
          const refresh = await SecureStore.getItemAsync('refresh_token');
          if (!refresh) return null;
          const res = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh });
          const newAccess: string = res.data.access;
          await SecureStore.setItemAsync('access_token', newAccess);
          return newAccess;
        } catch {
          await SecureStore.deleteItemAsync('access_token');
          await SecureStore.deleteItemAsync('refresh_token');
          return null;
        } finally {
          _refreshPromise = null;
        }
      })();
    }

    const newToken = await _refreshPromise;
    if (!newToken) return Promise.reject(error);

    originalRequest.headers.Authorization = `Bearer ${newToken}`;
    return apiClient(originalRequest);
  },
);
