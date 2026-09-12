import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import Screen from '../components/Screen';
import { formatPrice } from '../components/ProductCard';
import { colors, spacing } from '../theme';
import { ui } from '../ui';
import type { CartStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<CartStackParamList, 'Checkout'>;
type PayMethod = 'cod' | 'upi' | 'card';

function formatCardNumber(value: string) {
  return value.replace(/\D/g, '').slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function CheckoutScreen({ navigation }: Props) {
  const { token, user } = useAuth();
  const addr = (user?.address || {}) as Record<string, string>;
  const [line1, setLine1] = useState(addr.line1 || '');
  const [line2, setLine2] = useState(addr.line2 || '');
  const [city, setCity] = useState(addr.city || '');
  const [state, setState] = useState(addr.state || '');
  const [country, setCountry] = useState(addr.country || 'India');
  const [pincode, setPincode] = useState(addr.pincode || '');
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('cod');
  const [upiId, setUpiId] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState<any>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [awaitingUpi, setAwaitingUpi] = useState<{ orderId: string; detail?: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await api.pendingPayment(token);
        const pending = data?.pending || data?.order;
        if (cancelled || !pending?._id) return;
        if (pending.paymentMethod === 'upi' && pending.paymentStatus === 'pending') {
          setAwaitingUpi({
            orderId: pending._id,
            detail: pending.paymentDetail || data?.payment?.detail,
          });
          startUpiPoll(pending._id);
        } else {
          Alert.alert(
            'Payment in progress',
            'You already have a pending payment. Finish or cancel it from Orders.',
          );
        }
      } catch {
        /* no pending payment */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  function goOrders() {
    navigation.popToTop();
    navigation.getParent()?.navigate('OrdersTab');
  }

  async function applyCoupon() {
    if (!token || !couponCode.trim()) return;
    setCouponBusy(true);
    try {
      const cart = await api.getCart(token);
      const subtotal = Number(cart.total || 0);
      const data = await api.validateCoupon(couponCode.trim(), subtotal, token);
      setCouponDiscount({
        code: data.coupon?.code || couponCode.trim().toUpperCase(),
        discount: data.discount,
        total: data.total,
        ...data.coupon,
      });
      Alert.alert(
        'Coupon applied',
        data.discount != null
          ? `Saved ${formatPrice(data.discount)}. New total ${formatPrice(data.total)}.`
          : data.msg || 'Discount ready.',
      );
    } catch (err: any) {
      setCouponDiscount(null);
      Alert.alert('Invalid coupon', err?.message || 'Try another code');
    } finally {
      setCouponBusy(false);
    }
  }

  function startUpiPoll(orderId: string) {
    if (!token) return;
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.paymentStatus(orderId, token);
        const status = data?.order?.paymentStatus || data?.payment?.status;
        if (status === 'paid') {
          if (pollRef.current) clearInterval(pollRef.current);
          setAwaitingUpi(null);
          Alert.alert('Payment received', 'Your UPI payment was confirmed.', [
            { text: 'OK', onPress: goOrders },
          ]);
        } else if (status === 'failed') {
          if (pollRef.current) clearInterval(pollRef.current);
          setAwaitingUpi(null);
          Alert.alert('Payment failed', 'UPI request expired or failed. Try again from cart.');
        }
      } catch {
        /* keep polling */
      }
    }, 2500);
  }

  async function placeOrder() {
    if (!token) {
      Alert.alert('Sign in required');
      return;
    }
    if (!line1.trim() || !city.trim() || !state.trim() || !country.trim() || !/^\d{6}$/.test(pincode.trim())) {
      Alert.alert(
        'Missing fields',
        'Enter line 1, city, state, country, and a 6-digit pincode.',
      );
      return;
    }
    if (paymentMethod === 'upi' && !upiId.trim()) {
      Alert.alert('UPI required', 'Enter a UPI ID like name@upi');
      return;
    }
    if (paymentMethod === 'card') {
      const digits = cardNumber.replace(/\s+/g, '');
      if (!/^\d{13,19}$/.test(digits)) {
        Alert.alert('Card number', 'Enter a valid card number (13–19 digits).');
        return;
      }
      if (!cardName.trim()) {
        Alert.alert('Card name', 'Enter the name on the card.');
        return;
      }
      if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry.trim())) {
        Alert.alert('Expiry', 'Enter expiry as MM/YY.');
        return;
      }
      if (!/^\d{3}$/.test(cardCvv.trim())) {
        Alert.alert('CVV', 'Enter a 3-digit CVV.');
        return;
      }
    }

    setBusy(true);
    try {
      const paymentPayload =
        paymentMethod === 'upi'
          ? { upiId: upiId.trim() }
          : paymentMethod === 'card'
            ? {
                cardNumber: cardNumber.replace(/\s+/g, ''),
                cardName: cardName.trim(),
                cardExpiry: cardExpiry.trim(),
                cardCvv: cardCvv.trim(),
              }
            : {};

      const data = await api.checkout(
        {
          shippingAddress: {
            line1: line1.trim(),
            line2: line2.trim(),
            city: city.trim(),
            state: state.trim(),
            country: country.trim(),
            pincode: pincode.trim(),
          },
          paymentMethod,
          payment: paymentPayload,
          couponCode: couponDiscount?.code || couponCode.trim() || undefined,
        },
        token,
      );

      if (data.action === 'awaiting_upi' && data.order?._id) {
        setAwaitingUpi({
          orderId: data.order._id,
          detail: data.payment?.detail || data.order.paymentDetail,
        });
        startUpiPoll(data.order._id);
        return;
      }

      if (data.action === 'razorpay' && data.order?._id) {
        // Without a native Razorpay SDK, only auto-confirm in demo mode.
        const cfg = await api.paymentConfig(token).catch(() => null);
        const demo = cfg?.demo || cfg?.payment?.demo || cfg?.mode === 'demo';
        if (!demo) {
          Alert.alert(
            'Card payments',
            'Live Razorpay checkout is not embedded in this mobile build yet. Use COD or UPI, or pay on the website.',
          );
          return;
        }
        try {
          await api.confirmPayment(
            data.order._id,
            {
              razorpay_order_id: data.razorpay?.orderId || `order_${data.order._id}`,
              razorpay_payment_id: `pay_demo_${Date.now()}`,
              razorpay_signature: 'demo',
            },
            token,
          );
        } catch (err: any) {
          Alert.alert('Payment confirmation', err?.message || 'Could not confirm card payment');
          return;
        }
      }

      const orderId = data?.order?._id || data?._id;
      Alert.alert(
        'Order placed',
        orderId
          ? `Order #${String(orderId).slice(-6).toUpperCase()} · ${String(paymentMethod).toUpperCase()}`
          : data?.msg || 'Order placed.',
        [{ text: 'OK', onPress: goOrders }],
      );
    } catch (err: any) {
      Alert.alert('Checkout failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  if (awaitingUpi) {
    return (
      <Screen title="Approve UPI" subtitle="Waiting for payment confirmation…">
        <View style={ui.card}>
          <Text style={ui.label}>Collect request sent</Text>
          {awaitingUpi.detail ? <Text style={ui.muted}>{awaitingUpi.detail}</Text> : null}
          <Text style={ui.muted}>Approve in your UPI app. This screen polls automatically.</Text>
        </View>
        <Pressable
          style={ui.buttonSecondary}
          onPress={async () => {
            if (!token) return;
            try {
              const data = await api.paymentStatus(awaitingUpi.orderId, token);
              const status = data?.order?.paymentStatus;
              if (status === 'paid') {
                if (pollRef.current) clearInterval(pollRef.current);
                setAwaitingUpi(null);
                Alert.alert('Paid', 'Payment confirmed.', [{ text: 'OK', onPress: goOrders }]);
              } else {
                Alert.alert('Still pending', `Status: ${status || 'pending'}`);
              }
            } catch (err: any) {
              Alert.alert('Status check failed', err?.message || 'Try again');
            }
          }}
        >
          <Text style={ui.buttonSecondaryText}>Check status now</Text>
        </Pressable>
        <Pressable
          style={ui.buttonDanger}
          onPress={async () => {
            if (!token) return;
            try {
              await api.cancelPayment(awaitingUpi.orderId, token);
              if (pollRef.current) clearInterval(pollRef.current);
              setAwaitingUpi(null);
              Alert.alert('Cancelled', 'Payment cancelled. Cart items remain.');
            } catch (err: any) {
              Alert.alert('Cancel failed', err?.message || 'Try again');
            }
          }}
        >
          <Text style={ui.buttonText}>Cancel payment</Text>
        </Pressable>
      </Screen>
    );
  }

  return (
    <Screen title="Checkout" subtitle="Shipping and payment.">
      {(
        [
          ['Address line 1', line1, setLine1],
          ['Address line 2 (optional)', line2, setLine2],
          ['City', city, setCity],
          ['State', state, setState],
          ['Country', country, setCountry],
          ['Pincode (6 digits)', pincode, setPincode],
        ] as const
      ).map(([label, value, setter]) => (
        <View key={label} style={styles.field}>
          <Text style={ui.label}>{label}</Text>
          <TextInput
            style={ui.input}
            value={value}
            onChangeText={setter}
            placeholder={label}
            placeholderTextColor={colors.muted}
            keyboardType={label.startsWith('Pincode') ? 'number-pad' : 'default'}
            maxLength={label.startsWith('Pincode') ? 6 : undefined}
          />
        </View>
      ))}

      <Text style={ui.label}>Payment method</Text>
      <View style={ui.chipRow}>
        {(['cod', 'upi', 'card'] as PayMethod[]).map((m) => {
          const active = paymentMethod === m;
          return (
            <Pressable
              key={m}
              style={[ui.chip, active && ui.chipActive]}
              onPress={() => setPaymentMethod(m)}
            >
              <Text style={[ui.chipText, active && ui.chipTextActive]}>
                {m === 'cod' ? 'COD' : m.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {paymentMethod === 'upi' ? (
        <View style={styles.field}>
          <Text style={ui.label}>UPI ID</Text>
          <TextInput
            style={ui.input}
            value={upiId}
            onChangeText={setUpiId}
            placeholder="name@upi"
            autoCapitalize="none"
          />
        </View>
      ) : null}

      {paymentMethod === 'card' ? (
        <>
          <View style={styles.field}>
            <Text style={ui.label}>Card number</Text>
            <TextInput
              style={ui.input}
              value={cardNumber}
              onChangeText={(v) => setCardNumber(formatCardNumber(v))}
              placeholder="4111 1111 1111 1111"
              keyboardType="number-pad"
              maxLength={23}
            />
          </View>
          <View style={styles.field}>
            <Text style={ui.label}>Name on card</Text>
            <TextInput style={ui.input} value={cardName} onChangeText={setCardName} />
          </View>
          <View style={styles.row}>
            <View style={[styles.field, styles.flex]}>
              <Text style={ui.label}>Expiry</Text>
              <TextInput
                style={ui.input}
                value={cardExpiry}
                onChangeText={(v) => setCardExpiry(formatExpiry(v))}
                placeholder="MM/YY"
                keyboardType="number-pad"
                maxLength={5}
              />
            </View>
            <View style={[styles.field, styles.flex]}>
              <Text style={ui.label}>CVV</Text>
              <TextInput
                style={ui.input}
                value={cardCvv}
                onChangeText={(v) => setCardCvv(v.replace(/\D/g, '').slice(0, 3))}
                placeholder="123"
                keyboardType="number-pad"
                maxLength={3}
                secureTextEntry
              />
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.field}>
        <Text style={ui.label}>Coupon code</Text>
        <View style={styles.row}>
          <TextInput
            style={[ui.input, styles.flex]}
            value={couponCode}
            onChangeText={setCouponCode}
            autoCapitalize="characters"
            placeholder="Optional"
          />
          <Pressable
            style={[ui.buttonSecondary, styles.couponBtn, couponBusy && styles.disabled]}
            onPress={applyCoupon}
            disabled={couponBusy}
          >
            <Text style={ui.buttonSecondaryText}>{couponBusy ? '…' : 'Apply'}</Text>
          </Pressable>
        </View>
        {couponDiscount ? (
          <Text style={styles.couponOk}>
            Applied {couponDiscount.code || couponCode}
            {couponDiscount.discount != null
              ? ` (−${formatPrice(couponDiscount.discount)})`
              : ''}
          </Text>
        ) : null}
      </View>

      <Pressable style={[ui.button, busy && styles.disabled]} onPress={placeOrder} disabled={busy}>
        <Text style={ui.buttonText}>
          {busy
            ? 'Placing…'
            : paymentMethod === 'cod'
              ? 'Place COD order'
              : `Pay with ${paymentMethod.toUpperCase()}`}
        </Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  couponBtn: { paddingHorizontal: 16, justifyContent: 'center' },
  couponOk: { color: colors.accent, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
