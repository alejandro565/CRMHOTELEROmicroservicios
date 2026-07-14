const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const SECRET         = process.env.JWT_SECRET || 'dev_secret_change_me';
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';

/**
 * Sign an Access Token.
 *
 * Three use cases:
 *  A) Owner JWT (no hotel yet)
 *     { userId, email, role: 'OWNER', modules: [], permissions: [...] }
 *     tid is null — owner has no tenant yet
 *
 *  B) Normal hotel JWT
 *     { userId, email, tenantId, role, modules, permissions }
 *
 *  C) Selection token
 *     { userId, purpose: 'hotel_selection' } — valid 5min, no email/tid
 */
function signAccessToken(payload, expiresIn = ACCESS_EXPIRES) {
  if (payload.purpose === 'hotel_selection') {
    return jwt.sign(
      { sub: payload.userId, purpose: 'hotel_selection' },
      SECRET,
      { expiresIn }
    );
  }

  return jwt.sign(
    {
      sub:   payload.userId,
      email: payload.email   || null,   // ← added — needed by saas-service
      tid:   payload.tenantId || null,  // null for OWNER with no hotel yet
      role:  payload.role,
      feats: payload.modules      || [],
      perms: payload.permissions  || [],
      sched: payload.schedule     || null,
    },
    SECRET,
    { expiresIn }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, SECRET);
}

function generateRefreshToken() {
  return uuidv4();
}

function refreshTokenExpiresAt() {
  const days = parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || '7', 10);
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

module.exports = { signAccessToken, verifyAccessToken, generateRefreshToken, refreshTokenExpiresAt };
