import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import Screen from './Screen';
import { colors, spacing } from '../theme';
import { ui } from '../ui';
import { openAuth } from '../navigation/ref';

/**
 * Wraps screens that need a signed-in user. Guests see a sign-in prompt
 * instead of a hard app-wide auth wall (matches web guest browsing).
 */
export default function RequireAuth({
  children,
  title = 'Sign in required',
  subtitle = 'Create an account or sign in to continue.',
  onSignIn,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  onSignIn?: () => void;
}) {
  const { token, booting } = useAuth();

  if (booting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!token) {
    return (
      <Screen title={title} subtitle={subtitle}>
        <Text style={styles.copy}>
          You can keep browsing Shop without an account. Sign in to use cart, checkout, selling, and
          messages.
        </Text>
        <Pressable
          style={ui.button}
          onPress={() => {
            if (onSignIn) onSignIn();
            else openAuth();
          }}
        >
          <Text style={ui.buttonText}>Sign in</Text>
        </Pressable>
        <Pressable style={ui.buttonSecondary} onPress={() => openAuth('Register')}>
          <Text style={ui.buttonSecondaryText}>Create account</Text>
        </Pressable>
        <Pressable onPress={() => openAuth('GuestCheckout')}>
          <Text style={ui.link}>Continue as guest</Text>
        </Pressable>
      </Screen>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  copy: { color: colors.inkSoft, lineHeight: 22, marginBottom: spacing.md },
});
