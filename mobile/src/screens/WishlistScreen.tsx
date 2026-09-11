import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import ProductCard from '../components/ProductCard';
import Screen from '../components/Screen';
import { spacing } from '../theme';
import { ui } from '../ui';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'Wishlist'>;

export default function WishlistScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [shareToken, setShareToken] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const data = await api.getWishlist(token);
      setProducts(data.products || []);
      setShareUrl(data.shareUrl || '');
      setShareToken(data.wishlist?.shareToken || '');
    } catch (err: any) {
      setError(err?.message || 'Could not load wishlist');
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

  async function remove(productId: string) {
    if (!token) return;
    setBusyId(productId);
    try {
      await api.removeWishlistItem(productId, token);
      setProducts((prev) => prev.filter((p) => String(p._id) !== String(productId)));
    } catch (err: any) {
      Alert.alert('Could not remove', err?.message || 'Try again');
    } finally {
      setBusyId('');
    }
  }

  return (
    <Screen title="Wishlist" subtitle="Pieces you want to revisit." scroll={false} loading={loading && !products.length}>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      {shareToken || shareUrl ? (
        <View style={[ui.card, styles.share]}>
          <Text style={ui.label}>Share token</Text>
          <Text selectable style={ui.muted}>
            {shareToken || shareUrl}
          </Text>
          {shareUrl ? <Text style={ui.muted}>Path: {shareUrl}</Text> : null}
        </View>
      ) : null}
      <FlatList
        data={products}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!loading ? <Text style={ui.empty}>Wishlist is empty.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <ProductCard
              product={item}
              onPress={() =>
                navigation.getParent()?.navigate('ShopTab', {
                  screen: 'ProductDetail',
                  params: { id: item._id },
                })
              }
            />
            <Pressable
              style={[ui.buttonSecondary, busyId === item._id && styles.disabled]}
              disabled={busyId === item._id}
              onPress={() => remove(item._id)}
            >
              <Text style={ui.buttonSecondaryText}>
                {busyId === item._id ? 'Removing…' : 'Remove'}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 40, gap: spacing.md },
  item: { gap: spacing.sm },
  share: { marginBottom: spacing.sm },
  disabled: { opacity: 0.6 },
});
