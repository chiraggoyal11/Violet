import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { formatPrice } from '../components/ProductCard';
import { colors, spacing } from '../theme';
import { ui } from '../ui';

export default function OffersScreen() {
  const { token, user } = useAuth();
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const data = await api.listOffers(token);
      setOffers(data.offers || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load offers');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  async function respond(id: string, status: 'accepted' | 'declined' | 'cancelled') {
    if (!token) return;
    setBusyId(id);
    try {
      await api.updateOffer(id, { status }, token);
      await load();
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Try again');
    } finally {
      setBusyId('');
    }
  }

  return (
    <Screen title="Offers" subtitle="Incoming and outgoing offers." scroll={false} loading={loading && !offers.length}>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <FlatList
        data={offers}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!loading ? <Text style={ui.empty}>No offers yet.</Text> : null}
        renderItem={({ item }) => {
          const isSeller = String(item.seller_id) === String(user?._id);
          const pending = item.status === 'pending';
          return (
            <View style={ui.card}>
              <View style={ui.row}>
                <Text style={ui.label}>{formatPrice(item.amount)}</Text>
                <Text style={styles.status}>{item.status}</Text>
              </View>
              {item.message ? <Text style={ui.muted}>{item.message}</Text> : null}
              <Text style={ui.muted}>
                {isSeller ? 'As seller' : 'As buyer'} · product {String(item.product_id).slice(-6)}
              </Text>
              {pending && isSeller ? (
                <View style={styles.actions}>
                  <Pressable
                    style={[ui.button, busyId === item._id && styles.disabled]}
                    disabled={busyId === item._id}
                    onPress={() => respond(item._id, 'accepted')}
                  >
                    <Text style={ui.buttonText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    style={[ui.buttonSecondary, busyId === item._id && styles.disabled]}
                    disabled={busyId === item._id}
                    onPress={() => respond(item._id, 'declined')}
                  >
                    <Text style={ui.buttonSecondaryText}>Decline</Text>
                  </Pressable>
                </View>
              ) : null}
              {pending && !isSeller ? (
                <Pressable
                  style={[ui.buttonSecondary, busyId === item._id && styles.disabled]}
                  disabled={busyId === item._id}
                  onPress={() => respond(item._id, 'cancelled')}
                >
                  <Text style={ui.buttonSecondaryText}>Cancel offer</Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 40, gap: spacing.sm },
  status: { color: colors.brand, fontWeight: '700', textTransform: 'capitalize' },
  actions: { flexDirection: 'row', gap: 8 },
  disabled: { opacity: 0.6 },
});
