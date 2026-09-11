import React, { useCallback, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { formatPrice } from '../components/ProductCard';
import { colors, spacing } from '../theme';

export default function OrdersScreen() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const data = await api.listOrders(token);
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load orders');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  return (
    <Screen title="Orders" subtitle="Your Violet purchases." scroll={false} loading={loading && !orders.length}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>No orders yet. Shop something handmade!</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.id}>#{String(item._id).slice(-6).toUpperCase()}</Text>
              <Text style={styles.money}>{formatPrice(item.total)}</Text>
            </View>
            <Text style={styles.meta}>
              {item.status} · {item.paymentStatus} · {item.paymentMethod}
            </Text>
            <Text style={styles.items} numberOfLines={2}>
              {(item.items || [])
                .map((i: any) => i.title || i.Product_Name || i.product_name)
                .filter(Boolean)
                .join(', ') || 'Items'}
            </Text>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 40, gap: spacing.sm },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 48 },
  error: { color: colors.danger, marginBottom: 8 },
  card: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  id: { fontWeight: '800', color: colors.ink },
  money: { fontWeight: '800', color: colors.accent },
  meta: { color: colors.muted, fontSize: 13, textTransform: 'capitalize' },
  items: { color: colors.inkSoft, fontSize: 14 },
});
