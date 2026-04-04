import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuthStore } from '../src/store/authStore';
import { registerForPushNotifications } from '../src/services/notifications';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export default function RootLayout() {
  const { hydrate, token } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (token) {
      registerForPushNotifications();
    }
  }, [token]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#1a1a2e' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
            contentStyle: { backgroundColor: '#0f0f1a' },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="auth" options={{ headerShown: false }} />
          <Stack.Screen
            name="camera"
            options={{ title: 'Scan Cards', presentation: 'fullScreenModal' }}
          />
          <Stack.Screen name="bulk-review" options={{ title: 'Review & List' }} />
          <Stack.Screen name="listing/[id]" options={{ title: 'Listing' }} />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
