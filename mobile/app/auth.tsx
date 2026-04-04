import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

export default function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, register, isLoading } = useAuthStore();

  const handleSubmit = async () => {
    if (!username || !password) {
      Alert.alert('Validation', 'Username and password are required.');
      return;
    }
    try {
      if (mode === 'login') {
        await login(username, password);
      } else {
        if (!email) {
          Alert.alert('Validation', 'Email is required for registration.');
          return;
        }
        await register(username, email, password);
      }
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Authentication failed. Check your credentials.';
      Alert.alert('Error', msg);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>TCG</Text>
        <Text style={styles.logoSub}>Marketplace</Text>
        <Text style={styles.title}>{mode === 'login' ? 'Sign In' : 'Create Account'}</Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#6b7280"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {mode === 'register' && (
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#6b7280"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.btn, isLoading && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          <Text style={styles.btnText}>
            {isLoading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'register' : 'login')}>
          <Text style={styles.switchText}>
            {mode === 'login'
              ? "Don't have an account? Register"
              : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f1a' },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  logo: {
    fontSize: 56,
    fontWeight: '900',
    color: '#4f46e5',
    textAlign: 'center',
    letterSpacing: 4,
  },
  logoSub: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#f9fafb',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f9fafb',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  btn: {
    backgroundColor: '#4f46e5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  switchText: { color: '#6b7280', textAlign: 'center', marginTop: 8 },
});
