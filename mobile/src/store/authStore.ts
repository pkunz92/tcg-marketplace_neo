import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../api/auth';

interface User {
  pk: number;
  username: string;
  email: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isHydrated: boolean;

  hydrate: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: false,
  isHydrated: false,

  hydrate: async () => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) {
      try {
        const { data } = await authApi.getProfile();
        set({ token, user: data, isHydrated: true });
      } catch {
        await SecureStore.deleteItemAsync('auth_token');
        set({ token: null, user: null, isHydrated: true });
      }
    } else {
      set({ isHydrated: true });
    }
  },

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.login({ username, password });
      await SecureStore.setItemAsync('auth_token', data.key);
      const profileRes = await authApi.getProfile();
      set({ token: data.key, user: profileRes.data, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  register: async (username, email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await authApi.register({
        username,
        email,
        password1: password,
        password2: password,
      });
      await SecureStore.setItemAsync('auth_token', data.key);
      const profileRes = await authApi.getProfile();
      set({ token: data.key, user: profileRes.data, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // best effort
    }
    await SecureStore.deleteItemAsync('auth_token');
    set({ token: null, user: null });
  },
}));
