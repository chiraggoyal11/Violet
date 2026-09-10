import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, spacing } from '../theme';

type Product = {
  _id: string;
  Product_Name: string;
  Product_Detail?: string;
  Price: string;
  category?: string;
  ImageUrl?: string;
  ImageUrls?: string[];
};

export function formatPrice(value?: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toFixed(2)}`;
}

export default function ProductCard({
  product,
  onPress,
}: {
  product: Product;
  onPress: () => void;
}) {
  const image = product.ImageUrls?.[0] || product.ImageUrl || null;
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.thumb}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <Text style={styles.placeholder}>
            {product.Product_Name?.slice(0, 1) || '?'}
          </Text>
        )}
      </View>
      <View style={styles.copy}>
        {product.category ? (
          <Text style={styles.category}>{product.category}</Text>
        ) : null}
        <Text style={styles.name} numberOfLines={2}>
          {product.Product_Name}
        </Text>
        <Text style={styles.price}>{formatPrice(product.Price)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceStrong,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  thumb: {
    aspectRatio: 1,
    backgroundColor: 'rgba(61,42,79,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { fontSize: 28, fontWeight: '800', color: colors.brand },
  copy: { padding: spacing.sm, gap: 4 },
  category: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  price: { fontSize: 15, fontWeight: '800', color: colors.accent },
});
