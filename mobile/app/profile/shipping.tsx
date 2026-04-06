import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { apiClient } from '../../src/api/client';

interface ShippingForm {
  shipping_name: string;
  shipping_address_line1: string;
  shipping_address_line2: string;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
}

export default function ShippingAddressScreen() {
  const [form, setForm] = useState<ShippingForm>({
    shipping_name: '',
    shipping_address_line1: '',
    shipping_address_line2: '',
    shipping_city: '',
    shipping_postal_code: '',
    shipping_country: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient.get('/user/profile/').then(({ data }) => {
      setForm({
        shipping_name: data.shipping_name ?? '',
        shipping_address_line1: data.shipping_address_line1 ?? '',
        shipping_address_line2: data.shipping_address_line2 ?? '',
        shipping_city: data.shipping_city ?? '',
        shipping_postal_code: data.shipping_postal_code ?? '',
        shipping_country: data.shipping_country ?? '',
      });
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiClient.patch('/user/profile/', form);
      Alert.alert('Saved', 'Shipping address updated.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('Error', 'Could not save address. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4f46e5" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Shipping Address</Text>

      {(
        [
          ['Full Name', 'shipping_name'],
          ['Address Line 1', 'shipping_address_line1'],
          ['Address Line 2 (optional)', 'shipping_address_line2'],
          ['City', 'shipping_city'],
          ['Postal Code', 'shipping_postal_code'],
          ['Country', 'shipping_country'],
        ] as [string, keyof ShippingForm][]
      ).map(([label, key]) => (
        <View key={key} style={styles.field}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            value={form[key]}
            onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
            placeholderTextColor="#6b7280"
            placeholder={label}
          />
        </View>
      ))}

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.btnDisabled]}
        onPress={save}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save Address</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { padding: 20, gap: 12 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  heading: { color: '#f9fafb', fontSize: 22, fontWeight: '700', marginBottom: 8 },
  field: { gap: 4 },
  label: { color: '#9ca3af', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f9fafb',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#374151',
  },
  saveBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
