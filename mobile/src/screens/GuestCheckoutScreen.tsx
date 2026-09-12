import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { spacing } from '../theme';
import { ui } from '../ui';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'GuestCheckout'>;

export default function GuestCheckoutScreen(_props: Props) {
  const { adoptSession } = useAuth();
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const data = await api.guestSession({
        email: email.trim(),
        country_code: countryCode.trim(),
        phone_no: phone.trim(),
        line1: line1.trim(),
        city: city.trim(),
        state: state.trim(),
        country: 'India',
        pincode: pincode.trim(),
      });
      if (!data?.token || !data?.user) throw new Error(data?.msg || 'Guest session failed');
      await adoptSession(data.token, data.user);
      const { closeAuth } = await import('../navigation/ref');
      closeAuth();
    } catch (err: any) {
      Alert.alert('Guest checkout failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Guest checkout" subtitle="Shop without creating a full account.">
      <TextInput style={ui.input} value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" />
      <View style={styles.row}>
        <TextInput style={[ui.input, styles.code]} value={countryCode} onChangeText={setCountryCode} />
        <TextInput style={[ui.input, styles.flex]} value={phone} onChangeText={setPhone} keyboardType="number-pad" placeholder="Phone" maxLength={10} />
      </View>
      <TextInput style={ui.input} value={line1} onChangeText={setLine1} placeholder="Address line 1" />
      <TextInput style={ui.input} value={city} onChangeText={setCity} placeholder="City" />
      <TextInput style={ui.input} value={state} onChangeText={setState} placeholder="State" />
      <TextInput style={ui.input} value={pincode} onChangeText={setPincode} placeholder="Pincode" keyboardType="number-pad" maxLength={6} />
      <Pressable style={[ui.button, busy && styles.disabled]} onPress={start} disabled={busy}>
        <Text style={ui.buttonText}>{busy ? 'Starting…' : 'Continue as guest'}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  code: { width: 84 },
  disabled: { opacity: 0.6 },
});
