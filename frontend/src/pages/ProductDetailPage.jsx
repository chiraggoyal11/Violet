import { useEffect, useId, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { formatPrice } from '../components/ProductCard';

const QUICK_PROMPTS = [
  'Is this still available?',
  'Can you ship to my city?',
  'Do you offer customization?',
];

function HeartIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        d="M12 20s-7-4.4-9.2-8.2C1.2 9 2.4 6.2 5.2 5.4c1.7-.5 3.4.2 4.4 1.5C10.6 5.6 12.3 4.9 14 5.4c2.8.8 4 3.6 2.4 6.4C19 15.6 12 20 12 20Z"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18 16a3 3 0 0 0-2.1.9l-7.1-3.6a3.1 3.1 0 0 0 0-1.6l7.1-3.6A3 3 0 1 0 15 5a3 3 0 0 0 .1.8L8 9.4a3 3 0 1 0 0 5.2l7.1 3.6A3 3 0 1 0 18 16Z"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2Z"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2Zm10 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2ZM7.2 14h9.7l1.8-8H6.2L5.4 3H2v2h2.2l2 9Zm1.1-2L7.5 8h9.1l-.9 4H8.3Z"
      />
    </svg>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const dialogTitleId = useId();
  const trackRef = useRef(null);
  const touchStartX = useRef(null);
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
  const [favorited, setFavorited] = useState(false);

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
    if (!token || !id) {
      setFavorited(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await api.favoriteStatus(id, token);
        if (!cancelled) setFavorited(Boolean(data.favorited));
      } catch {
        if (!cancelled) setFavorited(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, id]);

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

  function goImage(next) {
    if (!gallery.length) return;
    const len = gallery.length;
    setActiveImage(((next % len) + len) % len);
  }

  function onTouchStart(e) {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  }

  function onTouchEnd(e) {
    if (touchStartX.current == null || gallery.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    // swipe left -> next (images slide right-to-left), swipe right -> previous
    if (dx < 0) goImage(activeImage + 1);
    else goImage(activeImage - 1);
  }

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
    setOk('');
    try {
      if (favorited) {
        await api.removeFavorite(id, token);
        setFavorited(false);
        setOk('Removed from favorites.');
      } else {
        await api.addFavorite(id, token);
        setFavorited(true);
        setOk('Saved to favorites.');
      }
    } catch (err) {
      setError(err.message || 'Could not update favorites');
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
          Back to shop
        </Link>
      </section>
    );
  }

  const sold = product.status === 'sold' || Number(product.stock) === 0;
  const isOwner = user && String(user._id) === String(product.user_id);
  const thumb = gallery[0] || null;

  return (
    <section className="section product-detail">
      <Link className="muted-link product-detail-back" to="/catalog">
        ← Back to shop
      </Link>

      <header className="product-detail-top">
        <p className="eyebrow">
          {product.category || 'Other'}
          {product.colour && product.colour !== 'Other' ? ` · ${product.colour}` : ''}
          {average ? ` · ★ ${average}` : ''}
        </p>
        <h1>{product.Product_Name}</h1>
        <p className="detail-price">{formatPrice(product.Price)}</p>
      </header>

      <div
        className="product-slider"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {gallery.length ? (
          <>
            <div
              className="product-slider-track"
              ref={trackRef}
              style={{ transform: `translateX(-${activeImage * 100}%)` }}
            >
              {gallery.map((url, i) => (
                <div className="product-slider-slide" key={url + i}>
                  <img src={url} alt={`${product.Product_Name} ${i + 1}`} />
                </div>
              ))}
            </div>
            {sold ? <span className="badge sold">Sold</span> : null}
            {gallery.length > 1 ? (
              <>
                <button
                  type="button"
                  className="slider-nav prev"
                  aria-label="Previous image"
                  onClick={() => goImage(activeImage - 1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="slider-nav next"
                  aria-label="Next image"
                  onClick={() => goImage(activeImage + 1)}
                >
                  ›
                </button>
                <div className="slider-dots" role="tablist" aria-label="Product images">
                  {gallery.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      role="tab"
                      aria-selected={i === activeImage}
                      className={i === activeImage ? 'active' : ''}
                      onClick={() => setActiveImage(i)}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </>
        ) : (
          <div className="product-fallback large">{product.Product_Name}</div>
        )}
      </div>

      <div className="product-detail-body">
        <p className="product-detail-desc">{product.Product_Detail}</p>
        <p className="muted-link">Stock: {product.stock ?? 1}</p>
        {error && !showMessage ? <p className="status error">{error}</p> : null}
        {ok ? <p className="status ok">{ok}</p> : null}

        <div className="product-icon-row" aria-label="Save and share">
          <button
            type="button"
            className={`icon-action${favorited ? ' is-favorited' : ''}`}
            disabled={busy}
            onClick={toggleFavorite}
            aria-pressed={favorited}
            aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <HeartIcon filled={favorited} />
            <span>{favorited ? 'Saved' : 'Favorite'}</span>
          </button>
          <button
            type="button"
            className="icon-action"
            onClick={share}
            aria-label="Share product"
          >
            <ShareIcon />
            <span>Share</span>
          </button>
        </div>

        <div className="product-cta-row">
          {!isOwner ? (
            <button
              type="button"
              className="btn btn-secondary product-cta"
              disabled={busy}
              onClick={openMessageSeller}
            >
              <ChatIcon />
              Message seller
            </button>
          ) : null}
          {!sold && !isOwner ? (
            <button
              type="button"
              className="btn btn-accent product-cta"
              disabled={busy}
              onClick={addCart}
            >
              <CartIcon />
              Add to cart
            </button>
          ) : null}
          {isOwner ? (
            <Link className="btn btn-secondary product-cta" to="/mine">
              Manage listing
            </Link>
          ) : null}
          {sold && !isOwner ? (
            <p className="muted-link sold-note">This piece is sold out.</p>
          ) : null}
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
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={busy || !messageBody.trim()}
                >
                  {busy ? 'Sending…' : 'Send & open chat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="reviews product-detail-reviews">
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
