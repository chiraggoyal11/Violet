import { NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext';

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      {children}
    </svg>
  );
}

const guestLinks = [
  {
    to: '/catalog',
    label: 'Catalog',
    icon: (
      <Icon>
        <path
          fill="currentColor"
          d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h10v2H4v-2Z"
        />
      </Icon>
    ),
  },
  {
    to: '/login',
    label: 'Sign in',
    icon: (
      <Icon>
        <path
          fill="currentColor"
          d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4 0-8 2-8 4v2h16v-2c0-2-4-4-8-4Z"
        />
      </Icon>
    ),
  },
  {
    to: '/register',
    label: 'Join',
    icon: (
      <Icon>
        <path fill="currentColor" d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" />
      </Icon>
    ),
  },
];

const userLinks = [
  {
    to: '/catalog',
    label: 'Catalog',
    icon: (
      <Icon>
        <path
          fill="currentColor"
          d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h10v2H4v-2Z"
        />
      </Icon>
    ),
  },
  {
    to: '/sell',
    label: 'Sell',
    icon: (
      <Icon>
        <path
          fill="currentColor"
          d="M12 2 3 7v2h18V7L12 2Zm-7 9v8h4v-6h6v6h4v-8H5Zm7 10v-4h2v4h-2Z"
        />
      </Icon>
    ),
  },
  {
    to: '/cart',
    label: 'Cart',
    icon: (
      <Icon>
        <path
          fill="currentColor"
          d="M7 18a2 2 0 1 0 2 2 2 2 0 0 0-2-2Zm10 0a2 2 0 1 0 2 2 2 2 0 0 0-2-2ZM7.2 14h9.7l1.8-8H6.2L5.4 3H2v2h2.2l2 9Zm1.1-2L7.5 8h9.1l-.9 4H8.3Z"
        />
      </Icon>
    ),
  },
  {
    to: '/orders',
    label: 'Orders',
    icon: (
      <Icon>
        <path
          fill="currentColor"
          d="M6 2h12v2H6V2Zm1 4h10l1 16H6L7 6Zm3 3v8h2V9h-2Zm4 0v8h2V9h-2Z"
        />
      </Icon>
    ),
  },
  {
    to: '/messages',
    label: 'Messages',
    icon: (
      <Icon>
        <path
          fill="currentColor"
          d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2Zm2 4v2h12V8H6Zm0 4v2h8v-2H6Z"
        />
      </Icon>
    ),
  },
];

export default function BottomNav() {
  const { user } = useAuth();
  const links = user ? userLinks : guestLinks;

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            `bottom-nav-link${isActive ? ' active' : ''}`
          }
        >
          <span className="bottom-nav-icon">{link.icon}</span>
          <span className="bottom-nav-label">{link.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
