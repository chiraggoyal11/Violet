import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const CATEGORIES = ['Home', 'Fashion', 'Art', 'Food', 'Other'];
const COLOURS = [
  'Black',
  'White',
  'Red',
  'Blue',
  'Green',
  'Yellow',
  'Pink',
  'Purple',
  'Brown',
  'Beige',
  'Grey',
  'Multicolor',
  'Other',
];

export default function SellPage() {
  const { user, token, booting } = useAuth();
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Other');
  const [colour, setColour] = useState('Other');
  const [stock, setStock] = useState(1);
  const [imageFiles, setImageFiles] = useState([]);
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
        category,
        colour,
        stock,
        imageFiles,
      });
      if (!data.success) throw new Error(data.msg || 'Could not add product');
      setOk('Product listed. It will appear on Home.');
      setName('');
      setDetail('');
      setPrice('');
      setCategory('Other');
      setColour('Other');
      setStock(1);
      setImageFiles([]);
      e.target.reset?.();
    } catch (err) {
      setError(err.message || 'Could not add product');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-layout form-layout-wide form-layout-fit">
      <div className="panel wide">
        <h1>List a product</h1>
        <p className="lede">Add a listing as {user.username}. Photos upload after you publish.</p>
        <form className="form" onSubmit={onSubmit}>
          <div className="form-field">
            <label htmlFor="name">Product name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-field">
            <label htmlFor="detail">Details</label>
            <textarea
              id="detail"
              rows={2}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              required
            />
          </div>
          <div className="form-grid">
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
              <label htmlFor="stock">Stock</label>
              <input
                id="stock"
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
              />
            </div>
            <div className="form-field">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="colour">Colour</label>
              <select
                id="colour"
                value={colour}
                onChange={(e) => setColour(e.target.value)}
              >
                {COLOURS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="image">Photos (optional, up to 8)</label>
            <input
              id="image"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setImageFiles(Array.from(e.target.files || []).slice(0, 8))}
            />
            {imageFiles.length ? (
              <p className="muted-link">{imageFiles.length} photo(s) selected</p>
            ) : null}
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
