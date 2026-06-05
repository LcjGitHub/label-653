import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          博客系统
        </Link>
        <div className="nav-links">
          <Link to="/" className="nav-link">
            首页
          </Link>
          <Link to="/admin" className="nav-link">
            管理
          </Link>
          <Link to="/create" className="nav-link nav-link-btn">
            写文章
          </Link>
        </div>
      </div>
    </nav>
  );
}
