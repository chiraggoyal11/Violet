import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import ProductCard from '../components/ProductCard';
import Screen from '../components/Screen';
import { spacing } from '../theme';
import { ui } from '../ui';
import type { ShopStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ShopStackParamList, 'PublicShop'>;

export default function PublicShopScreen({ route, navigation }: Props) {
  const { username } = route.params;
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.getShop(username);
        if (cancelled) return;
        setShop(data.shop || data.seller || data.user || null);
        setProducts(data.products || data.product || []);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load shop');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username]);

  const title = shop?.shopName || shop?.username || username;

  return (
    <Screen
      title={title}
      subtitle={shop?.bio || `@${username}`}
      scroll={false}
      loading={loading}
    >
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <FlatList
        data={products}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!loading ? <Text style={ui.empty}>No products in this shop.</Text> : null}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <ProductCard
              product={item}
              onPress={() => navigation.navigate('ProductDetail', { id: item._id })}
            />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 40, gap: spacing.sm },
  row: { gap: spacing.sm },
  cardWrap: { flex: 1 },
});
