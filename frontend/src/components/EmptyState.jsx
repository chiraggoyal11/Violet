import { Link } from 'react-router-dom';

export default function EmptyState({
  title,
  body,
  actionTo,
  actionLabel,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-mark" aria-hidden="true">
        <span />
        <span />
      </div>
      {title ? <strong>{title}</strong> : null}
      {body ? <p>{body}</p> : null}
      {actionTo && actionLabel ? (
        <Link className="btn btn-accent" to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
