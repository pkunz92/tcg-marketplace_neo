import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../src/api/client';
import { listingsApi, Listing } from '../../src/api/listings';
import { GradeBadge } from '../../src/components/GradeBadge';

interface DashboardStats {
  total_listings: number;
  active_listings: number;
  total_sales: number;
  total_revenue: string;
  pending_orders: number;
}

function StatCard({ label, value, color = '#f9fafb' }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiClient.get<DashboardStats>('/stats/'),
    select: (r) => r.data,
  });

  const { data: myListings, isLoading: listingsLoading } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => listingsApi.myListings(),
    select: (r) => r.data.results,
  });

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.section}>Overview</Text>

      {statsLoading ? (
        <ActivityIndicator color="#4f46e5" style={{ marginVertical: 16 }} />
      ) : (
        <View style={styles.statsGrid}>
          <StatCard label="Active Listings" value={stats?.active_listings ?? 0} color="#4f46e5" />
          <StatCard label="Total Sales" value={stats?.total_sales ?? 0} color="#10b981" />
          <StatCard
            label="Revenue"
            value={`$${parseFloat(stats?.total_revenue ?? '0').toFixed(2)}`}
            color="#f59e0b"
          />
          <StatCard label="Pending Orders" value={stats?.pending_orders ?? 0} color="#fbbf24" />
        </View>
      )}

      <Text style={[styles.section, { marginTop: 20 }]}>My Listings</Text>

      {listingsLoading && <ActivityIndicator color="#4f46e5" />}

      {(myListings ?? []).length === 0 && !listingsLoading && (
        <Text style={styles.empty}>No listings yet. Tap Sell to get started!</Text>
      )}

      {(myListings ?? []).map((listing: Listing) => (
        <View key={listing.id} style={styles.listingRow}>
          <View style={styles.listingInfo}>
            <Text style={styles.listingTitle} numberOfLines={1}>
              {listing.title}
            </Text>
            <Text style={styles.listingPrice}>${listing.price}</Text>
          </View>
          <GradeBadge grade={listing.condition} small />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f1a' },
  content: { padding: 16, gap: 8 },
  section: { color: '#9ca3af', fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { color: '#9ca3af', fontSize: 12 },
  listingRow: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listingInfo: { flex: 1, marginRight: 8 },
  listingTitle: { color: '#f9fafb', fontSize: 14, fontWeight: '600' },
  listingPrice: { color: '#10b981', fontSize: 13, marginTop: 2 },
  empty: { color: '#6b7280', textAlign: 'center', marginTop: 16 },
});
