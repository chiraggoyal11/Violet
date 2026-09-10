import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { formatPrice } from '../components/ProductCard';
import { colors, spacing } from '../theme';
import type { ShopStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ShopStackParamList, 'ProductDetail'>;

export default function ProductDetailScreen({ route, navigation }: Props) {
  const { token } = useAuth();
  const { id } = route.params;
  const [product, setProduct] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.getProduct(id);
        if (!cancelled) {
          setProduct(data.product);
          setSeller(data.seller || null);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Could not load product');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function addToCart() {
    if (!token) {
      Alert.alert('Sign in required', 'Log in to add items to your cart.');
      return;
    }
    setBusy(true);
    try {
      await api.addCartItem(id, 1, token);
      Alert.alert('Added', 'Item added to cart.', [
        { text: 'Keep shopping', style: 'cancel' },
        { text: 'View cart', onPress: () => navigation.getParent()?.navigate('CartTab') },
      ]);
    } catch (err: any) {
      Alert.alert('Could not add', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  const image = product?.ImageUrls?.[0] || product?.ImageUrl;

  return (
    <Screen loading={loading} title={product?.Product_Name || 'Product'}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {product ? (
        <>
          <View style={styles.hero}>
            {image ? (
              <Image source={{ uri: image }} style={styles.image} />
            ) : (
              <Text style={styles.placeholder}>{product.Product_Name?.slice(0, 1)}</Text>
            )}
          </View>
          <Text style={styles.category}>{product.category || 'Other'}</Text>
          <Text style={styles.price}>{formatPrice(product.Price)}</Text>
          <Text style={styles.detail}>{product.Product_Detail}</Text>
          {seller?.username ? (
            <Text style={styles.seller}>Sold by {seller.shopName || seller.username}</Text>
          ) : null}
          <Text style={styles.stock}>
            {product.stock > 0 ? `${product.stock} in stock` : 'Sold out'}
          </Text>
          <Pressable
            style={[styles.button, (busy || product.stock < 1) && styles.disabled]}
            onPress={addToCart}
            disabled={busy || product.stock < 1}
          >
            <Text style={styles.buttonText}>{busy ? 'Adding…' : 'Add to cart'}</Text>
          </Pressable>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(61,42,79,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { fontSize: 48, fontWeight: '800', color: colors.brand },
  category: {
    textTransform: 'uppercase',
    fontWeight: '700',
    color: colors.muted,
    fontSize: 12,
  },
  price: { fontSize: 24, fontWeight: '800', color: colors.accent },
  detail: { color: colors.inkSoft, fontSize: 16, lineHeight: 22 },
  seller: { color: colors.brand, fontWeight: '700' },
  stock: { color: colors.inkSoft },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  disabled: { opacity: 0.55 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  error: { color: colors.danger },
});
