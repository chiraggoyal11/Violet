import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import ProductCard from '../components/ProductCard';

export default function MinePage() {
  const { user, token, booting } = useAuth();
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({
    Product_Name: '',
    Product_Detail: '',
    Price: '',
    category: 'Other',
    stock: 1,
  });

  async function loadProducts() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.listMyProducts(user._id);
      setProducts(data.product || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, [user]);

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  function startEdit(product) {
    setEditingId(product._id);
    setDraft({
      Product_Name: product.Product_Name || '',
      Product_Detail: product.Product_Detail || '',
      Price: product.Price || '',
      category: product.category || 'Other',
      stock: product.stock ?? 1,
    });
    setError('');
    setOk('');
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingId) return;
    setBusyId(editingId);
    setError('');
    setOk('');
    try {
      const data = await api.updateProduct(
        editingId,
        {
          Product_Name: draft.Product_Name.trim(),
          Product_Detail: draft.Product_Detail.trim(),
          Price: draft.Price.trim(),
          category: draft.category,
          stock: Number(draft.stock),
        },
        token,
      );
      setProducts((prev) =>
        prev.map((p) => (p._id === editingId ? { ...p, ...data.product } : p)),
      );
      setOk('Listing updated.');
      setEditingId(null);
    } catch (err) {
      setError(err.message || 'Update failed');
    } finally {
      setBusyId(null);
    }
  }

  async function markSold(id) {
    setBusyId(id);
    setError('');
    try {
      const data = await api.markSold(id, token);
      setProducts((prev) =>
        prev.map((p) => (p._id === id ? { ...p, ...data.product } : p)),
      );
      setOk('Marked as sold.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    setBusyId(id);
    setError('');
    setOk('');
    try {
      await api.deleteProducts([id], token);
      setProducts((prev) => prev.filter((p) => p._id !== id));
      if (editingId === id) setEditingId(null);
      setOk('Listing removed.');
    } catch (err) {
      setError(err.message || 'Delete failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <h2>My listings</h2>
          <p>Manage products you published as {user.username}.</p>
        </div>
        <div className="form-actions">
          <Link className="btn btn-primary" to="/sell">
            New listing
          </Link>
        </div>
      </div>

      {error ? <p className="status error">{error}</p> : null}
      {ok ? <p className="status ok">{ok}</p> : null}
      {loading ? <p className="empty">Loading your listings…</p> : null}
      {!loading && products.length === 0 ? (
        <p className="empty">You have not listed anything yet.</p>
      ) : null}

      <div className="product-grid">
        {products.map((product) => (
          <div key={product._id} className="listing-manage">
            <ProductCard product={product} />
            {editingId === product._id ? (
              <form className="form edit-form" onSubmit={saveEdit}>
                <div className="form-field">
                  <label>Name</label>
                  <input
                    value={draft.Product_Name}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, Product_Name: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Details</label>
                  <textarea
                    rows={3}
                    value={draft.Product_Detail}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, Product_Detail: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Price</label>
                  <input
                    value={draft.Price}
                    onChange={(e) => setDraft((d) => ({ ...d, Price: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Category</label>
                  <select
                    value={draft.category}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, category: e.target.value }))
                    }
                  >
                    {['Home', 'Fashion', 'Art', 'Food', 'Other'].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Stock</label>
                  <input
                    type="number"
                    min="0"
                    value={draft.stock}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, stock: e.target.value }))
                    }
                  />
                </div>
                <div className="form-actions">
                  <button className="btn btn-accent" type="submit" disabled={busyId === product._id}>
                    Save
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={() => startEdit(product)}>
                  Edit
                </button>
                {product.status !== 'sold' ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busyId === product._id}
                    onClick={() => markSold(product._id)}
                  >
                    Mark sold
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busyId === product._id}
                  onClick={() => remove(product._id)}
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
