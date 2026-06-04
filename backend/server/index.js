'use strict';

const config    = require('./config/env');
const connectDB = require('./config/db');
const app       = require('./app');
const { initializeRealtime, closeRealtime } = require('./realtime');

let server;

const shutdown = async (reason, exitCode) => {
  console.log(`[server] ${reason} — graceful shutdown…`);

  try {
    await closeRealtime();
  } catch (err) {
    console.error('[server] Failed to close realtime layer:', err.message);
  }

  if (server && server.listening) {
    await new Promise((resolve) => server.close(resolve));
  }

  process.exit(exitCode);
};

// ─── Process-level error guards ───────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[server] Uncaught exception — shutting down:', err.message);
  void shutdown('Uncaught exception received', 1);
});

process.on('unhandledRejection', (err) => {
  console.error('[server] Unhandled rejection — shutting down:', err.message);
  void shutdown('Unhandled rejection received', 1);
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM received', 0);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
const startServer = async () => {
  await connectDB();

  server = app.listen(config.port, () => {
    console.log(`[server] Listening on port ${config.port} [${config.nodeEnv}]`);
  });

  initializeRealtime(server);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[server] Port ${config.port} is already in use.`);
    } else {
      console.error('[server] Server error:', err.message);
    }
    process.exit(1);
  });
};

startServer();

// Export only the Express app so test suites can import without booting a server.
// Tests should require('./server/app') directly — not this file.
module.exports = app;
