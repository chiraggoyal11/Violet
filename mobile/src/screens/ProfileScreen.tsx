import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import RequireAuth from '../components/RequireAuth';
import { API_URL } from '../config';
import { colors, spacing } from '../theme';
import { ui } from '../ui';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'AccountHome'>;

const MENU: { label: string; screen: keyof AccountStackParamList; adminOnly?: boolean }[] = [
  { label: 'Edit profile', screen: 'EditProfile' },
  { label: 'Favorites', screen: 'Favorites' },
  { label: 'Wishlist', screen: 'Wishlist' },
  { label: 'Notifications', screen: 'Notifications' },
  { label: 'Settings', screen: 'Settings' },
  { label: 'Seller dashboard', screen: 'SellerDashboard' },
  { label: 'Offers', screen: 'Offers' },
  { label: 'Messages', screen: 'Inbox' },
  { label: 'Admin', screen: 'Admin', adminOnly: true },
];

export default function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();

  return (
    <RequireAuth title="Account" subtitle="Sign in to manage your Violet account.">
      <Screen title="Account" subtitle="Your Violet hub.">
        <View style={ui.card}>
          <Text style={styles.name}>{user?.username}</Text>
          {user?.email ? <Text style={styles.meta}>{String(user.email)}</Text> : null}
          {user?.phone_no ? (
            <Text style={styles.meta}>
              {user.country_code || ''} {user.phone_no}
            </Text>
          ) : null}
          <Text style={styles.role}>Signed in as {String(user?.role || 'buyer')}</Text>
        </View>

        {MENU.filter((item) => !item.adminOnly || user?.role === 'admin').map((item) => (
          <Pressable
            key={item.screen}
            style={ui.menuRow}
            onPress={() => navigation.navigate(item.screen as any)}
          >
            <Text style={ui.menuLabel}>{item.label}</Text>
            <Text style={ui.menuChevron}>›</Text>
          </Pressable>
        ))}

        <Pressable
          style={ui.menuRow}
          onPress={() => navigation.getParent()?.navigate('SellTab', { screen: 'MyListings' })}
        >
          <Text style={ui.menuLabel}>My listings</Text>
          <Text style={ui.menuChevron}>›</Text>
        </Pressable>

        <View style={ui.card}>
          <Text style={ui.label}>API</Text>
          <Text style={styles.api} selectable>
            {API_URL}
          </Text>
        </View>

        <Pressable
          style={styles.signOut}
          onPress={() => {
            Alert.alert('Sign out?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void logout() },
            ]);
          }}
        >
          <Text style={ui.buttonText}>Sign out</Text>
        </Pressable>
      </Screen>
    </RequireAuth>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 22, fontWeight: '800', color: colors.ink },
  meta: { color: colors.muted },
  role: { marginTop: 4, color: colors.inkSoft, textTransform: 'capitalize' },
  api: { color: colors.brand, fontSize: 13 },
  signOut: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
});
