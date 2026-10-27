const express = require('express');
const crypto = require('crypto');
const { promisify } = require('util');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { authenticate, authorize, signToken } = require('../middleware/auth');

const router = express.Router();
const scrypt = promisify(crypto.scrypt);
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hashHex] = stored.split(':');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, salt, expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function audit(req, action, details = {}, actor = req.user) {
  return AuditLog.create({
    actor: actor?._id || null,
    actorEmail: actor?.email || String(details.email || ''),
    action,
    resourceType: 'auth',
    details,
    ip: req.ip || '',
    userAgent: String(req.get('user-agent') || '').slice(0, 300)
  }).catch(err => console.error('Không ghi được audit log:', err.message));
}

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function publicUser(user) {
  return { id: String(user._id), fullName: user.fullName, email: user.email, role: user.role };
}

router.post('/setup-admin', async (req, res) => {
  try {
    const expectedKey = process.env.INITIAL_ADMIN_SETUP_KEY;
    const suppliedKey = req.get('x-admin-setup-key');
    if (!expectedKey || Buffer.byteLength(expectedKey) < 24) {
      return res.status(503).json({ error: 'Chưa cấu hình INITIAL_ADMIN_SETUP_KEY trên máy chủ.' });
    }
    const a = Buffer.from(expectedKey);
    const b = Buffer.from(String(suppliedKey || ''));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).json({ error: 'Mã khởi tạo Admin không chính xác.' });
    }
    if (await User.exists({})) {
      return res.status(409).json({ error: 'Hệ thống đã có tài khoản. Không thể dùng endpoint khởi tạo Admin nữa.' });
    }

    const { fullName, email, password } = req.body || {};
    if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 120) {
      return res.status(400).json({ error: 'Họ tên phải từ 2 đến 120 ký tự.' });
    }
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Email không hợp lệ.' });
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
      return res.status(400).json({ error: 'Mật khẩu Admin phải từ 12 đến 128 ký tự.' });
    }

    const user = await User.create({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: await hashPassword(password),
      role: 'admin',
      bootstrapSlot: 'initial-admin'
    });
    await audit(req, 'auth.bootstrap_admin', { email: user.email }, user);
    return res.status(201).json({ message: 'Đã tạo tài khoản Admin đầu tiên. Hãy đăng nhập.', user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email đã tồn tại hoặc Admin đầu tiên vừa được khởi tạo. Hãy thử đăng nhập.' });
    console.error('Setup admin error:', err.message);
    return res.status(500).json({ error: 'Không thể khởi tạo Admin.' });
  }
});

router.post('/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const key = `${req.ip || 'unknown'}:${email}`;
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (attempt && now - attempt.startedAt < LOGIN_WINDOW_MS && attempt.count >= MAX_LOGIN_ATTEMPTS) {
    return res.status(429).json({ error: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.' });
  }

  try {
    const submittedPassword = typeof req.body?.password === 'string' ? req.body.password : '';
    if (submittedPassword.length > 128) return res.status(400).json({ error: 'Mật khẩu không hợp lệ.' });
    const user = isValidEmail(email) ? await User.findOne({ email }).select('+passwordHash') : null;
    const passwordOk = await verifyPassword(submittedPassword, user?.passwordHash);
    if (!user || !passwordOk || !user.active) {
      const current = loginAttempts.get(key);
      if (!current || now - current.startedAt >= LOGIN_WINDOW_MS) loginAttempts.set(key, { startedAt: now, count: 1 });
      else current.count += 1;
      await audit(req, 'auth.login_failed', { email });
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng, hoặc tài khoản đã bị khóa.' });
    }

    loginAttempts.delete(key);
    user.lastLoginAt = new Date();
    await user.save();
    await audit(req, 'auth.login_success', {}, user);
    return res.json({ token: signToken(user), expiresIn: 8 * 60 * 60, user: publicUser(user) });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Không thể đăng nhập lúc này.' });
  }
});

router.get('/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

router.post('/logout', authenticate, async (req, res) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
    await audit(req, 'auth.logout');
    res.json({ message: 'Đã đăng xuất và vô hiệu hóa phiên hiện tại.' });
  } catch (err) {
    res.status(500).json({ error: 'Không thể đăng xuất an toàn. Vui lòng thử lại.' });
  }
});

router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  const users = await User.find({}).select('fullName email role active lastLoginAt createdAt').sort({ createdAt: -1 }).lean();
  res.json(users.map(user => ({ ...user, id: String(user._id), _id: undefined })));
});

router.post('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { fullName, email, password, role } = req.body || {};
    const allowedRoles = ['manager', 'warehouse', 'production'];
    if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 120) {
      return res.status(400).json({ error: 'Họ tên phải từ 2 đến 120 ký tự.' });
    }
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Email không hợp lệ.' });
    if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
      return res.status(400).json({ error: 'Mật khẩu phải từ 12 đến 128 ký tự.' });
    }
    if (!allowedRoles.includes(role)) return res.status(400).json({ error: 'Vai trò không hợp lệ.' });

    const user = await User.create({
      fullName: fullName.trim(), email: email.trim().toLowerCase(),
      passwordHash: await hashPassword(password), role, createdBy: req.user._id
    });
    await audit(req, 'auth.user_created', { targetUserId: String(user._id), role });
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Email đã được sử dụng.' });
    res.status(500).json({ error: 'Không thể tạo tài khoản.' });
  }
});

router.patch('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role, active, fullName } = req.body || {};
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    if (String(target._id) === String(req.user._id) && (active === false || (role !== undefined && role !== target.role))) {
      return res.status(400).json({ error: 'Không thể tự khóa hoặc tự đổi vai trò tài khoản đang đăng nhập.' });
    }
    const isRemovingActiveAdmin = target.role === 'admin' && target.active && (active === false || (role !== undefined && role !== 'admin'));
    if (isRemovingActiveAdmin) {
      const activeAdmins = await User.countDocuments({ role: 'admin', active: true });
      if (activeAdmins <= 1) return res.status(400).json({ error: 'Không thể khóa hoặc hạ quyền Admin hoạt động cuối cùng.' });
    }
    if (role !== undefined) {
      if (!['admin', 'manager', 'warehouse', 'production'].includes(role)) return res.status(400).json({ error: 'Vai trò không hợp lệ.' });
      target.role = role;
    }
    if (active !== undefined) {
      if (typeof active !== 'boolean') return res.status(400).json({ error: 'Trạng thái active phải là true/false.' });
      target.active = active;
    }
    if (fullName !== undefined) {
      if (typeof fullName !== 'string' || fullName.trim().length < 2 || fullName.trim().length > 120) return res.status(400).json({ error: 'Họ tên không hợp lệ.' });
      target.fullName = fullName.trim();
    }
    target.tokenVersion += 1;
    await target.save();
    await audit(req, 'auth.user_updated', { targetUserId: String(target._id), role: target.role, active: target.active });
    res.json({ user: publicUser(target), active: target.active });
  } catch (err) {
    res.status(400).json({ error: 'Không thể cập nhật tài khoản.' });
  }
});

module.exports = router;
