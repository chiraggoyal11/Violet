import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function SellPage() {
  const { user, token, booting } = useAuth();
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [price, setPrice] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setOk('');
    try {
      const data = await api.addProduct({
        token,
        name: name.trim(),
        detail: detail.trim(),
        price: price.trim(),
        imageFile,
      });
      if (!data.success) throw new Error(data.msg || 'Could not add product');
      setOk('Product listed. It will appear in the catalog.');
      setName('');
      setDetail('');
      setPrice('');
      setImageFile(null);
      e.target.reset?.();
    } catch (err) {
      setError(err.message || 'Could not add product');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-layout">
      <div className="panel wide">
        <h1>List a product</h1>
        <p className="lede">
          Signed in as {user.username}. Product photos upload to S3-compatible
          storage (MinIO locally, or AWS S3 in production).
        </p>
        <form className="form" onSubmit={onSubmit}>
          <div className="form-field">
            <label htmlFor="name">Product name</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="detail">Details</label>
            <textarea
              id="detail"
              rows={4}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="price">Price</label>
            <input
              id="price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="19.99"
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="image">Product image (optional)</label>
            <input
              id="image"
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            />
          </div>
          {error ? <p className="status error">{error}</p> : null}
          {ok ? <p className="status ok">{ok}</p> : null}
          <div className="form-actions">
            <button className="btn btn-accent" type="submit" disabled={busy}>
              {busy ? 'Publishing…' : 'Publish listing'}
            </button>
            <Link className="btn btn-secondary" to="/mine">
              View my listings
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
