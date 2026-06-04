/**
 * scripts/seed.js
 * Run from project root: node scripts/seed.js
 *
 * Seeds the database with default users and GPU resources.
 * Uses User.create() so the pre-save hook hashes passwords automatically.
 */

require('dotenv').config();
const mongoose    = require('mongoose');
const User        = require('../server/models/user/model');
const GpuResource = require('../server/models/gpu-resource/model');

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in .env');
  process.exit(1);
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const USERS = [
  { username: 'admin',   password: 'Admin@1234',   role: 'ADMIN'   },
  { username: 'faculty', password: 'Faculty@1234', role: 'FACULTY' },
  { username: 'student', password: 'Student@1234', role: 'STUDENT' },
];

const GPUS = [
  { name: 'NVIDIA GeForce RTX 4090', model: 'RTX 4090', vram: 24, cudaCores: 16384, condition: 'New',  status: 'Available' },
  { name: 'NVIDIA GeForce RTX 4080', model: 'RTX 4080', vram: 16, cudaCores: 9728,  condition: 'New',  status: 'Available' },
  { name: 'NVIDIA GeForce RTX 4070', model: 'RTX 4070', vram: 12, cudaCores: 5888,  condition: 'New',  status: 'Available' },
  { name: 'NVIDIA GeForce RTX 3060', model: 'RTX 3060', vram: 12, cudaCores: 3584,  condition: 'Used', status: 'Available' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const seedUsers = async () => {
  await User.deleteMany({});
  const created = await User.create(USERS);
  console.log(`✅ Seeded ${created.length} users:`);
  created.forEach((u) => console.log(`   · ${u.username} [${u.role}]`));
};

const seedGpus = async () => {
  await GpuResource.deleteMany({});
  const created = await GpuResource.create(GPUS);
  console.log(`✅ Seeded ${created.length} GPU resources:`);
  created.forEach((g) => console.log(`   · ${g.name}`));
};

// ─── Main ────────────────────────────────────────────────────────────────────

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`✅ Connected to: ${mongoose.connection.name}`);

    await seedUsers();
    await seedGpus();

    await mongoose.connection.close();
    console.log('🔌 Disconnected. Seed complete.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
};

run();
