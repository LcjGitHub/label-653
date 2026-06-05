import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import ArticleDetail from './pages/ArticleDetail';
import ArticleForm from './pages/ArticleForm';
import Admin from './pages/Admin';
import './App.css';

function App() {
  const currentYear = new Date().getFullYear();

  return (
    <Router>
      <div className="app">
        <Navbar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/article/:id" element={<ArticleDetail />} />
            <Route path="/create" element={<ArticleForm isEdit={false} />} />
            <Route path="/edit/:id" element={<ArticleForm isEdit={true} />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
        <footer className="footer">
          <div className="container">
            <p>© {currentYear} 博客系统 - 基于 Express + React + SQLite 构建</p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;
