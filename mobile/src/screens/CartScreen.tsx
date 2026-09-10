import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
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

import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CartStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<CartStackParamList, 'CartHome'>;

export default function CartScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState('0.00');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const data = await api.getCart(token);
      setItems(data.items || []);
      setTotal(data.total || '0.00');
    } catch (err: any) {
      setError(err?.message || 'Could not load cart');
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

  async function setQty(productId: string, quantity: number) {
    if (!token) return;
    setBusy(true);
    try {
      if (quantity < 1) await api.removeCartItem(productId, token);
      else await api.updateCartItem(productId, quantity, token);
      await load();
    } catch (err: any) {
      Alert.alert('Cart update failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Cart" subtitle="Review before checkout." scroll={false} loading={loading}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.product_id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Your cart is empty.</Text>}
        renderItem={({ item }) => {
          const thumb = item.product?.ImageUrls?.[0] || item.product?.ImageUrl;
          return (
            <View style={styles.row}>
              <View style={styles.thumb}>
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.image} />
                ) : (
                  <Text style={styles.ph}>{item.product?.Product_Name?.slice(0, 1)}</Text>
                )}
              </View>
              <View style={styles.copy}>
                <Text style={styles.name}>{item.product?.Product_Name}</Text>
                <Text style={styles.price}>{formatPrice(item.product?.Price)}</Text>
                <View style={styles.qtyRow}>
                  <Pressable
                    style={styles.qtyBtn}
                    disabled={busy}
                    onPress={() => setQty(item.product_id, item.quantity - 1)}
                  >
                    <Text style={styles.qtyText}>−</Text>
                  </Pressable>
                  <Text style={styles.qty}>{item.quantity}</Text>
                  <Pressable
                    style={styles.qtyBtn}
                    disabled={busy}
                    onPress={() => setQty(item.product_id, item.quantity + 1)}
                  >
                    <Text style={styles.qtyText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />
      {items.length ? (
        <View style={styles.footer}>
          <Text style={styles.total}>Total {formatPrice(total)}</Text>
          <Pressable
            style={styles.button}
            onPress={() => navigation.navigate('Checkout')}
          >
            <Text style={styles.buttonText}>Checkout</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 120, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surfaceStrong,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(61,42,79,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  ph: { fontWeight: '800', color: colors.brand, fontSize: 20 },
  copy: { flex: 1, gap: 4 },
  name: { fontWeight: '700', color: colors.ink },
  price: { color: colors.accent, fontWeight: '800' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: { fontSize: 18, fontWeight: '700', color: colors.brand },
  qty: { fontWeight: '700', minWidth: 16, textAlign: 'center' },
  footer: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: colors.surfaceStrong,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  total: { fontSize: 18, fontWeight: '800', color: colors.ink },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '800' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 48 },
  error: { color: colors.danger, marginBottom: 8 },
});
