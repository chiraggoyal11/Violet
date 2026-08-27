import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function MessagesPage() {
  const { id } = useParams();
  const { user, token, booting } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadInbox() {
    const data = await api.listConversations(token);
    setConversations(data.conversations || []);
  }

  async function loadThread(conversationId) {
    setLoading(true);
    setError('');
    try {
      const data = await api.getConversation(conversationId, token);
      setActive(data.conversation);
      setMessages(data.messages || []);
    } catch (err) {
      setError(err.message || 'Could not load conversation');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    loadInbox().catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || !id) {
      setActive(null);
      setMessages([]);
      setLoading(false);
      return;
    }
    loadThread(id);
  }, [id, token]);

  async function send(e) {
    e.preventDefault();
    if (!body.trim() || !active) return;
    setBusy(true);
    setError('');
    try {
      const data = await api.sendMessage(
        { recipient_id: active.otherUser?._id, body: body.trim(), product_id: active.product_id },
        token,
      );
      setBody('');
      if (data.conversation?._id && String(data.conversation._id) !== String(id)) {
        navigate(`/messages/${data.conversation._id}`);
      } else {
        setMessages((prev) => [...prev, data.message]);
        setActive(data.conversation);
      }
      await loadInbox();
    } catch (err) {
      setError(err.message || 'Could not send message');
    } finally {
      setBusy(false);
    }
  }

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <section className="section messages-layout">
      <div className="messages-sidebar panel">
        <h1>Messages</h1>
        {conversations.length === 0 ? (
          <p className="empty">No conversations yet. Message a seller from a product page.</p>
        ) : (
          <ul className="conversation-list">
            {conversations.map((c) => (
              <li key={c._id}>
                <Link
                  className={`conversation-item ${String(c._id) === String(id) ? 'active' : ''}`}
                  to={`/messages/${c._id}`}
                >
                  <strong>{c.otherUser?.username || 'User'}</strong>
                  {c.product_name ? <span className="muted-link">{c.product_name}</span> : null}
                  <p>{c.lastMessage}</p>
                  {c.unread ? <span className="badge sold">{c.unread} new</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="messages-thread panel">
        {!id ? (
          <p className="empty">Select a conversation or start one from a product page.</p>
        ) : loading ? (
          <p className="empty">Loading…</p>
        ) : (
          <>
            {active ? (
              <div className="thread-header">
                <h2>{active.otherUser?.username || 'Conversation'}</h2>
                {active.product_id ? (
                  <Link className="muted-link" to={`/product/${active.product_id}`}>
                    Re: {active.product_name}
                  </Link>
                ) : null}
              </div>
            ) : null}
            {error ? <p className="status error">{error}</p> : null}
            <ul className="message-list">
              {messages.map((m) => (
                <li
                  key={m._id}
                  className={String(m.sender_id) === String(user._id) ? 'mine' : 'theirs'}
                >
                  <p>{m.body}</p>
                </li>
              ))}
            </ul>
            {active ? (
              <form className="form message-compose" onSubmit={send}>
                <textarea
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write a message…"
                  required
                />
                <button className="btn btn-accent" type="submit" disabled={busy}>
                  {busy ? 'Sending…' : 'Send'}
                </button>
              </form>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
