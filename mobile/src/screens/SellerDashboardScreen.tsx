import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { formatPrice } from '../components/ProductCard';
import { colors, spacing } from '../theme';
import { ui } from '../ui';

export default function SellerDashboardScreen() {
  const { token } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [shipDraft, setShipDraft] = useState<Record<string, { trackingNumber?: string; carrier?: string }>>({});
  const [payoutAmount, setPayoutAmount] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const [s, salesData, payoutData] = await Promise.all([
        api.sellerStats(token),
        api.listSales(token),
        api.getPayouts(token).catch(() => null),
      ]);
      setStats(s.stats || null);
      setSales(salesData.sales || []);
      setBalance(payoutData?.balance || null);
    } catch (err: any) {
      setError(err?.message || 'Could not load dashboard');
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

  async function ship(saleId: string) {
    if (!token) return;
    const draft = shipDraft[saleId] || {};
    setBusyId(saleId);
    try {
      await api.updateOrderStatus(
        saleId,
        {
          status: 'shipped',
          trackingNumber: draft.trackingNumber || '',
          carrier: draft.carrier || '',
        },
        token,
      );
      await load();
    } catch (err: any) {
      Alert.alert('Could not ship', err?.message || 'Try again');
    } finally {
      setBusyId('');
    }
  }

  async function resolve(saleId: string, decision: string) {
    if (!token) return;
    setBusyId(`${saleId}-${decision}`);
    try {
      await api.resolveReturn(saleId, decision, token);
      await load();
    } catch (err: any) {
      Alert.alert('Could not resolve', err?.message || 'Try again');
    } finally {
      setBusyId('');
    }
  }

  async function requestPayout() {
    if (!token) return;
    setBusyId('payout');
    try {
      await api.requestPayout({ amount: Number(payoutAmount) }, token);
      setPayoutAmount('');
      Alert.alert('Requested', 'Payout request submitted.');
      await load();
    } catch (err: any) {
      Alert.alert('Payout failed', err?.message || 'Try again');
    } finally {
      setBusyId('');
    }
  }

  return (
    <Screen title="Seller dashboard" subtitle="Sales, shipping, and payouts." loading={loading && !stats}>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      {stats ? (
        <View style={styles.stats}>
          <View style={ui.card}>
            <Text style={ui.muted}>Active</Text>
            <Text style={styles.statVal}>{stats.active}</Text>
          </View>
          <View style={ui.card}>
            <Text style={ui.muted}>Sold</Text>
            <Text style={styles.statVal}>{stats.sold}</Text>
          </View>
          <View style={ui.card}>
            <Text style={ui.muted}>Revenue</Text>
            <Text style={styles.statVal}>{formatPrice(stats.revenue)}</Text>
          </View>
        </View>
      ) : null}

      {balance ? (
        <View style={ui.card}>
          <Text style={ui.label}>Payouts</Text>
          <Text style={ui.muted}>
            Available {formatPrice(balance.available)} · Earned {formatPrice(balance.earned)}
          </Text>
          <TextInput
            style={ui.input}
            value={payoutAmount}
            onChangeText={setPayoutAmount}
            placeholder="Amount (min ₹100)"
            keyboardType="decimal-pad"
          />
          <Pressable
            style={[ui.button, busyId === 'payout' && styles.disabled]}
            onPress={requestPayout}
            disabled={busyId === 'payout'}
          >
            <Text style={ui.buttonText}>Request payout</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.heading}>Recent sales</Text>
      {!loading && !sales.length ? <Text style={ui.empty}>No sales yet.</Text> : null}
      {sales.map((sale) => {
        const draft = shipDraft[sale._id] || {};
        const returnOpen = sale.returnRequest?.status === 'requested';
        const canShip =
          (sale.status === 'placed' || sale.status === 'shipped') &&
          sale.status !== 'delivered' &&
          sale.status !== 'returned';
        return (
          <View key={sale._id} style={ui.card}>
            <View style={ui.row}>
              <Text style={ui.label}>#{String(sale._id).slice(-6).toUpperCase()}</Text>
              <Text style={styles.money}>{formatPrice(sale.total)}</Text>
            </View>
            <Text style={ui.muted}>{sale.status}</Text>
            {(sale.items || []).map((item: any, idx: number) => (
              <Text key={`${sale._id}-${idx}`} style={ui.muted}>
                {item.quantity}× {item.Product_Name}
              </Text>
            ))}
            {returnOpen ? (
              <View style={styles.actions}>
                {['approved', 'rejected', 'refunded'].map((d) => (
                  <Pressable
                    key={d}
                    style={ui.buttonSecondary}
                    disabled={busyId.startsWith(sale._id)}
                    onPress={() => resolve(sale._id, d)}
                  >
                    <Text style={ui.buttonSecondaryText}>{d}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {canShip ? (
              <>
                <TextInput
                  style={ui.input}
                  placeholder="Carrier"
                  value={draft.carrier || ''}
                  onChangeText={(v) =>
                    setShipDraft((prev) => ({ ...prev, [sale._id]: { ...draft, carrier: v } }))
                  }
                />
                <TextInput
                  style={ui.input}
                  placeholder="Tracking number"
                  value={draft.trackingNumber || ''}
                  onChangeText={(v) =>
                    setShipDraft((prev) => ({
                      ...prev,
                      [sale._id]: { ...draft, trackingNumber: v },
                    }))
                  }
                />
                <Pressable
                  style={[ui.button, busyId === sale._id && styles.disabled]}
                  disabled={busyId === sale._id}
                  onPress={() => ship(sale._id)}
                >
                  <Text style={ui.buttonText}>Mark shipped</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  statVal: { fontSize: 20, fontWeight: '800', color: colors.ink },
  heading: { fontSize: 18, fontWeight: '800', color: colors.brand, marginTop: spacing.sm },
  money: { fontWeight: '800', color: colors.accent },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  disabled: { opacity: 0.6 },
});
