const express = require('express');
const urlController = require('../controllers/url.controller');
const { shortenLimiter } = require('../middleware/rateLimiter');
const { verifyJWT, authenticateAdmin, requireAdmin, identifyActor } = require('../middleware/auth.middleware');

const router = express.Router();
const requireAuth = [verifyJWT, authenticateAdmin, requireAdmin];

// Creating a short URL now requires a logged-in ADMIN or USER session —
// every url row is owned by exactly one of them, and the per-user daily
// cap only means something if every creator is identified. Reading an
// existing link's metadata/QR and the redirect itself stay public below —
// only creation is gated.
router.post('/', shortenLimiter, verifyJWT, identifyActor, urlController.createShortUrl);
router.get('/:shortCode/qrcode', urlController.getQrCode);
router.get('/:shortCode', urlController.getUrlDetails);

// Admin-only: mutating an arbitrary URL by id is an administrative action.
router.put('/:id', requireAuth, urlController.updateUrl);
router.delete('/:id', requireAuth, urlController.deleteUrl);
router.post('/:id/restore', requireAuth, urlController.restoreUrl);

module.exports = router;
