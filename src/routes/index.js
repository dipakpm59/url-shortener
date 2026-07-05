const express = require('express');
const urlRoutes = require('./url.routes');
const adminRoutes = require('./admin.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');

const router = express.Router();

router.use('/api/auth', authRoutes);
router.use('/api/url', urlRoutes);
router.use('/api/admin', adminRoutes);
router.use('/api/users', userRoutes);

module.exports = router;
