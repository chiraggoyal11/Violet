import React, { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { colors, spacing } from '../theme';
import type { MessagesStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<MessagesStackParamList, 'Thread'>;

export default function ThreadScreen({ route }: Props) {
  const { conversationId } = route.params;
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [recipientId, setRecipientId] = useState('');
  const [productId, setProductId] = useState<string | undefined>();
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await api.getConversation(conversationId, token);
      setMessages(data.messages || []);
      const other = data.conversation?.otherUser?._id;
      if (other) setRecipientId(String(other));
      if (data.conversation?.product_id) {
        setProductId(String(data.conversation.product_id));
      }
    } catch {
      /* keep existing */
    } finally {
      setLoading(false);
    }
  }, [conversationId, token]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  async function send() {
    const text = body.trim();
    if (!text || !token || !recipientId || sending) return;
    setSending(true);
    try {
      const data = await api.sendMessage(
        {
          recipient_id: recipientId,
          body: text,
          ...(productId ? { product_id: productId } : {}),
        },
        token,
      );
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      } else {
        await load();
      }
      setBody('');
    } catch {
      /* ignore for now */
    } finally {
      setSending(false);
    }
  }

  if (loading && !messages.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const mine = String(item.sender_id) === String(user?._id);
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={[styles.body, mine && styles.mineText]}>{item.body}</Text>
            </View>
          );
        }}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={body}
          onChangeText={setBody}
          placeholder="Message…"
          placeholderTextColor={colors.muted}
          multiline
        />
        <Pressable style={styles.send} onPress={send} disabled={sending || !recipientId}>
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  muted: { color: colors.muted },
  list: { padding: spacing.md, gap: 8 },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.brand },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  body: { color: colors.ink },
  mineText: { color: '#fff' },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceStrong,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
  },
  send: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  sendText: { color: '#fff', fontWeight: '700' },
});
