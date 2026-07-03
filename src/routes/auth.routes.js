const express = require('express');
const authController = require('../controllers/auth.controller');
const { verifyJWT, authenticateAdmin, requireAdmin } = require('../middleware/auth.middleware');
const { loginLimiter, otpRequestLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/login', loginLimiter, authController.login);
router.post('/logout', verifyJWT, authenticateAdmin, requireAdmin, authController.logout);
router.get('/me', verifyJWT, authenticateAdmin, requireAdmin, authController.me);
router.put('/change-password', verifyJWT, authenticateAdmin, requireAdmin, authController.changePassword);

// Public — an admin who's locked out or has forgotten their password isn't
// authenticated, so these can't require a session.
router.post('/forgot-password', otpRequestLimiter, authController.forgotPassword);
router.post('/reset-password', otpVerifyLimiter, authController.resetPassword);

module.exports = router;
