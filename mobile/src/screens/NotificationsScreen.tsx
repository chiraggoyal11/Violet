import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { colors, spacing } from '../theme';
import { ui } from '../ui';

export default function NotificationsScreen() {
  const { token } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const data = await api.listNotifications(token);
      setRows(data.notifications || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load notifications');
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

  async function markAllRead() {
    if (!token) return;
    setBusy(true);
    try {
      await api.markAllNotificationsRead(token);
      await load();
    } catch (err: any) {
      Alert.alert('Could not update', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="Notifications"
      subtitle="Orders, messages, and marketplace updates."
      scroll={false}
      loading={loading && !rows.length}
    >
      {error ? <Text style={ui.error}>{error}</Text> : null}
      <Pressable style={[ui.buttonSecondary, busy && styles.disabled]} onPress={markAllRead} disabled={busy}>
        <Text style={ui.buttonSecondaryText}>{busy ? 'Marking…' : 'Mark all read'}</Text>
      </Pressable>
      <FlatList
        data={rows}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={!loading ? <Text style={ui.empty}>You are all caught up.</Text> : null}
        renderItem={({ item }) => (
          <View style={[ui.card, !item.read && styles.unread]}>
            <Text style={ui.label}>{item.title}</Text>
            {item.body ? <Text style={ui.muted}>{item.body}</Text> : null}
            <Text style={styles.time}>
              {item.createdAt ? new Date(item.createdAt).toLocaleString() : ''}
            </Text>
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 40, gap: spacing.sm, marginTop: spacing.sm },
  unread: { borderColor: colors.brand },
  time: { color: colors.muted, fontSize: 12 },
  disabled: { opacity: 0.6 },
});
