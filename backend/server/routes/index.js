const express = require('express');

const router = express.Router();

const User = require('../models/user/model');
const mongoose = require('mongoose');

router.get('/debug/users', async (req, res) => {
  try {
    const users = await User.find({}, 'username role');
    res.status(200).json({
      databaseName: mongoose.connection.name,
      users
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/debug/check-password', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username }).select('+password');
    if (!user) {
      return res.status(404).json({ userFound: false, passwordMatch: false });
    }
    const isMatch = await user.correctPassword(password, user.password);
    res.status(200).json({ userFound: true, passwordMatch: isMatch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use('/auth',          require('./auth/routes'));
router.use('/gpu-resources', require('./gpu-resource/routes'));
router.use('/gpu-requests', require('./gpu-request/routes'));
router.use('/admin', require('./admin/routes'));
router.use('/analytics', require('./analytics/routes'));

module.exports = router;
