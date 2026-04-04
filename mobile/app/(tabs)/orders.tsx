import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../src/api/client';

interface Order {
  id: number;
  status: string;
  total_price: string;
  created_at: string;
  listing: { title: string };
  buyer: { username: string };
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#fbbf24',
  paid: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#10b981',
  cancelled: '#ef4444',
};

function OrderCard({ order }: { order: Order }) {
  const color = STATUS_COLORS[order.status] ?? '#6b7280';
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderTitle} numberOfLines={1}>
          {order.listing.title}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: color }]}>
          <Text style={styles.statusText}>{order.status}</Text>
        </View>
      </View>
      <Text style={styles.orderMeta}>Buyer: {order.buyer.username}</Text>
      <Text style={styles.orderMeta}>
        ${order.total_price} · {new Date(order.created_at).toLocaleDateString()}
      </Text>
    </View>
  );
}

export default function OrdersScreen() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: () => apiClient.get<{ results: Order[] }>('/orders/'),
    select: (r) => r.data.results,
  });

  return (
    <View style={styles.root}>
      {isLoading && (
        <View style={styles.centered}>
          <ActivityIndicator color="#4f46e5" size="large" />
        </View>
      )}
      {isError && (
        <View style={styles.centered}>
          <Text style={{ color: '#ef4444', marginBottom: 12 }}>Failed to load orders.</Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={{ color: '#4f46e5' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={data ?? []}
        keyExtractor={(o) => String(o.id)}
        renderItem={({ item }) => <OrderCard order={item} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.centered}>
              <Text style={styles.emptyIcon}>📦</Text>
              <Text style={styles.emptyText}>No orders yet.</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f1a' },
  list: { padding: 12, gap: 8 },
  orderCard: {
    backgroundColor: '#1f2937',
    borderRadius: 10,
    padding: 14,
    gap: 4,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  orderTitle: { color: '#f9fafb', fontWeight: '600', fontSize: 15, flex: 1 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  orderMeta: { color: '#9ca3af', fontSize: 13 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: '#6b7280', fontSize: 15 },
});
