import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { formatPrice } from '../components/ProductCard';
import { colors, spacing } from '../theme';
import { ui } from '../ui';

export default function MyListingsScreen() {
  const { token, user } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user?._id) return;
    setError('');
    try {
      const data = await api.listMyProducts(user._id);
      setProducts(data.product || data.products || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load listings');
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  async function sold(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await api.markSold(id, token);
      await load();
    } catch (err: any) {
      Alert.alert('Could not mark sold', err?.message || 'Try again');
    } finally {
      setBusyId('');
    }
  }

  async function remove(id: string) {
    if (!token) return;
    Alert.alert('Delete listing?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            await api.deleteProducts([id], token);
            setProducts((prev) => prev.filter((p) => String(p._id) !== String(id)));
          } catch (err: any) {
            Alert.alert('Could not delete', err?.message || 'Try again');
          } finally {
            setBusyId('');
          }
        },
      },
    ]);
  }

  return (
    <Screen title="My listings" subtitle="Manage what you sell." scroll={false} loading={loading && !products.length}>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <FlatList
        data={products}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!loading ? <Text style={ui.empty}>No listings yet.</Text> : null}
        renderItem={({ item }) => {
          const thumb = item.ImageUrls?.[0] || item.ImageUrl;
          return (
            <View style={ui.card}>
              <View style={styles.row}>
                <View style={styles.thumb}>
                  {thumb ? (
                    <Image source={{ uri: thumb }} style={styles.image} />
                  ) : (
                    <Text style={styles.ph}>{item.Product_Name?.slice(0, 1)}</Text>
                  )}
                </View>
                <View style={styles.copy}>
                  <Text style={ui.label}>{item.Product_Name}</Text>
                  <Text style={styles.price}>{formatPrice(item.Price)}</Text>
                  <Text style={ui.muted}>
                    {item.status} · stock {item.stock}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                {item.status !== 'sold' ? (
                  <Pressable
                    style={[ui.buttonSecondary, busyId === item._id && styles.disabled]}
                    disabled={busyId === item._id}
                    onPress={() => sold(item._id)}
                  >
                    <Text style={ui.buttonSecondaryText}>Mark sold</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[ui.buttonDanger, busyId === item._id && styles.disabled]}
                  disabled={busyId === item._id}
                  onPress={() => remove(item._id)}
                >
                  <Text style={ui.buttonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 40, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(61,42,79,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  ph: { fontWeight: '800', color: colors.brand, fontSize: 20 },
  copy: { flex: 1, gap: 2 },
  price: { color: colors.accent, fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  disabled: { opacity: 0.6 },
});
