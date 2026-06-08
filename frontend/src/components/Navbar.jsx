import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const { user, isAuthenticated, logout, loading } = useAuth();

  useEffect(() => {
    const q = searchParams.get('q');
    if (q && location.pathname === '/search') {
      setSearchQuery(q);
    }
  }, [searchParams, location.pathname]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const displayName = user ? (user.nickname || user.username) : '';

  function isActive(path) {
    if (path === '/') {
      return location.pathname === '/';
    }
    if (path === '/create') {
      return location.pathname.startsWith('/create') || location.pathname.startsWith('/edit');
    }
    if (path === '/search') {
      return location.pathname.startsWith('/search');
    }
    return location.pathname.startsWith(path);
  }

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          博客系统
        </Link>
        <div className="nav-search">
          <form onSubmit={handleSubmit} className="search-form">
            <input
              type="text"
              name="search"
              className="search-input"
              placeholder="搜索文章..."
              value={searchQuery}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />
            <button type="submit" className="search-btn">
              搜索
            </button>
          </form>
        </div>
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
          {isAuthenticated ? (
            <div className="nav-user">
              <span className="nav-username">{displayName}</span>
              <button
                className="nav-link nav-link-logout"
                onClick={handleLogout}
                disabled={loading}
              >
                {loading ? '退出中...' : '退出'}
              </button>
            </div>
          ) : (
            <>
              <Link
                to="/login"
                className={`nav-link ${isActive('/login') ? 'active' : ''}`}
              >
                登录
              </Link>
              <Link
                to="/register"
                className={`nav-link nav-link-btn ${isActive('/register') ? 'active' : ''}`}
              >
                注册
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
