import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { colors, spacing } from '../theme';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'Inbox'>;

export default function MessagesScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const data = await api.listConversations(token);
      setRows(data.conversations || []);
    } catch (err: any) {
      setError(err?.message || 'Could not load messages');
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

  return (
    <Screen
      title="Messages"
      subtitle="Chat with sellers and buyers."
      scroll={false}
      loading={loading && !rows.length}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={rows}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.brand} />
        }
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>
              No conversations yet. Message a seller from any product page.
            </Text>
          ) : null
        }
        renderItem={({ item }) => {
          const title = item.otherUser?.username || item.product_name || 'Chat';
          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                navigation.navigate('Thread', {
                  conversationId: item._id,
                  title,
                })
              }
            >
              <Text style={styles.name}>{title}</Text>
              <Text style={styles.preview} numberOfLines={2}>
                {item.lastMessage || 'Open thread'}
              </Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 40, gap: spacing.sm },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 48, paddingHorizontal: 12 },
  error: { color: colors.danger, marginBottom: 8 },
  card: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  name: { fontWeight: '800', color: colors.ink },
  preview: { color: colors.inkSoft },
});
