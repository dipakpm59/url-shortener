const express = require('express');
const adminController = require('../controllers/admin.controller');
const { verifyJWT, authenticateAdmin, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// Every route on this router requires a valid admin session.
router.use(verifyJWT, authenticateAdmin, requireAdmin);

router.get('/urls', adminController.listUrls);
router.get('/dashboard', adminController.getDashboard);
router.get('/analytics', adminController.getAnalytics);
router.get('/cache', adminController.getCacheStats);
router.delete('/cache', adminController.clearCache);

module.exports = router;
