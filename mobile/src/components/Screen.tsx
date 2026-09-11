import React from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, spacing } from '../theme';

type Props = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export default function Screen({
  children,
  title,
  subtitle,
  scroll = true,
  loading = false,
  style,
}: Props) {
  const body = loading ? (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.muted}>Loading…</Text>
    </View>
  ) : (
    children
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.inner, style]}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  inner: { flex: 1, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.brand,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.inkSoft,
    marginBottom: spacing.md,
    fontSize: 15,
  },
  scroll: { paddingBottom: spacing.xl, gap: spacing.md },
  center: { paddingTop: 48, alignItems: 'center', gap: 10 },
  muted: { color: colors.muted },
});
