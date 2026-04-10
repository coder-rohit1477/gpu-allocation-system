const config = require('./config/env');
const connectDB = require('./config/db');
const app = require('./app');

let server;

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message);

  if (server) {
    server.close(() => process.exit(1));
    return;
  }

  process.exit(1);
});

process.on('SIGTERM', () => {
  if (!server) {
    process.exit(0);
  }

  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => console.log('Process terminated.'));
});

const startServer = async () => {
  await connectDB();

  server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} [${config.nodeEnv}]`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${config.port} is already in use.`);
    } else {
      console.error('Server error:', err.message);
    }

    process.exit(1);
  });
};

startServer();

module.exports = app;
