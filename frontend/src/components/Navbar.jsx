import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();

  function isActive(path) {
    if (path === '/') {
      return location.pathname === '/';
    }
    if (path === '/create') {
      return location.pathname.startsWith('/create') || location.pathname.startsWith('/edit');
    }
    return location.pathname.startsWith(path);
  }

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          博客系统
        </Link>
        <div className="nav-links">
          <Link
            to="/"
            className={`nav-link ${isActive('/') ? 'active' : ''}`}
          >
            首页
          </Link>
          <Link
            to="/admin"
            className={`nav-link ${isActive('/admin') ? 'active' : ''}`}
          >
            管理
          </Link>
          <Link
            to="/create"
            className={`nav-link nav-link-btn ${isActive('/create') ? 'active' : ''}`}
          >
            写文章
          </Link>
        </div>
      </div>
    </nav>
  );
}
