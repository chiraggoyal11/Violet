import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { PRODUCT_CATEGORIES } from '../data/categories';
import { colors, spacing } from '../theme';
import { ui } from '../ui';
import type { SellStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<SellStackParamList, 'SellHome'>;

const COLOURS = [
  'Black',
  'White',
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Pink',
  'Purple',
  'Brown',
  'Beige',
  'Grey',
  'Multicolor',
  'Other',
];

type PickedImage = { uri: string; name: string; type: string };

export default function SellScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<string>('Other');
  const [colour, setColour] = useState('Other');
  const [stock, setStock] = useState('1');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [busy, setBusy] = useState(false);

  async function pickImages() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to add listing images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 8,
    });
    if (result.canceled) return;
    const next = result.assets.map((asset, idx) => {
      const ext = (asset.uri.split('.').pop() || 'jpg').split('?')[0];
      return {
        uri: asset.uri,
        name: `photo_${Date.now()}_${idx}.${ext}`,
        type: asset.mimeType || `image/${ext === 'png' ? 'png' : 'jpeg'}`,
      };
    });
    setImages((prev) => [...prev, ...next].slice(0, 8));
  }

  async function submit() {
    if (!token) return;
    if (!name.trim() || !detail.trim() || !price.trim()) {
      Alert.alert('Missing fields', 'Name, detail, and price are required.');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('Product_Name', name.trim());
      form.append('Product_Detail', detail.trim());
      form.append('Price', price.trim());
      form.append('category', category);
      form.append('colour', colour);
      form.append('stock', String(Number(stock) || 1));
      for (const img of images) {
        form.append('Product_Image', {
          uri: img.uri,
          name: img.name,
          type: img.type,
        } as any);
      }
      const data = await api.addProduct(form, token);
      if (!data?.success && !data?.product) {
        throw new Error(data?.msg || 'Could not add product');
      }
      Alert.alert('Listed', 'Your product is live.', [
        { text: 'Add another', style: 'cancel' },
        { text: 'My listings', onPress: () => navigation.navigate('MyListings') },
      ]);
      setName('');
      setDetail('');
      setPrice('');
      setCategory('Other');
      setColour('Other');
      setStock('1');
      setImages([]);
    } catch (err: any) {
      Alert.alert('Could not list', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Sell" subtitle={`List a product as ${user?.username || 'you'}.`}>
      <Pressable style={ui.buttonSecondary} onPress={() => navigation.navigate('MyListings')}>
        <Text style={ui.buttonSecondaryText}>My listings</Text>
      </Pressable>
      <TextInput style={ui.input} value={name} onChangeText={setName} placeholder="Product name" />
      <TextInput
        style={[ui.input, styles.multiline]}
        value={detail}
        onChangeText={setDetail}
        placeholder="Details"
        multiline
      />
      <TextInput
        style={ui.input}
        value={price}
        onChangeText={setPrice}
        placeholder="Price"
        keyboardType="decimal-pad"
      />
      <TextInput
        style={ui.input}
        value={stock}
        onChangeText={setStock}
        placeholder="Stock"
        keyboardType="number-pad"
      />

      <Text style={ui.label}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.chipRow}>
        {PRODUCT_CATEGORIES.map((c) => {
          const active = category === c;
          return (
            <Pressable
              key={c}
              style={[ui.chip, active && ui.chipActive]}
              onPress={() => setCategory(c)}
            >
              <Text style={[ui.chipText, active && ui.chipTextActive]}>{c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={ui.label}>Colour</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ui.chipRow}>
        {COLOURS.map((c) => {
          const active = colour === c;
          return (
            <Pressable
              key={c}
              style={[ui.chip, active && ui.chipActive]}
              onPress={() => setColour(c)}
            >
              <Text style={[ui.chipText, active && ui.chipTextActive]}>{c}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable style={ui.buttonSecondary} onPress={pickImages}>
        <Text style={ui.buttonSecondaryText}>
          {images.length ? `Add photos (${images.length}/8)` : 'Pick photos'}
        </Text>
      </Pressable>
      {images.length ? (
        <ScrollView horizontal contentContainerStyle={styles.thumbs}>
          {images.map((img) => (
            <Image key={img.uri} source={{ uri: img.uri }} style={styles.thumb} />
          ))}
        </ScrollView>
      ) : null}

      <Pressable style={[ui.button, busy && styles.disabled]} onPress={submit} disabled={busy}>
        <Text style={ui.buttonText}>{busy ? 'Publishing…' : 'Publish listing'}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  thumbs: { gap: spacing.sm },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: colors.border,
  },
  disabled: { opacity: 0.6 },
});
