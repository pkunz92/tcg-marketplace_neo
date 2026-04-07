import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/auth');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {user?.username?.[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>
      <Text style={styles.username}>{user?.username}</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <View style={styles.divider} />

      <View style={styles.menuSection}>
        <Text style={styles.menuSectionLabel}>Account</Text>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/dashboard')}>
          <Text style={styles.menuItemText}>📋  My Listings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(tabs)/orders')}>
          <Text style={styles.menuItemText}>📦  My Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => Alert.alert('Watchlist', 'Watchlist screen coming soon.')}
        >
          <Text style={styles.menuItemText}>❤️   Watchlist</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.menuSection}>
        <Text style={styles.menuSectionLabel}>Settings</Text>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => Alert.alert('Notifications', 'Notification preferences coming soon.')}
        >
          <Text style={styles.menuItemText}>🔔  Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => Alert.alert('Payment Methods', 'Manage payment methods via the web app.')}
        >
          <Text style={styles.menuItemText}>💳  Payment Methods</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => router.push('/profile/shipping')}
        >
          <Text style={styles.menuItemText}>🚚  Shipping Address</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { alignItems: 'center', padding: 24, gap: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  username: { color: '#f9fafb', fontWeight: '700', fontSize: 20 },
  email: { color: '#9ca3af', fontSize: 14 },
  divider: { height: 1, backgroundColor: '#374151', width: '100%', marginVertical: 12 },
  menuSection: { width: '100%', gap: 4 },
  menuSectionLabel: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  menuItem: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemText: { color: '#f9fafb', fontSize: 15 },
  logoutBtn: {
    marginTop: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  logoutText: { color: '#ef4444', fontWeight: '700', fontSize: 15 },
});
