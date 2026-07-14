const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/authenticate');

const loginRules = [
  body('email').isEmail().withMessage('Email inválido'),
  body('password').notEmpty().withMessage('La contraseña es requerida'),
];

const registerOwnerRules = [
  body('full_name').notEmpty().withMessage('Nombre completo requerido'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password')
    .isLength({ min: 8 }).withMessage('Mínimo 8 caracteres')
    .matches(/[A-Z]/).withMessage('Debe contener al menos una mayúscula')
    .matches(/[0-9]/).withMessage('Debe contener al menos un número'),
];

const changePassRules = [
  body('old_password').notEmpty(),
  body('new_password')
    .isLength({ min: 8 })
    .matches(/[A-Z]/)
    .matches(/[0-9]/),
];

const resetRules = [
  body('token').notEmpty(),
  body('new_password').isLength({ min: 8 }),
];

// ── Public ────────────────────────────────────────────────────────────────────
// POST /auth/register-owner  — SaaS signup: creates owner account + auto-login
// POST /auth/login           — login (single hotel → JWT, multi → selector payload)
// POST /auth/switch-tenant   — select hotel after multi-hotel login
// POST /auth/refresh         — rotate token pair
// POST /auth/logout          — revoke refresh token
// POST /auth/request-reset   — send password reset email
// POST /auth/reset-password  — apply reset token

router.post('/register-owner', registerOwnerRules, ctrl.registerOwner);
router.post('/login',          loginRules,          ctrl.login);
router.post('/switch-tenant',  [body('tenant_id').isUUID()], ctrl.switchTenant);
router.post('/refresh',        ctrl.refresh);
router.post('/logout',         ctrl.logout);
router.post('/request-reset',  [body('email').isEmail()], ctrl.requestReset);
router.post('/reset-password', resetRules, ctrl.resetPassword);

// ── Authenticated ─────────────────────────────────────────────────────────────
router.post('/change-password', authenticate, changePassRules, ctrl.changePassword);

module.exports = router;
