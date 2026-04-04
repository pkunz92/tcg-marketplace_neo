import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listingsApi } from '../../src/api/listings';
import { apiClient } from '../../src/api/client';
import { GradeBadge } from '../../src/components/GradeBadge';

const { width } = Dimensions.get('window');

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const [activePhoto, setActivePhoto] = useState(0);

  const { data: listing, isLoading } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => listingsApi.detail(Number(id)),
    select: (r) => r.data,
  });

  const buyMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/listings/${id}/buy/`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      Alert.alert('Order placed!', 'Check your orders for updates.', [
        { text: 'View Orders', onPress: () => router.push('/(tabs)/orders') },
        { text: 'OK' },
      ]);
    },
    onError: () => Alert.alert('Error', 'Could not place order. Try again.'),
  });

  const offerMutation = useMutation({
    mutationFn: (amount: string) =>
      apiClient.post(`/offers/`, { listing: Number(id), amount }),
    onSuccess: () => Alert.alert('Offer sent!', 'The seller will respond shortly.'),
    onError: () => Alert.alert('Error', 'Could not send offer.'),
  });

  if (isLoading || !listing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4f46e5" size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Photo carousel */}
      {listing.photos.length > 0 ? (
        <>
          <Image
            source={{ uri: listing.photos[activePhoto]?.url }}
            style={styles.mainPhoto}
            resizeMode="contain"
          />
          {listing.photos.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
              {listing.photos.map((p, i) => (
                <TouchableOpacity key={p.id} onPress={() => setActivePhoto(i)}>
                  <Image
                    source={{ uri: p.url }}
                    style={[styles.stripPhoto, i === activePhoto && styles.stripPhotoActive]}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </>
      ) : (
        <View style={styles.noPhoto}>
          <Text style={{ fontSize: 64 }}>🃏</Text>
        </View>
      )}

      {/* Details */}
      <View style={styles.details}>
        <Text style={styles.title}>{listing.title}</Text>
        <View style={styles.metaRow}>
          <GradeBadge grade={listing.condition} />
          <Text style={styles.price}>${listing.price}</Text>
        </View>
        <Text style={styles.seller}>Sold by {listing.seller.username}</Text>

        {listing.description ? (
          <>
            <Text style={styles.sectionLabel}>Description</Text>
            <Text style={styles.description}>{listing.description}</Text>
          </>
        ) : null}

        {listing.card && (
          <View style={styles.cardInfo}>
            <Text style={styles.sectionLabel}>Card Info</Text>
            <Text style={styles.cardInfoText}>Name: {listing.card.name}</Text>
            <Text style={styles.cardInfoText}>Set: {listing.card.set_name}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.buyBtn, buyMutation.isPending && styles.btnDisabled]}
          onPress={() =>
            Alert.alert('Buy Now', `Purchase for $${listing.price}?`, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Buy', onPress: () => buyMutation.mutate() },
            ])
          }
          disabled={buyMutation.isPending}
        >
          {buyMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buyBtnText}>Buy Now — ${listing.price}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.offerBtn}
          onPress={() =>
            Alert.prompt(
              'Make an Offer',
              'Enter your offer amount (USD):',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Send Offer',
                  onPress: (amount) => {
                    if (amount) offerMutation.mutate(amount);
                  },
                },
              ],
              'plain-text',
              '',
              'decimal-pad',
            )
          }
        >
          <Text style={styles.offerBtnText}>Make an Offer</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
  mainPhoto: { width, height: width * 1.4, backgroundColor: '#111827' },
  noPhoto: {
    width,
    height: width * 1.4,
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoStrip: { paddingHorizontal: 12, paddingVertical: 8 },
  stripPhoto: {
    width: 64,
    height: 90,
    borderRadius: 6,
    marginRight: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stripPhotoActive: { borderColor: '#4f46e5' },
  details: { padding: 16, gap: 8 },
  title: { color: '#f9fafb', fontWeight: '700', fontSize: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  price: { color: '#10b981', fontWeight: '800', fontSize: 26 },
  seller: { color: '#6b7280', fontSize: 13 },
  sectionLabel: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  description: { color: '#d1d5db', fontSize: 15, lineHeight: 22 },
  cardInfo: { gap: 2 },
  cardInfoText: { color: '#d1d5db', fontSize: 14 },
  actions: { padding: 16, gap: 10 },
  buyBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  buyBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  offerBtn: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  offerBtnText: { color: '#d1d5db', fontWeight: '600', fontSize: 15 },
});
