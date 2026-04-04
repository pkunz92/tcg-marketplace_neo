import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { token, isHydrated } = useAuthStore();

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return <Redirect href={token ? '/(tabs)' : '/auth'} />;
}
