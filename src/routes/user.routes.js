const express = require('express');
const userController = require('../controllers/user.controller');
const { verifyJWT, authenticateUser, requireUser } = require('../middleware/auth.middleware');
const { loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const requireAuth = [verifyJWT, authenticateUser, requireUser];

// Public — registering or logging in isn't authenticated yet. Reuses the
// existing IP-based loginLimiter so an open registration endpoint can't be
// used to spam-create accounts, same reasoning as the login route itself.
router.post('/register', loginLimiter, userController.register);
router.post('/login', loginLimiter, userController.login);

router.post('/logout', ...requireAuth, userController.logout);
router.get('/me', ...requireAuth, userController.me);
router.get('/me/urls', ...requireAuth, userController.myUrls);
router.delete('/me/urls/:id', ...requireAuth, userController.deleteMyUrl);
router.get('/me/analytics', ...requireAuth, userController.myAnalytics);

module.exports = router;
