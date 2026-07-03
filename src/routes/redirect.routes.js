const express = require('express');
const { redirectToLongUrl } = require('../controllers/redirect.controller');

const router = express.Router();

router.get('/:shortCode', redirectToLongUrl);

module.exports = router;
