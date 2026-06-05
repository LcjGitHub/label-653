import { useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { debounce } from '../utils/debounce';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = useCallback(
    debounce((query) => {
      if (query.trim()) {
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }, 300),
    [navigate]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (value.trim().length >= 2) {
      handleSearch(value);
    }
  };

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
              className="search-input"
              placeholder="搜索文章..."
              value={searchQuery}
              onChange={handleInputChange}
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
        </div>
      </div>
    </nav>
  );
}
