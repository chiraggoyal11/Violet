import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { colors, spacing } from '../theme';
import { ui } from '../ui';

export default function AdminScreen() {
  const { token, user } = useAuth();
  const [overview, setOverview] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token || user?.role !== 'admin') return;
    setError('');
    try {
      const [ov, rp] = await Promise.all([
        api.listAdminOverview(token),
        api.listAdminReports(token),
      ]);
      setOverview(ov.overview || null);
      setReports(rp.reports || []);
    } catch (err: any) {
      setError(err?.message || 'Admin load failed');
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  if (user?.role !== 'admin') {
    return (
      <Screen title="Admin" subtitle="Moderation tools.">
        <Text style={ui.error}>Admin access required.</Text>
      </Screen>
    );
  }

  async function patchReport(id: string, status: string) {
    if (!token) return;
    setBusyId(id);
    try {
      await api.patchAdminReport(id, { status }, token);
      await load();
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Try again');
    } finally {
      setBusyId('');
    }
  }

  return (
    <Screen title="Admin" subtitle="Overview and reports." loading={loading && !overview}>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      {overview ? (
        <View style={styles.stats}>
          {(
            [
              ['Users', overview.users],
              ['Products', overview.products],
              ['Orders', overview.orders],
              ['Open reports', overview.openReports],
              ['Coupons', overview.coupons],
            ] as const
          ).map(([label, value]) => (
            <View key={label} style={[ui.card, styles.stat]}>
              <Text style={ui.muted}>{label}</Text>
              <Text style={styles.statVal}>{value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.heading}>Reports</Text>
      {!loading && !reports.length ? <Text style={ui.empty}>No reports.</Text> : null}
      {reports.map((report) => (
        <View key={report._id} style={ui.card}>
          <Text style={ui.label}>
            {report.targetType} · {report.status}
          </Text>
          <Text style={ui.muted}>{report.reason}</Text>
          <View style={styles.actions}>
            {['reviewed', 'resolved', 'dismissed'].map((status) => (
              <Pressable
                key={status}
                style={[ui.buttonSecondary, busyId === report._id && styles.disabled]}
                disabled={busyId === report._id}
                onPress={() => patchReport(report._id, status)}
              >
                <Text style={ui.buttonSecondaryText}>{status}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { minWidth: '45%', flexGrow: 1 },
  statVal: { fontSize: 22, fontWeight: '800', color: colors.ink },
  heading: { fontSize: 18, fontWeight: '800', color: colors.brand },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  disabled: { opacity: 0.6 },
});
