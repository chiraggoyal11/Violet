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
import { ui } from '../ui';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CartStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<CartStackParamList, 'CartHome'>;

function CartRow({
  item,
  mode,
  busy,
  onQty,
  onSave,
  onRemove,
  onMove,
}: {
  item: any;
  mode: 'cart' | 'saved';
  busy: boolean;
  onQty?: (id: string, qty: number) => void;
  onSave?: (id: string) => void;
  onRemove: (id: string) => void;
  onMove?: (id: string) => void;
}) {
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
        {mode === 'cart' && onQty ? (
          <View style={styles.qtyRow}>
            <Pressable
              style={styles.qtyBtn}
              disabled={busy}
              onPress={() => onQty(item.product_id, item.quantity - 1)}
            >
              <Text style={styles.qtyText}>−</Text>
            </Pressable>
            <Text style={styles.qty}>{item.quantity}</Text>
            <Pressable
              style={styles.qtyBtn}
              disabled={busy}
              onPress={() => onQty(item.product_id, item.quantity + 1)}
            >
              <Text style={styles.qtyText}>+</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={ui.muted}>Qty {item.quantity}</Text>
        )}
        <View style={styles.actions}>
          {mode === 'cart' && onSave ? (
            <Pressable disabled={busy} onPress={() => onSave(item.product_id)}>
              <Text style={styles.linkBtn}>Save for later</Text>
            </Pressable>
          ) : null}
          {mode === 'saved' && onMove ? (
            <Pressable disabled={busy} onPress={() => onMove(item.product_id)}>
              <Text style={styles.linkBtn}>Move to cart</Text>
            </Pressable>
          ) : null}
          <Pressable disabled={busy} onPress={() => onRemove(item.product_id)}>
            <Text style={styles.dangerBtn}>Remove</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function CartScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [saved, setSaved] = useState<any[]>([]);
  const [total, setTotal] = useState('0.00');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const apply = useCallback((data: any) => {
    setItems(data.items || []);
    setSaved(data.savedForLater || []);
    setTotal(data.total || '0.00');
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const data = await api.getCart(token);
      apply(data);
    } catch (err: any) {
      setError(err?.message || 'Could not load cart');
    } finally {
      setLoading(false);
    }
  }, [token, apply]);

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
      if (quantity < 1) {
        const data = await api.removeCartItem(productId, token);
        apply(data);
      } else {
        const data = await api.updateCartItem(productId, quantity, token);
        apply(data);
      }
    } catch (err: any) {
      Alert.alert('Cart update failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function saveForLater(productId: string) {
    if (!token) return;
    setBusy(true);
    try {
      const data = await api.saveForLater(productId, token);
      apply(data);
    } catch (err: any) {
      Alert.alert('Save failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function moveSaved(productId: string) {
    if (!token) return;
    setBusy(true);
    try {
      const data = await api.moveSavedToCart(productId, token);
      apply(data);
    } catch (err: any) {
      Alert.alert('Move failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function removeCart(productId: string) {
    if (!token) return;
    setBusy(true);
    try {
      const data = await api.removeCartItem(productId, token);
      apply(data);
    } catch (err: any) {
      Alert.alert('Remove failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function removeSaved(productId: string) {
    if (!token) return;
    setBusy(true);
    try {
      const data = await api.removeSavedItem(productId, token);
      apply(data);
    } catch (err: any) {
      Alert.alert('Remove failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Cart" subtitle="Review before checkout." scroll={false} loading={loading}>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => `cart-${item.product_id}`}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          items.length ? <Text style={styles.section}>In cart</Text> : null
        }
        ListEmptyComponent={<Text style={ui.empty}>Your cart is empty.</Text>}
        ListFooterComponent={
          <View style={styles.savedBlock}>
            <Text style={styles.section}>Saved for later</Text>
            {!saved.length ? <Text style={ui.muted}>Nothing saved yet.</Text> : null}
            {saved.map((item) => (
              <CartRow
                key={`saved-${item.product_id}`}
                item={item}
                mode="saved"
                busy={busy}
                onMove={moveSaved}
                onRemove={removeSaved}
              />
            ))}
          </View>
        }
        renderItem={({ item }) => (
          <CartRow
            item={item}
            mode="cart"
            busy={busy}
            onQty={setQty}
            onSave={saveForLater}
            onRemove={removeCart}
          />
        )}
      />
      {items.length ? (
        <View style={styles.footer}>
          <Text style={styles.total}>Total {formatPrice(total)}</Text>
          <Pressable style={ui.button} onPress={() => navigation.navigate('Checkout')}>
            <Text style={ui.buttonText}>Checkout</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 140, gap: spacing.sm },
  section: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.brand,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  savedBlock: { gap: spacing.sm, marginTop: spacing.md },
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
  actions: { flexDirection: 'row', gap: 14, marginTop: 4 },
  linkBtn: { color: colors.brand, fontWeight: '700' },
  dangerBtn: { color: colors.danger, fontWeight: '700' },
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
});
