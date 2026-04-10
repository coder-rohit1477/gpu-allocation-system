const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: {
      type:     String,
      required: [true, 'A user must have a username'],
      unique:   true,
      trim:     true,
      minlength: [3, 'Username must be at least 3 characters'],
    },
    password: {
      type:     String,
      required: [true, 'A user must have a password'],
      minlength: [8, 'Password must be at least 8 characters'],
      select:   false,  // Never return password in queries
    },
    role: {
      type:     String,
      enum:     ['STUDENT', 'FACULTY', 'ADMIN'],
      default:  'STUDENT',
      required: true,
    },
  },
  { timestamps: true }
);

// ─── Hash password before save ────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ─── Instance method: compare passwords ──────────────────────────────────────
userSchema.methods.correctPassword = async function (candidatePassword, hashedPassword) {
  return bcrypt.compare(candidatePassword, hashedPassword);
};

module.exports = mongoose.model('User', userSchema);
