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
import Screen from '../components/Screen';
import { useAuth } from '../AuthContext';
import { colors, spacing } from '../theme';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    try {
      await login(countryCode.trim(), phone.trim(), password);
    } catch (err: any) {
      Alert.alert('Sign in failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Violet" subtitle="Sign in to shop handmade goods.">
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.code]}
          value={countryCode}
          onChangeText={setCountryCode}
          autoCapitalize="none"
          placeholder="+91"
        />
        <TextInput
          style={[styles.input, styles.flex]}
          value={phone}
          onChangeText={setPhone}
          keyboardType="number-pad"
          placeholder="Phone number"
          maxLength={10}
        />
      </View>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
      />
      <Pressable
        style={[styles.button, busy && styles.disabled]}
        onPress={onSubmit}
        disabled={busy}
      >
        <Text style={styles.buttonText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Register')}>
        <Text style={styles.link}>Create an account</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  code: { width: 84 },
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
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  link: {
    textAlign: 'center',
    color: colors.brand,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
});
