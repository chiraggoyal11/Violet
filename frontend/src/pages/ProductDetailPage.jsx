import { useEffect, useId, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { formatPrice } from '../components/ProductCard';

const QUICK_PROMPTS = [
  'Is this still available?',
  'Can you ship to my city?',
  'Do you offer customization?',
];

export default function ProductDetailPage() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const dialogTitleId = useId();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [average, setAverage] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [showMessage, setShowMessage] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const gallery =
    product?.ImageUrls?.length > 0
      ? product.ImageUrls
      : product?.ImageUrl
        ? [product.ImageUrl]
        : [];

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [detail, rev] = await Promise.all([
        api.getProduct(id),
        api.listReviews(id),
      ]);
      setProduct(detail.product);
      setActiveImage(0);
      setReviews(rev.reviews || []);
      setAverage(rev.average || 0);
    } catch (err) {
      setError(err.message || 'Product not found');
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!showMessage) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setShowMessage(false);
    }
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [showMessage]);

  async function addCart() {
    if (!token) return navigate('/login');
    setBusy(true);
    setError('');
    setOk('');
    try {
      await api.addToCart(id, token, 1);
      setOk('Added to cart.');
    } catch (err) {
      setError(err.message || 'Could not add to cart');
    } finally {
      setBusy(false);
    }
  }

  async function toggleFavorite() {
    if (!token) return navigate('/login');
    setBusy(true);
    setError('');
    try {
      await api.addFavorite(id, token);
      setOk('Saved to favorites.');
    } catch (err) {
      setError(err.message || 'Could not favorite');
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.Product_Name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setOk('Link copied.');
      }
    } catch {
      /* user cancelled share */
    }
  }

  async function submitReview(e) {
    e.preventDefault();
    if (!token) return navigate('/login');
    setBusy(true);
    setError('');
    try {
      await api.saveReview(id, { rating: Number(rating), comment }, token);
      setComment('');
      await load();
      setOk('Review saved.');
    } catch (err) {
      setError(err.message || 'Could not save review');
    } finally {
      setBusy(false);
    }
  }

  function openMessageSeller() {
    if (!token) return navigate('/login');
    setShowMessage(true);
    setError('');
  }

  async function messageSeller(e) {
    e.preventDefault();
    if (!token) return navigate('/login');
    setBusy(true);
    setError('');
    try {
      const data = await api.sendMessage(
        {
          recipient_id: product.user_id,
          product_id: id,
          body: messageBody.trim(),
        },
        token,
      );
      setMessageBody('');
      setShowMessage(false);
      navigate(`/messages/${data.conversation._id}`);
    } catch (err) {
      setError(err.message || 'Could not send message');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="section">
        <div className="skeleton detail-skel" />
      </section>
    );
  }
  if (error && !product) {
    return (
      <section className="section">
        <p className="status error">{error}</p>
        <Link className="btn btn-secondary" to="/catalog">
          Back to Home
        </Link>
      </section>
    );
  }

  const sold = product.status === 'sold' || Number(product.stock) === 0;
  const isOwner = user && String(user._id) === String(product.user_id);
  const thumb = gallery[0] || null;

  return (
    <section className="section detail-section">
      <Link className="muted-link" to="/catalog">
        ← Back to Home
      </Link>
      <div className="detail-layout">
        <div className="detail-media">
          {gallery.length ? (
            <>
              <img src={gallery[activeImage]} alt={product.Product_Name} />
              {gallery.length > 1 ? (
                <div className="gallery-thumbs">
                  {gallery.map((url, i) => (
                    <button
                      key={url + i}
                      type="button"
                      className={i === activeImage ? 'active' : ''}
                      onClick={() => setActiveImage(i)}
                    >
                      <img src={url} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <div className="product-fallback large">{product.Product_Name}</div>
          )}
          {sold ? <span className="badge sold">Sold</span> : null}
        </div>
        <div className="detail-copy">
          <p className="eyebrow">
            {product.category || 'Other'}
            {product.colour && product.colour !== 'Other' ? ` · ${product.colour}` : ''}
            {average ? ` · ★ ${average}` : ''}
          </p>
          <h1>{product.Product_Name}</h1>
          <p className="detail-price">{formatPrice(product.Price)}</p>
          <p>{product.Product_Detail}</p>
          <p className="muted-link">Stock: {product.stock ?? 1}</p>
          {error && !showMessage ? <p className="status error">{error}</p> : null}
          {ok ? <p className="status ok">{ok}</p> : null}
          <div className="form-actions">
            {!sold && !isOwner ? (
              <button className="btn btn-accent" type="button" disabled={busy} onClick={addCart}>
                Add to cart
              </button>
            ) : null}
            {!isOwner ? (
              <button
                className="btn btn-secondary msg-seller-btn"
                type="button"
                disabled={busy}
                onClick={openMessageSeller}
              >
                <span className="msg-seller-icon" aria-hidden="true" />
                Message seller
              </button>
            ) : null}
            <button className="btn btn-secondary" type="button" disabled={busy} onClick={toggleFavorite}>
              Favorite
            </button>
            <button className="btn btn-secondary" type="button" onClick={share}>
              Share
            </button>
          </div>
        </div>
      </div>

      {showMessage && !isOwner ? (
        <div
          className="msg-modal-overlay"
          role="presentation"
          onClick={() => setShowMessage(false)}
        >
          <div
            className="msg-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="msg-modal-head">
              <div>
                <p className="eyebrow">Private chat</p>
                <h2 id={dialogTitleId}>Ask the maker</h2>
                <p className="msg-modal-lede">
                  Shipping, materials, customization — start a conversation about this piece.
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label="Close"
                onClick={() => setShowMessage(false)}
              >
                ×
              </button>
            </div>

            <div className="msg-modal-product">
              {thumb ? <img src={thumb} alt="" /> : <div className="msg-modal-fallback" />}
              <div>
                <strong>{product.Product_Name}</strong>
                <span>
                  {formatPrice(product.Price)}
                  {product.category ? ` · ${product.category}` : ''}
                </span>
              </div>
            </div>

            <div className="msg-quick-prompts" aria-label="Suggested messages">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className={`msg-chip${messageBody === prompt ? ' active' : ''}`}
                  onClick={() => setMessageBody(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form className="msg-modal-form" onSubmit={messageSeller}>
              <label className="visually-hidden" htmlFor="seller-message">
                Your message
              </label>
              <div className="msg-modal-compose">
                <textarea
                  id="seller-message"
                  rows={4}
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Ask about shipping, customization, or availability…"
                  required
                  autoFocus
                />
              </div>
              {error ? <p className="status error">{error}</p> : null}
              <div className="msg-modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowMessage(false)}
                >
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={busy || !messageBody.trim()}>
                  {busy ? 'Sending…' : 'Send & open chat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="reviews">
        <h2>Reviews</h2>
        {reviews.length === 0 ? <p className="empty">No reviews yet.</p> : null}
        <ul className="review-list">
          {reviews.map((r) => (
            <li key={r._id}>
              <strong>
                ★ {r.rating} · {r.username}
              </strong>
              <p>{r.comment || '—'}</p>
            </li>
          ))}
        </ul>
        {user && !isOwner ? (
          <form className="form panel" onSubmit={submitReview}>
            <h3>Leave a review</h3>
            <div className="form-field">
              <label htmlFor="rating">Rating</label>
              <select id="rating" value={rating} onChange={(e) => setRating(e.target.value)}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="comment">Comment</label>
              <textarea
                id="comment"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Save review
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
