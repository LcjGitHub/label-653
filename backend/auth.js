const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { get, run } = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'blog-jwt-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const TOKEN_TYPE = 'Bearer';

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      nickname: user.nickname
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function getTokenFromHeader(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== TOKEN_TYPE) return null;

  return parts[1];
}

async function isTokenBlacklisted(token) {
  const result = await get(
    'SELECT 1 FROM token_blacklist WHERE token = ? AND expires_at > CURRENT_TIMESTAMP',
    [token]
  );
  return !!result;
}

async function authMiddleware(req, res, next) {
  const token = getTokenFromHeader(req);

  if (!token) {
    req.user = null;
    return next();
  }

  const blacklisted = await isTokenBlacklisted(token);
  if (blacklisted) {
    req.user = null;
    return next();
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    req.user = null;
    return next();
  }

  const user = await get(
    'SELECT id, username, nickname, email, created_at FROM users WHERE id = ?',
    [decoded.id]
  );

  if (!user) {
    req.user = null;
    return next();
  }

  req.user = user;
  req.token = token;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: '请先登录' });
  }
  next();
}

async function blacklistToken(token, userId) {
  const decoded = jwt.decode(token);
  const expiresAt = decoded
    ? new Date(decoded.exp * 1000).toISOString()
    : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await run(
    'INSERT OR IGNORE INTO token_blacklist (token, user_id, expires_at) VALUES (?, ?, ?)',
    [token, userId || null, expiresAt]
  );
}

async function cleanupExpiredTokens() {
  await run('DELETE FROM token_blacklist WHERE expires_at <= CURRENT_TIMESTAMP');
}

setInterval(cleanupExpiredTokens, 24 * 60 * 60 * 1000);

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  getTokenFromHeader,
  authMiddleware,
  requireAuth,
  blacklistToken,
  JWT_EXPIRES_IN,
  TOKEN_TYPE
};
