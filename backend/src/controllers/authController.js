const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Role = require('../models/Role');
const Permission = require('../models/Permission');
const RefreshToken = require('../models/RefreshToken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_DAYS = 30;

function signAccessToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function signRefreshToken() {
  return crypto.randomBytes(32).toString('hex');
}

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const storedPassword = user.password || '';
    const isValidPassword = storedPassword && await bcrypt.compare(password || '', storedPassword);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isActive = user.active ?? (user.status === 'active');
    if (!isActive) {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    const accessToken = signAccessToken(user);
    const refreshTokenValue = signRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await RefreshToken.create({ token: refreshTokenValue, expiresAt, userId: user.id });

    res.json({ accessToken, refreshToken: refreshTokenValue, user: { id: user.id, name: user.name, email: user.email, role: user.roleId } });
  } catch (error) {
    res.status(500).json({ message: 'Login failed' });
  }
};

exports.session = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findByPk(req.user.id);

    if (!user || !user.active) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    res.json({
      user: { id: req.user.id, name: req.user.name, email: req.user.email },
      role: req.user.Role?.name || null,
      permissions: req.permissions || [],
    });
  } catch (error) {
    res.status(500).json({ message: 'Session failed' });
  }
};

exports.refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const tokenRow = await RefreshToken.findOne({ where: { token: refreshToken, revoked: false } });

    if (!tokenRow || tokenRow.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const user = await User.findByPk(tokenRow.userId);
    if (!user || !user.active) {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    tokenRow.revoked = true;
    await tokenRow.save();

    const newRefreshToken = signRefreshToken();
    await RefreshToken.create({ token: newRefreshToken, expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000), userId: user.id });

    res.json({ accessToken: signAccessToken(user), refreshToken: newRefreshToken });
  } catch (error) {
    res.status(500).json({ message: 'Refresh failed' });
  }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.update({ revoked: true }, { where: { token: refreshToken } });
    }
    res.json({ message: 'Logged out' });
  } catch (error) {
    res.status(500).json({ message: 'Logout failed' });
  }
};
