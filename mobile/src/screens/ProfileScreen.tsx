import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { API_URL } from '../config';
import { colors, spacing } from '../theme';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <Screen title="Profile" subtitle="Your Violet account.">
      <View style={styles.card}>
        <Text style={styles.name}>{user?.username}</Text>
        {user?.email ? <Text style={styles.meta}>{String(user.email)}</Text> : null}
        {user?.phone_no ? (
          <Text style={styles.meta}>
            {user.country_code || ''} {user.phone_no}
          </Text>
        ) : null}
        <Text style={styles.role}>Signed in as {String(user?.role || 'buyer')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>API</Text>
        <Text style={styles.api} selectable>
          {API_URL}
        </Text>
        <Text style={styles.hint}>
          For a physical device, set EXPO_PUBLIC_API_URL to your computer’s LAN IP (not localhost).
          Android emulator: http://10.0.2.2:5000
        </Text>
      </View>

      <Pressable
        style={styles.button}
        onPress={() => {
          Alert.alert('Sign out?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
          ]);
        }}
      >
        <Text style={styles.buttonText}>Sign out</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  name: { fontSize: 22, fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted },
  role: { marginTop: 4, color: colors.inkSoft, textTransform: 'capitalize' },
  label: { fontWeight: '800', color: colors.ink },
  api: { color: colors.brand, fontSize: 13 },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonText: { color: '#fff', fontWeight: '800' },
});
