import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';

type Product = {
  _id: string;
  Product_Name?: string;
  Product_Detail?: string;
  Price?: string | number;
  category?: string;
  ImageUrl?: string;
  ImageUrls?: string[];
  Images?: string[];
};

export function formatPrice(value?: string | number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `₹${n.toFixed(2)}`;
}

function productImage(product: Product) {
  return (
    product.ImageUrls?.[0] ||
    product.ImageUrl ||
    product.Images?.[0] ||
    null
  );
}

export default function ProductCard({
  product,
  onPress,
}: {
  product: Product;
  onPress: () => void;
}) {
  const image = productImage(product);
  const name = product.Product_Name || 'Untitled';
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.thumb}>
        {image ? (
          <Image source={{ uri: image }} style={styles.image} />
        ) : (
          <Text style={styles.placeholder}>{name.slice(0, 1).toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.copy}>
        {product.category ? <Text style={styles.category}>{product.category}</Text> : null}
        <Text style={styles.name} numberOfLines={2}>
          {name}
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
