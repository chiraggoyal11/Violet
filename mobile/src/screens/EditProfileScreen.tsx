import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { spacing } from '../theme';
import { ui } from '../ui';

export default function EditProfileScreen() {
  const { user, token, refreshMe, updateLocalUser } = useAuth();
  const addr = (user?.address || {}) as Record<string, string>;
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(String(user?.email || ''));
  const [line1, setLine1] = useState(addr.line1 || '');
  const [line2, setLine2] = useState(addr.line2 || '');
  const [city, setCity] = useState(addr.city || '');
  const [state, setState] = useState(addr.state || '');
  const [country, setCountry] = useState(addr.country || 'India');
  const [pincode, setPincode] = useState(addr.pincode || '');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!token) return;
    const hasAny = Boolean(line1 || line2 || city || state || country || pincode);
    if (hasAny) {
      if (!line1.trim() || !city.trim() || !state.trim() || !country.trim() || !/^\d{6}$/.test(pincode.trim())) {
        Alert.alert(
          'Incomplete address',
          'Provide line 1, city, state, country, and a 6-digit pincode — or clear all address fields.',
        );
        return;
      }
    }
    setBusy(true);
    try {
      const data = await api.updateProfile(
        {
          username: username.trim(),
          email: email.trim(),
          address: {
            line1: line1.trim(),
            line2: line2.trim(),
            city: city.trim(),
            state: state.trim(),
            country: country.trim(),
            pincode: pincode.trim(),
          },
        },
        token,
      );
      if (data?.user) updateLocalUser(data.user);
      else await refreshMe();
      Alert.alert('Saved', 'Profile updated.');
    } catch (err: any) {
      Alert.alert('Could not save', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Edit profile" subtitle="Account and shipping details.">
      <View style={styles.field}>
        <Text style={ui.label}>Username</Text>
        <TextInput style={ui.input} value={username} onChangeText={setUsername} autoCapitalize="none" />
      </View>
      <View style={styles.field}>
        <Text style={ui.label}>Email</Text>
        <TextInput
          style={ui.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>
      {(
        [
          ['Address line 1', line1, setLine1],
          ['Address line 2', line2, setLine2],
          ['City', city, setCity],
          ['State', state, setState],
          ['Country', country, setCountry],
          ['Pincode', pincode, setPincode],
        ] as const
      ).map(([label, value, setter]) => (
        <View key={label} style={styles.field}>
          <Text style={ui.label}>{label}</Text>
          <TextInput
            style={ui.input}
            value={value}
            onChangeText={setter}
            keyboardType={label === 'Pincode' ? 'number-pad' : 'default'}
            maxLength={label === 'Pincode' ? 6 : undefined}
          />
        </View>
      ))}
      <Pressable style={[ui.button, busy && styles.disabled]} onPress={save} disabled={busy}>
        <Text style={ui.buttonText}>{busy ? 'Saving…' : 'Save profile'}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  disabled: { opacity: 0.6 },
});
