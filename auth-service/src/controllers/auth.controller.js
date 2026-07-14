const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const authService = require('../services/auth.service');
const AppError = require('../middlewares/AppError');

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   7 * 24 * 60 * 60 * 1000,
};

function validate(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) throw new AppError('Datos inválidos', 400, 'VALIDATION_ERROR', { fields: errors.array() });
}

async function login(req, res, next) {
  try {
    validate(req);
    const result = await authService.login(req.body.email, req.body.password);

    // Multi-hotel case — no tokens yet, return selector payload
    if (result.requires_hotel_selection) {
      return res.json(result);
    }

    // Single hotel — set cookie and return tokens normally
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTS);
    res.json({ 
      ...result, 
      token: result.accessToken,
      refreshToken: result.refreshToken
    });
  } catch (err) { next(err); }
}

/**
 * POST /auth/switch-tenant
 * Called from the hotel selector screen.
 * Body: { tenant_id }
 * Header: Authorization: Bearer <selection_token>
 *
 * The selection_token is the short-lived JWT returned by login
 * when the user has multiple hotels.
 */
async function switchTenant(req, res, next) {
  try {
    const { tenant_id } = req.body;
    if (!tenant_id) return next(new AppError('tenant_id requerido', 400, 'MISSING_TENANT'));

    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) return next(new AppError('Token requerido', 401, 'MISSING_TOKEN'));

    let payload;
    try {
      payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    } catch {
      return next(new AppError('Token inválido o expirado', 401, 'INVALID_TOKEN'));
    }

    // sub contains the userId
    const userId = payload.sub;
    if (!userId) return next(new AppError('Token malformado', 401, 'INVALID_TOKEN_CONTENT'));

    const result = await authService.switchTenant(userId, tenant_id);

    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTS);
    res.json({ 
      success:      true, 
      token:        result.accessToken, 
      refreshToken: result.refreshToken,
      user:         result.user,
      access:       result.access
    });
  } catch (err) { next(err); }
}

async function refresh(req, res, next) {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!rawToken) return next(new AppError('Refresh token no proporcionado', 400, 'MISSING_REFRESH_TOKEN'));

    const { accessToken, refreshToken } = await authService.refresh(rawToken);
    res.cookie('refreshToken', refreshToken, COOKIE_OPTS);
    res.json({ success: true, token: accessToken });
  } catch (err) { next(err); }
}

async function logout(req, res, next) {
  try {
    const rawToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (rawToken) await authService.logout(rawToken);
    res.clearCookie('refreshToken');
    res.json({ success: true, message: 'Sesión cerrada' });
  } catch (err) { next(err); }
}

async function changePassword(req, res, next) {
  try {
    validate(req);
    await authService.changePassword(req.user.sub, req.body.old_password, req.body.new_password);
    res.json({ success: true, message: 'Contraseña actualizada correctamente' });
  } catch (err) { next(err); }
}

async function requestReset(req, res, next) {
  try {
    validate(req);
    await authService.requestPasswordReset(req.body.email);
    res.json({ success: true, message: 'Si el email existe recibirás un enlace de recuperación' });
  } catch (err) { next(err); }
}

async function resetPassword(req, res, next) {
  try {
    validate(req);
    await authService.resetPassword(req.body.token, req.body.new_password);
    res.json({ success: true, message: 'Contraseña restablecida correctamente' });
  } catch (err) { next(err); }
}

// exports below

async function registerOwner(req, res, next) {
  try {
    validate(req);
    const userService = require('../services/user.service');
    const data = await userService.registerOwner({
      full_name: req.body.full_name,
      email:     req.body.email,
      password:  req.body.password,
    });
    // Immediately log them in so they land on HotelSelector
    const result = await authService.login(req.body.email, req.body.password);

    // Single owner with no hotels yet → no requires_hotel_selection
    // JWT has role: OWNER and no tid (tenant_id is null)
    if (result.refreshToken) res.cookie('refreshToken', result.refreshToken, COOKIE_OPTS);
    res.status(201).json({ 
      ...result, 
      token: result.accessToken, 
      refreshToken: result.refreshToken,
      registered: true 
    });
  } catch (err) { next(err); }
}

module.exports = {
  login, switchTenant, refresh, logout,
  changePassword, requestReset, resetPassword,
  registerOwner,
};
