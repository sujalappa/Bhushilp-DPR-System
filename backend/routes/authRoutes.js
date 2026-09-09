const express = require('express');
const auth = require('../middleware/auth');
const { login, logout, me } = require('../controllers/authController');

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', auth, me);

module.exports = router;
