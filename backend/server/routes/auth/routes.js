'use strict';

const express        = require('express');
const authController = require('../../controllers/auth/controller');
const { protect }    = require('../../middleware/auth/middleware');
const loginLimiter   = require('../../middleware/login-limiter/middleware');

const router = express.Router();

// Public
router.post('/signup',  authController.signup);
router.post('/login',   loginLimiter, authController.login);
router.post('/refresh', authController.refresh);

// Authenticated
router.post('/logout', protect, authController.logout);

module.exports = router;
