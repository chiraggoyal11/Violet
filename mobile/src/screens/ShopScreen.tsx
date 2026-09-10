import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import ProductCard from '../components/ProductCard';
import Screen from '../components/Screen';
import { PRODUCT_CATEGORIES } from '../data/categories';
import { colors, spacing } from '../theme';
import type { ShopStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ShopStackParamList, 'ShopHome'>;

export default function ShopScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await api.listProducts({
        name: query.trim(),
        category,
        status: 'active',
        sort: 'newest',
        page: 1,
        limit: 24,
      });
      setProducts(data.product || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load products');
      setProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [query, category]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  return (
    <Screen title="Shop" subtitle="Handmade finds on Violet." scroll={false} loading={loading}>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search handmade goods"
        returnKeyType="search"
        onSubmitEditing={() => {
          setLoading(true);
          load();
        }}
      />
      <FlatList
        horizontal
        data={['', ...PRODUCT_CATEGORIES]}
        keyExtractor={(item) => item || 'all'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        renderItem={({ item }) => {
          const active = category === item;
          return (
            <Pressable
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                setCategory(item);
                setLoading(true);
              }}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {item || 'All'}
              </Text>
            </Pressable>
          );
        }}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={products}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>No listings in this category yet.</Text> : null
        }
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
  search: {
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: spacing.sm,
    fontSize: 16,
  },
  chips: { gap: 8, paddingBottom: spacing.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { color: colors.inkSoft, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  list: { paddingBottom: 40, gap: spacing.sm },
  row: { gap: spacing.sm },
  cardWrap: { flex: 1 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  error: { color: colors.danger, marginBottom: spacing.sm },
});
