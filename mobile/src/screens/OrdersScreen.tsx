import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { formatPrice } from '../components/ProductCard';
import { colors, spacing } from '../theme';
import { ui } from '../ui';

export default function OrdersScreen() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [returnDraft, setReturnDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const data = await api.listOrders(token);
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load orders');
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

  async function cancelPay(orderId: string) {
    if (!token) return;
    setBusyId(orderId);
    try {
      await api.cancelPayment(orderId, token);
      await load();
      Alert.alert('Cancelled', 'Pending payment cancelled.');
    } catch (err: any) {
      Alert.alert('Cancel failed', err?.message || 'Try again');
    } finally {
      setBusyId('');
    }
  }

  async function markDelivered(orderId: string) {
    if (!token) return;
    setBusyId(orderId);
    try {
      await api.updateOrderStatus(orderId, { status: 'delivered' }, token);
      await load();
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Try again');
    } finally {
      setBusyId('');
    }
  }

  async function requestReturn(orderId: string) {
    if (!token) return;
    const reason = (returnDraft[orderId] || '').trim();
    if (!reason) {
      Alert.alert('Reason required', 'Enter a return reason.');
      return;
    }
    setBusyId(orderId);
    try {
      await api.requestReturn(orderId, reason, token);
      setReturnDraft((prev) => ({ ...prev, [orderId]: '' }));
      await load();
      Alert.alert('Requested', 'Return request submitted.');
    } catch (err: any) {
      Alert.alert('Return failed', err?.message || 'Try again');
    } finally {
      setBusyId('');
    }
  }

  return (
    <Screen title="Orders" subtitle="Your Violet purchases." scroll={false} loading={loading && !orders.length}>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <FlatList
        data={orders}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={ui.empty}>No orders yet. Shop something handmade!</Text>
          ) : null
        }
        renderItem={({ item }) => {
          const pendingPay =
            item.paymentStatus === 'pending' &&
            (item.paymentMethod === 'upi' || item.paymentMethod === 'card');
          const canDeliver = item.status === 'shipped';
          const canReturn =
            item.status === 'delivered' && item.returnRequest?.status !== 'requested';
          return (
            <View style={ui.card}>
              <View style={ui.row}>
                <Text style={styles.id}>#{String(item._id).slice(-6).toUpperCase()}</Text>
                <Text style={styles.money}>{formatPrice(item.total)}</Text>
              </View>
              <Text style={styles.meta}>
                {item.status} · {item.paymentStatus} · {item.paymentMethod}
              </Text>
              <Text style={styles.items} numberOfLines={2}>
                {(item.items || [])
                  .map((i: any) => i.title || i.Product_Name || i.product_name)
                  .filter(Boolean)
                  .join(', ') || 'Items'}
              </Text>
              {pendingPay ? (
                <Pressable
                  style={[ui.buttonDanger, busyId === item._id && styles.disabled]}
                  disabled={busyId === item._id}
                  onPress={() => cancelPay(item._id)}
                >
                  <Text style={ui.buttonText}>Cancel payment</Text>
                </Pressable>
              ) : null}
              {canDeliver ? (
                <Pressable
                  style={[ui.button, busyId === item._id && styles.disabled]}
                  disabled={busyId === item._id}
                  onPress={() => markDelivered(item._id)}
                >
                  <Text style={ui.buttonText}>Mark delivered</Text>
                </Pressable>
              ) : null}
              {canReturn ? (
                <>
                  <TextInput
                    style={ui.input}
                    placeholder="Return reason"
                    value={returnDraft[item._id] || ''}
                    onChangeText={(v) =>
                      setReturnDraft((prev) => ({ ...prev, [item._id]: v }))
                    }
                  />
                  <Pressable
                    style={[ui.buttonSecondary, busyId === item._id && styles.disabled]}
                    disabled={busyId === item._id}
                    onPress={() => requestReturn(item._id)}
                  >
                    <Text style={ui.buttonSecondaryText}>Request return</Text>
                  </Pressable>
                </>
              ) : null}
              {item.returnRequest?.status ? (
                <Text style={ui.muted}>Return: {item.returnRequest.status}</Text>
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
  id: { fontWeight: '800', color: colors.ink },
  money: { fontWeight: '800', color: colors.accent },
  meta: { color: colors.muted, fontSize: 13, textTransform: 'capitalize' },
  items: { color: colors.inkSoft, fontSize: 14 },
  disabled: { opacity: 0.6 },
});
