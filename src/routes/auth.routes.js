const express = require('express');
const authController = require('../controllers/auth.controller');
const { verifyJWT, authenticateAdmin, requireAdmin } = require('../middleware/auth.middleware');
const { loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/login', loginLimiter, authController.login);
router.post('/logout', verifyJWT, authenticateAdmin, requireAdmin, authController.logout);
router.get('/me', verifyJWT, authenticateAdmin, requireAdmin, authController.me);
router.put('/change-password', verifyJWT, authenticateAdmin, requireAdmin, authController.changePassword);

module.exports = router;
