'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test-db';

const http = require('http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { io: createClient } = require('socket.io-client');

const app = require('../server/app');
const { initializeRealtime, emitToUser, closeRealtime } = require('../server/realtime');
const User = require('../server/models/user/model');

jest.setTimeout(20000);

describe('Socket realtime integration', () => {
  let mongoServer;
  let httpServer;
  let baseUrl;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    httpServer = http.createServer(app);
    initializeRealtime(httpServer);

    await new Promise((resolve) => {
      httpServer.listen(0, resolve);
    });

    const { port } = httpServer.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await User.create({
      username: 'studentA',
      password: 'Student@1234',
      role: 'STUDENT',
    });
  });

  afterEach(async () => {
    await new Promise((resolve) => {
      for (const socket of ioClients) {
        socket.close();
      }
      ioClients.length = 0;
      setImmediate(resolve);
    });
  });

  afterAll(async () => {
    await closeRealtime();

    if (httpServer?.listening) {
      await new Promise((resolve) => httpServer.close(resolve));
    }

    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  const ioClients = [];

  const createSocketClient = (options = {}) => {
    const socket = createClient(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
      ...options,
    });

    ioClients.push(socket);
    return socket;
  };

  const loginAndGetToken = async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'studentA', password: 'Student@1234' });

    expect(response.status).toBe(200);
    return response.body.token;
  };

  it('authenticates sockets and delivers room emits to the connected user', async () => {
    const token = await loginAndGetToken();
    const decoded = jwt.decode(token);
    const socket = createSocketClient({
      auth: { token },
    });

    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });

    const payload = { ok: true };
    const received = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for user room event.')), 3000);

      socket.once('socket:test', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    expect(emitToUser(decoded.id, 'socket:test', payload)).toBe(true);
    await expect(received).resolves.toEqual(payload);
  });

  it('rejects sockets without a valid token', async () => {
    const socket = createSocketClient();

    const error = await new Promise((resolve) => {
      socket.once('connect_error', (err) => resolve(err));
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Authentication failed');
  });
});
