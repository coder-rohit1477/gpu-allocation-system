'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Tight rate limiter for the login endpoint only.
 * 10 failed attempts per IP per 15 minutes.
 * skipSuccessfulRequests: true means a correct login doesn't burn a slot.
 */
const loginLimiter = rateLimit({
  windowMs:              15 * 60 * 1000,
  max:                   10,
  skipSuccessfulRequests: true,
  standardHeaders:       true,
  legacyHeaders:         false,
  message: {
    status:  'fail',
    message: 'Too many login attempts from this IP. Please try again in 15 minutes.',
  },
});

module.exports = loginLimiter;
