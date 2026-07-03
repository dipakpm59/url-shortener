const express = require('express');
const urlController = require('../controllers/url.controller');
const { shortenLimiter } = require('../middleware/rateLimiter');
const { verifyJWT, authenticateAdmin, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();
const requireAuth = [verifyJWT, authenticateAdmin, requireAdmin];

// Public: creating a short URL, reading its metadata, and fetching its QR
// code are part of the existing anonymous shorten-a-link flow on the
// landing page and must stay unauthenticated.
router.post('/', shortenLimiter, urlController.createShortUrl);
router.get('/:shortCode/qrcode', urlController.getQrCode);
router.get('/:shortCode', urlController.getUrlDetails);

// Admin-only: mutating an arbitrary URL by id is an administrative action.
router.put('/:id', requireAuth, urlController.updateUrl);
router.delete('/:id', requireAuth, urlController.deleteUrl);
router.post('/:id/restore', requireAuth, urlController.restoreUrl);

module.exports = router;
