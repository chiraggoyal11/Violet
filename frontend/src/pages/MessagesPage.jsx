import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || '?';
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate();
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMessageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function Avatar({ user, size = 'md' }) {
  const name = user?.username || 'User';
  return (
    <div className={`chat-avatar chat-avatar-${size}`} aria-hidden="true">
      {user?.avatar ? (
        <img src={user.avatar} alt="" />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}

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
  const [query, setQuery] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);

  async function loadInbox() {
    const data = await api.listConversations(token);
    setConversations(data.conversations || []);
  }

  async function loadThread(conversationId, { silent = false } = {}) {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const data = await api.getConversation(conversationId, token);
      setActive(data.conversation);
      setMessages(data.messages || []);
      await loadInbox();
    } catch (err) {
      if (!silent) setError(err.message || 'Could not load conversation');
    } finally {
      if (!silent) setLoading(false);
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
    const poll = setInterval(() => loadThread(id, { silent: true }), 8000);
    return () => clearInterval(poll);
  }, [id, token]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, id]);

  useEffect(() => {
    if (id && inputRef.current) inputRef.current.focus();
  }, [id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const hay = `${c.otherUser?.username || ''} ${c.product_name || ''} ${c.lastMessage || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [conversations, query]);

  async function send(e) {
    e.preventDefault();
    if (!body.trim() || !active) return;
    setBusy(true);
    setError('');
    const text = body.trim();
    setBody('');
    try {
      const data = await api.sendMessage(
        {
          recipient_id: active.otherUser?._id,
          body: text,
          product_id: active.product_id,
        },
        token,
      );
      if (data.conversation?._id && String(data.conversation._id) !== String(id)) {
        navigate(`/messages/${data.conversation._id}`);
      } else {
        setMessages((prev) => [...prev, data.message]);
        setActive(data.conversation);
      }
      await loadInbox();
    } catch (err) {
      setBody(text);
      setError(err.message || 'Could not send message');
    } finally {
      setBusy(false);
    }
  }

  function onComposerKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!busy && body.trim()) send(e);
    }
  }

  if (booting) return <p className="empty">Checking your session…</p>;
  if (!user) return <Navigate to="/login" replace />;

  const threadOpen = Boolean(id);

  return (
    <section className={`messages-app${threadOpen ? ' has-thread' : ''}`}>
      <aside className="messages-inbox" aria-label="Conversations">
        <div className="messages-inbox-head">
          <div>
            <h1>Messages</h1>
            <p>Chat with buyers and sellers about listings.</p>
          </div>
        </div>
        <div className="messages-search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
          />
        </div>
        {filtered.length === 0 ? (
          <div className="messages-empty">
            <strong>No chats yet</strong>
            <p>Open a product and tap Message seller to start a conversation.</p>
            <Link className="btn btn-secondary" to="/catalog">
              Browse Home
            </Link>
          </div>
        ) : (
          <ul className="conversation-list">
            {filtered.map((c) => {
              const activeItem = String(c._id) === String(id);
              return (
                <li key={c._id}>
                  <Link
                    className={`conversation-item${activeItem ? ' active' : ''}${c.unread ? ' unread' : ''}`}
                    to={`/messages/${c._id}`}
                  >
                    <Avatar user={c.otherUser} />
                    <div className="conversation-copy">
                      <div className="conversation-top">
                        <strong>{c.otherUser?.username || 'User'}</strong>
                        <time>{formatTime(c.lastMessageAt)}</time>
                      </div>
                      {c.product_name ? (
                        <span className="conversation-product">{c.product_name}</span>
                      ) : null}
                      <p>{c.lastMessage || 'No messages yet'}</p>
                    </div>
                    {c.unread ? <span className="unread-dot">{c.unread}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <div className="messages-thread" aria-live="polite">
        {!id ? (
          <div className="messages-empty thread-empty">
            <div className="thread-empty-mark" aria-hidden="true" />
            <strong>Your inbox</strong>
            <p>Pick a conversation or message a seller from any listing.</p>
          </div>
        ) : loading ? (
          <div className="messages-empty">
            <p>Loading conversation…</p>
          </div>
        ) : (
          <>
            <header className="thread-header">
              <button
                type="button"
                className="thread-back"
                aria-label="Back to inbox"
                onClick={() => navigate('/messages')}
              >
                ←
              </button>
              <Avatar user={active?.otherUser} />
              <div className="thread-header-copy">
                <h2>{active?.otherUser?.username || 'Conversation'}</h2>
                {active?.product_id ? (
                  <Link className="thread-product-chip" to={`/product/${active.product_id}`}>
                    About: {active.product_name || 'Listing'}
                  </Link>
                ) : (
                  <span className="muted-link">Direct chat</span>
                )}
              </div>
            </header>

            {error ? <p className="status error thread-error">{error}</p> : null}

            <div className="message-list" ref={listRef}>
              {messages.length === 0 ? (
                <div className="messages-empty inline-empty">
                  <p>Say hello — ask about shipping, fit, or customization.</p>
                </div>
              ) : (
                messages.map((m) => {
                  const mine = String(m.sender_id) === String(user._id);
                  return (
                    <div
                      key={m._id}
                      className={`message-bubble${mine ? ' mine' : ' theirs'}`}
                    >
                      <p>{m.body}</p>
                      <time>{formatMessageTime(m.createdAt || m._id)}</time>
                    </div>
                  );
                })
              )}
            </div>

            {active ? (
              <form className="message-composer" onSubmit={send}>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onKeyDown={onComposerKeyDown}
                  placeholder="Write a message…"
                  required
                />
                <button
                  className="btn btn-accent composer-send"
                  type="submit"
                  disabled={busy || !body.trim()}
                  aria-label="Send message"
                >
                  {busy ? '…' : 'Send'}
                </button>
              </form>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
