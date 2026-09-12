import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
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
import { openAuth } from '../navigation/ref';
import { colors, spacing } from '../theme';
import { ui } from '../ui';
import type { ShopStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<ShopStackParamList, 'ProductDetail'>;

export default function ProductDetailScreen({ route, navigation }: Props) {
  const { token, user } = useAuth();
  const { id } = route.params;
  const [product, setProduct] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [rating, setRating] = useState('5');
  const [comment, setComment] = useState('');
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageBody, setMessageBody] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');

  async function load() {
    setError('');
    try {
      const [data, rev] = await Promise.all([
        api.getProduct(id),
        api.listReviews(id).catch(() => ({ reviews: [] })),
      ]);
      setProduct(data.product);
      setSeller(data.seller || null);
      setReviews(rev.reviews || []);
      if (token) {
        const st = await api.favoriteStatus(id, token).catch(() => null);
        setFavorited(Boolean(st?.favorited));
      }
    } catch (err: any) {
      setError(err?.message || 'Could not load product');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  function needAuth() {
    Alert.alert('Sign in required', 'Log in to use this feature.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign in', onPress: () => openAuth() },
    ]);
  }

  async function addToCart() {
    if (!token) return needAuth();
    setBusy(true);
    try {
      await api.addCartItem(id, 1, token);
      Alert.alert('Added', 'Item added to cart.', [
        { text: 'Keep shopping', style: 'cancel' },
        { text: 'View cart', onPress: () => navigation.getParent()?.navigate('CartTab') },
      ]);
    } catch (err: any) {
      Alert.alert('Could not add', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite() {
    if (!token) return needAuth();
    setBusy(true);
    try {
      await api.toggleFavorite(id, token);
      setFavorited((v) => !v);
    } catch (err: any) {
      Alert.alert('Favorite failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function addWishlist() {
    if (!token) return needAuth();
    setBusy(true);
    try {
      await api.addWishlistItem(id, token);
      Alert.alert('Wishlist', 'Added to wishlist.');
    } catch (err: any) {
      Alert.alert('Wishlist failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function submitReview() {
    if (!token) return needAuth();
    setBusy(true);
    try {
      await api.saveReview(id, { rating: Number(rating), comment: comment.trim() }, token);
      setComment('');
      await load();
      Alert.alert('Saved', 'Review saved.');
    } catch (err: any) {
      Alert.alert('Review failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!token) return needAuth();
    const recipient = product?.user_id || seller?._id;
    if (!recipient || !messageBody.trim()) return;
    setBusy(true);
    try {
      const data = await api.sendMessage(
        { recipient_id: String(recipient), body: messageBody.trim(), product_id: id },
        token,
      );
      setMessageOpen(false);
      setMessageBody('');
      const conversationId = data?.conversation?._id;
      if (conversationId) {
        navigation.getParent()?.navigate('AccountTab', {
          screen: 'Thread',
          params: {
            conversationId,
            title: seller?.username || 'Seller',
          },
        });
      } else {
        Alert.alert('Sent', 'Open Messages from Account to continue the chat.');
      }
    } catch (err: any) {
      Alert.alert('Message failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function submitOffer() {
    if (!token) return needAuth();
    setBusy(true);
    try {
      await api.createOffer(
        {
          product_id: id,
          amount: Number(offerAmount),
          message: offerMessage.trim(),
        },
        token,
      );
      setOfferOpen(false);
      setOfferAmount('');
      setOfferMessage('');
      Alert.alert('Offer sent', 'The seller will be notified.');
    } catch (err: any) {
      Alert.alert('Offer failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  async function submitReport() {
    if (!token) return needAuth();
    setBusy(true);
    try {
      await api.reportTarget(
        { targetType: 'product', targetId: id, reason: reportReason.trim() },
        token,
      );
      setReportOpen(false);
      setReportReason('');
      Alert.alert('Reported', 'Thanks for helping keep Violet safe.');
    } catch (err: any) {
      Alert.alert('Report failed', err?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  }

  const image =
    product?.ImageUrls?.[0] || product?.ImageUrl || product?.Images?.[0];
  const sold = product?.status === 'sold' || Number(product?.stock) === 0;
  const sellerUsername = seller?.username || product?.sellerUsername;

  return (
    <Screen loading={loading} title={product?.Product_Name || 'Product'}>
      {error ? <Text style={ui.error}>{error}</Text> : null}
      {product ? (
        <>
          <View style={styles.hero}>
            {image ? (
              <Image source={{ uri: image }} style={styles.image} />
            ) : (
              <Text style={styles.placeholder}>{product.Product_Name?.slice(0, 1)}</Text>
            )}
          </View>
          <Text style={styles.category}>{product.category || 'Other'}</Text>
          <Text style={styles.price}>{formatPrice(product.Price)}</Text>
          <Text style={styles.detail}>{product.Product_Detail}</Text>
          {sellerUsername ? (
            <Pressable
              onPress={() => navigation.navigate('PublicShop', { username: sellerUsername })}
            >
              <Text style={styles.seller}>Sold by {seller?.shopName || sellerUsername} →</Text>
            </Pressable>
          ) : null}
          <Text style={ui.muted}>
            {sold ? 'Sold out' : `${product.stock} in stock`}
          </Text>

          <Pressable
            style={[ui.button, (busy || sold) && styles.disabled]}
            onPress={addToCart}
            disabled={busy || sold}
          >
            <Text style={ui.buttonText}>{busy ? 'Working…' : 'Add to cart'}</Text>
          </Pressable>

          <View style={styles.actions}>
            <Pressable
              style={[ui.buttonSecondary, styles.actionBtn]}
              onPress={toggleFavorite}
              disabled={busy}
            >
              <Text style={ui.buttonSecondaryText}>{favorited ? 'Unfavorite' : 'Favorite'}</Text>
            </Pressable>
            <Pressable
              style={[ui.buttonSecondary, styles.actionBtn]}
              onPress={addWishlist}
              disabled={busy}
            >
              <Text style={ui.buttonSecondaryText}>Wishlist</Text>
            </Pressable>
            <Pressable
              style={[ui.buttonSecondary, styles.actionBtn]}
              onPress={() => setMessageOpen(true)}
              disabled={busy}
            >
              <Text style={ui.buttonSecondaryText}>Message</Text>
            </Pressable>
            <Pressable
              style={[ui.buttonSecondary, styles.actionBtn]}
              onPress={() => setOfferOpen(true)}
              disabled={busy}
            >
              <Text style={ui.buttonSecondaryText}>Offer</Text>
            </Pressable>
            <Pressable
              style={[ui.buttonSecondary, styles.actionBtn]}
              onPress={() => setReportOpen(true)}
              disabled={busy}
            >
              <Text style={ui.buttonSecondaryText}>Report</Text>
            </Pressable>
          </View>

          <Text style={styles.section}>Reviews</Text>
          {!reviews.length ? <Text style={ui.muted}>No reviews yet.</Text> : null}
          {reviews.map((r) => (
            <View key={r._id} style={ui.card}>
              <Text style={ui.label}>{r.rating}★ · {r.username || 'Buyer'}</Text>
              {r.comment ? <Text style={ui.muted}>{r.comment}</Text> : null}
            </View>
          ))}
          {token && user ? (
            <View style={ui.card}>
              <Text style={ui.label}>Write a review</Text>
              <TextInput
                style={ui.input}
                value={rating}
                onChangeText={setRating}
                keyboardType="number-pad"
                placeholder="Rating 1-5"
                maxLength={1}
              />
              <TextInput
                style={ui.input}
                value={comment}
                onChangeText={setComment}
                placeholder="Comment"
              />
              <Pressable style={ui.button} onPress={submitReview} disabled={busy}>
                <Text style={ui.buttonText}>Save review</Text>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}

      <Modal visible={offerOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={ui.label}>Make an offer</Text>
            <TextInput
              style={ui.input}
              value={offerAmount}
              onChangeText={setOfferAmount}
              placeholder="Amount"
              keyboardType="decimal-pad"
            />
            <TextInput
              style={ui.input}
              value={offerMessage}
              onChangeText={setOfferMessage}
              placeholder="Message (optional)"
            />
            <Pressable style={ui.button} onPress={submitOffer} disabled={busy}>
              <Text style={ui.buttonText}>Send offer</Text>
            </Pressable>
            <Pressable onPress={() => setOfferOpen(false)}>
              <Text style={ui.link}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={messageOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={ui.label}>Message seller</Text>
            <TextInput
              style={[ui.input, styles.multiline]}
              value={messageBody}
              onChangeText={setMessageBody}
              placeholder="Say hello…"
              multiline
            />
            <Pressable style={ui.button} onPress={sendMessage} disabled={busy}>
              <Text style={ui.buttonText}>Send</Text>
            </Pressable>
            <Pressable onPress={() => setMessageOpen(false)}>
              <Text style={ui.link}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={reportOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={ui.label}>Report listing</Text>
            <TextInput
              style={[ui.input, styles.multiline]}
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="Reason"
              multiline
            />
            <Pressable style={ui.buttonDanger} onPress={submitReport} disabled={busy}>
              <Text style={ui.buttonText}>Submit report</Text>
            </Pressable>
            <Pressable onPress={() => setReportOpen(false)}>
              <Text style={ui.link}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    aspectRatio: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: 'rgba(61,42,79,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { fontSize: 48, fontWeight: '800', color: colors.brand },
  category: {
    textTransform: 'uppercase',
    fontWeight: '700',
    color: colors.muted,
    fontSize: 12,
  },
  price: { fontSize: 24, fontWeight: '800', color: colors.accent },
  detail: { color: colors.inkSoft, fontSize: 16, lineHeight: 22 },
  seller: { color: colors.brand, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 100,
  },
  section: { fontSize: 18, fontWeight: '800', color: colors.brand, marginTop: spacing.sm },
  disabled: { opacity: 0.55 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(27,23,32,0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surfaceStrong,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
});
