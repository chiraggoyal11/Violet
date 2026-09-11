import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { colors, spacing } from '../theme';
import type { CartStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<CartStackParamList, 'Checkout'>;

export default function CheckoutScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const addr = (user?.address || {}) as Record<string, string>;
  const [line1, setLine1] = useState(addr.line1 || '');
  const [line2, setLine2] = useState(addr.line2 || '');
  const [city, setCity] = useState(addr.city || '');
  const [state, setState] = useState(addr.state || '');
  const [country, setCountry] = useState(addr.country || 'India');
  const [pincode, setPincode] = useState(addr.pincode || '');
  const [busy, setBusy] = useState(false);

  async function placeOrder() {
    if (!token) {
      Alert.alert('Sign in required');
      return;
    }
    if (!line1.trim() || !city.trim() || !state.trim() || !country.trim() || !/^\d{6}$/.test(pincode.trim())) {
      Alert.alert(
        'Missing fields',
        'Enter line 1, city, state, country, and a 6-digit pincode.',
      );
      return;
    }
    setBusy(true);
    try {
      const data = await api.checkout(
        {
          shippingAddress: {
            line1: line1.trim(),
            line2: line2.trim(),
            city: city.trim(),
            state: state.trim(),
            country: country.trim(),
            pincode: pincode.trim(),
          },
          paymentMethod: 'cod',
        },
        token,
      );
      const orderId = data?.order?._id || data?._id;
      Alert.alert(
        'Order placed',
        orderId
          ? `COD order #${String(orderId).slice(-6).toUpperCase()}`
          : data?.msg || 'Cash on delivery order placed.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.popToTop();
              navigation.getParent()?.navigate('OrdersTab');
            },
          },
        ],
      );
    } catch (err: any) {
      Alert.alert('Checkout failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Checkout" subtitle="Cash on delivery for the first mobile release.">
      {(
        [
          ['Address line 1', line1, setLine1],
          ['Address line 2 (optional)', line2, setLine2],
          ['City', city, setCity],
          ['State', state, setState],
          ['Country', country, setCountry],
          ['Pincode (6 digits)', pincode, setPincode],
        ] as const
      ).map(([label, value, setter]) => (
        <View key={label} style={styles.field}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setter}
            placeholder={label}
            placeholderTextColor={colors.muted}
            keyboardType={label.startsWith('Pincode') ? 'number-pad' : 'default'}
            maxLength={label.startsWith('Pincode') ? 6 : undefined}
          />
        </View>
      ))}
      <Pressable
        style={[styles.button, busy && styles.disabled]}
        onPress={placeOrder}
        disabled={busy}
      >
        <Text style={styles.buttonText}>{busy ? 'Placing…' : 'Place COD order'}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontWeight: '700', color: colors.ink },
  input: {
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
