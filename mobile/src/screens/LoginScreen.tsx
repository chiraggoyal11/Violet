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
import { spacing } from '../theme';
import { ui } from '../ui';
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
          style={[ui.input, styles.code]}
          value={countryCode}
          onChangeText={setCountryCode}
          autoCapitalize="none"
          placeholder="+91"
        />
        <TextInput
          style={[ui.input, styles.flex]}
          value={phone}
          onChangeText={setPhone}
          keyboardType="number-pad"
          placeholder="Phone number"
          maxLength={10}
        />
      </View>
      <TextInput
        style={ui.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Password"
      />
      <Pressable
        style={[ui.button, busy && styles.disabled]}
        onPress={onSubmit}
        disabled={busy}
      >
        <Text style={ui.buttonText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('Register')}>
        <Text style={ui.link}>Create an account</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
        <Text style={ui.link}>Forgot password?</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('GuestCheckout')}>
        <Text style={ui.link}>Continue as guest</Text>
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
