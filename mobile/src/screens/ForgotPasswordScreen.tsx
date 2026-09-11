import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import Screen from '../components/Screen';
import { colors, spacing } from '../theme';
import { ui } from '../ui';
import type { AuthStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [devOtp, setDevOtp] = useState('');

  async function sendCode() {
    setBusy(true);
    try {
      const data = await api.forgotPassword(countryCode.trim(), phone.trim());
      setOtpSent(true);
      const code = data?.resetCode || data?.devOtp;
      if (code) setDevOtp(String(code));
      Alert.alert('Check your phone', data?.msg || 'Reset code sent.');
    } catch (err: any) {
      Alert.alert('Could not send code', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    try {
      await api.resetPassword({
        country_code: countryCode.trim(),
        phone_no: phone.trim(),
        otp: otp.trim(),
        password,
      });
      Alert.alert('Password updated', 'You can sign in with your new password.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err: any) {
      Alert.alert('Reset failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Reset password" subtitle="Recover access with a phone code.">
      <View style={styles.row}>
        <TextInput style={[ui.input, styles.code]} value={countryCode} onChangeText={setCountryCode} placeholder="+91" />
        <TextInput style={[ui.input, styles.flex]} value={phone} onChangeText={setPhone} keyboardType="number-pad" placeholder="Phone number" maxLength={10} />
      </View>
      {!otpSent ? (
        <Pressable style={[ui.button, busy && styles.disabled]} onPress={sendCode} disabled={busy}>
          <Text style={ui.buttonText}>{busy ? 'Sending…' : 'Send reset code'}</Text>
        </Pressable>
      ) : (
        <>
          {devOtp ? <Text style={styles.dev}>Dev code: {devOtp}</Text> : null}
          <TextInput style={ui.input} value={otp} onChangeText={setOtp} placeholder="Reset code" keyboardType="number-pad" />
          <TextInput style={ui.input} value={password} onChangeText={setPassword} placeholder="New password" secureTextEntry />
          <Pressable style={[ui.button, busy && styles.disabled]} onPress={reset} disabled={busy}>
            <Text style={ui.buttonText}>{busy ? 'Saving…' : 'Update password'}</Text>
          </Pressable>
        </>
      )}
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={ui.link}>Back to sign in</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  code: { width: 84 },
  disabled: { opacity: 0.6 },
  dev: { color: colors.brand, fontWeight: '700' },
});
