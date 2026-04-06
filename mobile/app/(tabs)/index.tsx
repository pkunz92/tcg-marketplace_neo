import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { listingsApi, Listing } from '../../src/api/listings';
import { GradeBadge } from '../../src/components/GradeBadge';

function ListingCard({ item }: { item: Listing }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/listing/${item.id}`)}
      activeOpacity={0.8}
    >
      {item.card_image_url ? (
        <Image source={{ uri: item.card_image_url }} style={styles.cardImage} resizeMode="cover" />
      ) : (
        <View style={[styles.cardImage, styles.noImage]}>
          <Text style={{ color: '#6b7280', fontSize: 28 }}>🃏</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.card_name}
        </Text>
        <View style={styles.cardMeta}>
          <GradeBadge grade={item.condition} small />
          <Text style={styles.price}>CHF {item.price_chf}</Text>
        </View>
        <Text style={styles.seller}>by {item.seller_username}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function MarketScreen() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['listings', debouncedSearch],
    queryFn: () => listingsApi.list({ search: debouncedSearch || undefined }),
    select: (r) => r.data.results,
  });

  return (
    <View style={styles.root}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search cards…"
        placeholderTextColor="#6b7280"
        value={search}
        onChangeText={(v) => {
          setSearch(v);
          // debounce via state flush
          setTimeout(() => setDebouncedSearch(v), 400);
        }}
      />
      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator color="#4f46e5" size="large" />
        </View>
      )}
      {isError && (
        <View style={styles.centered}>
          <Text style={{ color: '#ef4444' }}>Failed to load listings.</Text>
        </View>
      )}
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ListingCard item={item} />}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.empty}>No listings found.</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f1a' },
  searchInput: {
    margin: 12,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#f9fafb',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#374151',
  },
  list: { paddingHorizontal: 8, paddingBottom: 16 },
  row: { justifyContent: 'space-between' },
  card: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 10,
    margin: 4,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', aspectRatio: 0.72 },
  noImage: {
    backgroundColor: '#111827',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: { padding: 8, gap: 4 },
  cardTitle: { color: '#f9fafb', fontSize: 13, fontWeight: '600' },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { color: '#10b981', fontWeight: '700', fontSize: 14 },
  seller: { color: '#6b7280', fontSize: 11 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  empty: { color: '#6b7280', textAlign: 'center', marginTop: 32 },
});
