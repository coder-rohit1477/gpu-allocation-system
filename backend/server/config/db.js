const mongoose = require('mongoose');
const config = require('./env');

const connectDB = async () => {
  try {
    // Obfuscate password in log
    const uriLog = config.mongoUri.replace(/\/\/(.*):(.*)@/, '//***:***@');
    console.log(`[db] Attempting connection to: ${uriLog}`);

    const conn = await mongoose.connect(config.mongoUri);
    
    console.log(`[db] MongoDB Connected: ${conn.connection.host}`);
    console.log(`[db] Database Name: ${conn.connection.name}`);

    // List all collections
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`[db] Available Collections: ${collections.map(c => c.name).join(', ') || 'none'}`);

    if (conn.connection.name !== 'pbl_gpu_manager') {
      console.warn(`[db] WARNING: Connected to "${conn.connection.name}" instead of "pbl_gpu_manager".`);
    }

  } catch (err) {
    console.error('[db] MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
