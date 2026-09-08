import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function AdminPage() {
  const { user, token, booting } = useAuth();
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [userQuery, setUserQuery] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [ov, us, rp] = await Promise.all([
        api.listAdminOverview(token),
        api.listAdminUsers(userQuery, token),
        api.listAdminReports(token),
      ]);
      setOverview(ov.overview || null);
      setUsers(us.users || []);
      setReports(rp.reports || []);
    } catch (err) {
      setError(err.message || 'Admin load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token || user?.role !== 'admin') return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user?.role]);

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') {
    return (
      <section className="section">
        <p className="status error">Admin access required.</p>
        <Link className="btn btn-secondary" to="/catalog">
          Back to shop
        </Link>
      </section>
    );
  }

  async function searchUsers(e) {
    e.preventDefault();
    setBusyId('search');
    setError('');
    try {
      const data = await api.listAdminUsers(userQuery, token);
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  async function toggleSuspend(u) {
    setBusyId(u._id);
    setError('');
    setOk('');
    try {
      const data = await api.patchAdminUser(u._id, { suspended: !u.suspended }, token);
      setUsers((prev) =>
        prev.map((row) => (row._id === u._id ? { ...row, ...data.user } : row)),
      );
      setOk(`${data.user.username} ${data.user.suspended ? 'suspended' : 'unsuspended'}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  async function resolveReport(report, status) {
    setBusyId(report._id);
    setError('');
    setOk('');
    try {
      const data = await api.patchAdminReport(report._id, { status }, token);
      setReports((prev) =>
        prev.map((r) => (r._id === report._id ? data.report : r)),
      );
      setOk(`Report marked ${status}.`);
      const ov = await api.listAdminOverview(token);
      setOverview(ov.overview || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="section">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Moderation</p>
          <h2>Admin</h2>
          <p>Overview, users, and open reports.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          Refresh
        </button>
      </div>

      {error ? <p className="status error">{error}</p> : null}
      {ok ? <p className="status ok">{ok}</p> : null}
      {loading ? <p className="empty">Loading admin data…</p> : null}

      {overview ? (
        <div className="admin-cards">
          <article className="admin-card">
            <span>Users</span>
            <strong>{overview.users}</strong>
          </article>
          <article className="admin-card">
            <span>Products</span>
            <strong>{overview.products}</strong>
          </article>
          <article className="admin-card">
            <span>Orders</span>
            <strong>{overview.orders}</strong>
          </article>
          <article className="admin-card">
            <span>Open reports</span>
            <strong>{overview.openReports}</strong>
          </article>
          <article className="admin-card">
            <span>Active coupons</span>
            <strong>{overview.coupons}</strong>
          </article>
        </div>
      ) : null}

      <div className="admin-panels">
        <div className="panel wide">
          <h3>Users</h3>
          <form className="admin-search" onSubmit={searchUsers}>
            <input
              type="search"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Search username, email, phone"
              aria-label="Search users"
            />
            <button className="btn btn-secondary" type="submit" disabled={busyId === 'search'}>
              Search
            </button>
          </form>
          <ul className="admin-list">
            {users.map((u) => (
              <li key={u._id}>
                <div>
                  <strong>{u.username}</strong>
                  <span className="muted-link">
                    {u.email || u.phone_no || '—'} · {u.role}
                    {u.suspended ? ' · suspended' : ''}
                    {u.isGuest ? ' · guest' : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-compact"
                  disabled={busyId === u._id || u.role === 'admin'}
                  onClick={() => toggleSuspend(u)}
                >
                  {u.suspended ? 'Unsuspend' : 'Suspend'}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel wide">
          <h3>Reports</h3>
          {reports.length === 0 ? <p className="empty">No reports.</p> : null}
          <ul className="admin-list">
            {reports.map((r) => (
              <li key={r._id}>
                <div>
                  <strong>
                    {r.targetType} · {String(r.targetId).slice(-8)}
                  </strong>
                  <span className="muted-link">
                    {r.status} · {r.reason}
                  </span>
                </div>
                {r.status === 'open' ? (
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-compact"
                      disabled={busyId === r._id}
                      onClick={() => resolveReport(r, 'resolved')}
                    >
                      Resolve
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-compact"
                      disabled={busyId === r._id}
                      onClick={() => resolveReport(r, 'dismissed')}
                    >
                      Dismiss
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
