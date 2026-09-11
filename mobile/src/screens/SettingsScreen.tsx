import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { colors, spacing } from '../theme';
import { ui } from '../ui';

const BOOL_KEYS = [
  ['orderUpdates', 'Order updates'],
  ['messageAlerts', 'Message alerts'],
  ['promoAlerts', 'Promo alerts'],
  ['reviewReminders', 'Review reminders'],
  ['stockAlerts', 'Stock alerts'],
] as const;

export default function SettingsScreen() {
  const { user, token, updateLocalUser, refreshMe } = useAuth();
  const settings = (user?.settings || {}) as Record<string, unknown>;
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    orderUpdates: settings.orderUpdates !== false,
    messageAlerts: settings.messageAlerts !== false,
    promoAlerts: Boolean(settings.promoAlerts),
    reviewReminders: settings.reviewReminders !== false,
    stockAlerts: settings.stockAlerts !== false,
  });
  const [currency, setCurrency] = useState(String(settings.preferredCurrency || 'INR'));
  const [note, setNote] = useState(String(settings.defaultCheckoutNote || ''));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const next = (user?.settings || {}) as Record<string, unknown>;
    setPrefs({
      orderUpdates: next.orderUpdates !== false,
      messageAlerts: next.messageAlerts !== false,
      promoAlerts: Boolean(next.promoAlerts),
      reviewReminders: next.reviewReminders !== false,
      stockAlerts: next.stockAlerts !== false,
    });
    setCurrency(String(next.preferredCurrency || 'INR'));
    setNote(String(next.defaultCheckoutNote || ''));
  }, [user]);

  async function save() {
    if (!token) return;
    setBusy(true);
    try {
      const data = await api.updateSettings(
        {
          ...prefs,
          preferredCurrency: currency.trim() || 'INR',
          defaultCheckoutNote: note,
        },
        token,
      );
      if (data?.user) updateLocalUser(data.user);
      else await refreshMe();
      Alert.alert('Saved', 'Settings updated.');
    } catch (err: any) {
      Alert.alert('Could not save', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Settings" subtitle="Notifications and preferences.">
      {BOOL_KEYS.map(([key, label]) => (
        <View key={key} style={styles.row}>
          <Text style={ui.label}>{label}</Text>
          <Switch
            value={Boolean(prefs[key])}
            onValueChange={(v) => setPrefs((prev) => ({ ...prev, [key]: v }))}
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
      ))}
      <View style={styles.field}>
        <Text style={ui.label}>Preferred currency</Text>
        <TextInput style={ui.input} value={currency} onChangeText={setCurrency} autoCapitalize="characters" />
      </View>
      <View style={styles.field}>
        <Text style={ui.label}>Default checkout note</Text>
        <TextInput style={ui.input} value={note} onChangeText={setNote} placeholder="Optional note" />
      </View>
      <Pressable style={[ui.button, busy && styles.disabled]} onPress={save} disabled={busy}>
        <Text style={ui.buttonText}>{busy ? 'Saving…' : 'Save settings'}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surfaceStrong,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  field: { gap: 6 },
  disabled: { opacity: 0.6 },
});
