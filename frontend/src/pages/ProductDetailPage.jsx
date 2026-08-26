import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { formatPrice } from '../components/ProductCard';

export default function ProductDetailPage() {
  const { id } = useParams();
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [average, setAverage] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [detail, rev] = await Promise.all([
        api.getProduct(id),
        api.listReviews(id),
      ]);
      setProduct(detail.product);
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
          Back to catalog
        </Link>
      </section>
    );
  }

  const sold = product.status === 'sold' || Number(product.stock) === 0;
  const isOwner = user && String(user._id) === String(product.user_id);

  return (
    <section className="section detail-section">
      <Link className="muted-link" to="/catalog">
        ← Back to catalog
      </Link>
      <div className="detail-layout">
        <div className="detail-media">
          {product.ImageUrl ? (
            <img src={product.ImageUrl} alt={product.Product_Name} />
          ) : (
            <div className="product-fallback large">{product.Product_Name}</div>
          )}
          {sold ? <span className="badge sold">Sold</span> : null}
        </div>
        <div className="detail-copy">
          <p className="eyebrow">
            {product.category || 'Other'}
            {average ? ` · ★ ${average}` : ''}
          </p>
          <h1>{product.Product_Name}</h1>
          <p className="detail-price">{formatPrice(product.Price)}</p>
          <p>{product.Product_Detail}</p>
          <p className="muted-link">Stock: {product.stock ?? 1}</p>
          {error ? <p className="status error">{error}</p> : null}
          {ok ? <p className="status ok">{ok}</p> : null}
          <div className="form-actions">
            {!sold && !isOwner ? (
              <button className="btn btn-accent" type="button" disabled={busy} onClick={addCart}>
                Add to cart
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
