const crypto = require('crypto');
const User = require('../models/User');

const TOKEN_TTL_SECONDS = 8 * 60 * 60;

function getSecret() {
  const secret = process.env.AUTH_TOKEN_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('AUTH_TOKEN_SECRET phải được cấu hình và có tối thiểu 32 bytes.');
  }
  return secret;
}

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signToken(user) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    sub: String(user._id),
    role: user.role,
    ver: user.tokenVersion || 0,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS
  }));
  const unsigned = `${header}.${payload}`;
  const signature = crypto.createHmac('sha256', getSecret()).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Token không hợp lệ.');
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = JSON.parse(Buffer.from(headerPart, 'base64url').toString('utf8'));
  if (header.alg !== 'HS256' || header.typ !== 'JWT') throw new Error('Thuật toán token không hợp lệ.');
  const expected = crypto.createHmac('sha256', getSecret()).update(`${headerPart}.${payloadPart}`).digest();
  const actual = Buffer.from(signaturePart, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error('Chữ ký token không hợp lệ.');
  const payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
  const now = Math.floor(Date.now() / 1000);
  if (!payload.sub || !Number.isFinite(payload.exp) || payload.exp <= now) throw new Error('Phiên đăng nhập đã hết hạn.');
  return payload;
}

async function authenticate(req, res, next) {
  try {
    const authHeader = req.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return res.status(401).json({ error: 'Vui lòng đăng nhập để tiếp tục.' });

    const payload = verifyToken(match[1]);
    const user = await User.findById(payload.sub).select('_id fullName email role active tokenVersion');
    if (!user || !user.active || user.tokenVersion !== payload.ver) {
      return res.status(401).json({ error: 'Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.' });
    }
    req.user = user;
    req.authPayload = payload;
    next();
  } catch (err) {
    if (err.message && err.message.includes('AUTH_TOKEN_SECRET')) {
      return res.status(500).json({ error: 'Máy chủ chưa cấu hình xác thực. Liên hệ quản trị viên.' });
    }
    return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Vui lòng đăng nhập.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    next();
  };
}

module.exports = { authenticate, authorize, signToken, verifyToken, TOKEN_TTL_SECONDS };
