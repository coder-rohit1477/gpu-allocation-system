'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test-db';

const http = require('http');
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { io: createClient } = require('socket.io-client');

const app = require('../server/app');
const { initializeRealtime, closeRealtime } = require('../server/realtime');
const User = require('../server/models/user/model');
const GpuRequest = require('../server/models/gpu-request/model');
const GpuResource = require('../server/models/gpu-resource/model');
const AuditLog = require('../server/models/audit-log/model');

jest.setTimeout(20000);

describe('GPU request realtime events', () => {
  let mongoServer;
  let httpServer;
  let baseUrl;
  let gpu;
  const sockets = [];

  const studentCredentials = {
    username: 'studentA',
    password: 'Student@1234',
  };

  const facultyCredentials = {
    username: 'facultyB',
    password: 'Faculty@1234',
  };

  const createRequestPayload = () => ({
    requiredVRAM: 8,
    purpose: 'Run model training job',
    startDate: '2030-01-10T00:00:00.000Z',
    endDate: '2030-01-11T00:00:00.000Z',
  });

  const loginAs = async (credentials) => {
    const response = await request(app).post('/api/v1/auth/login').send(credentials);
    expect(response.status).toBe(200);
    return response.body.token;
  };

  const createSocket = (token) => {
    const socket = createClient(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
      auth: { token },
    });

    sockets.push(socket);
    return socket;
  };

  const waitForConnection = (socket) =>
    new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });

  const waitForEvent = (socket, eventName) =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}.`)), 5000);
      socket.once(eventName, (payload) => {
        clearTimeout(timeout);
        resolve(payload);
      });
    });

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
    await Promise.all([
      User.deleteMany({}),
      GpuRequest.deleteMany({}),
      GpuResource.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);

    await User.create([
      { username: 'studentA', password: 'Student@1234', role: 'STUDENT' },
      { username: 'facultyB', password: 'Faculty@1234', role: 'FACULTY' },
    ]);

    gpu = await GpuResource.create({
      name: 'NVIDIA GeForce RTX 4090',
      model: 'RTX 4090',
      vram: 24,
      cudaCores: 16384,
      condition: 'New',
      status: 'Available',
    });
  });

  afterEach(async () => {
    for (const socket of sockets) {
      socket.close();
    }
    sockets.length = 0;
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

  it('emits request:approved to the student after approval persists', async () => {
    const studentToken = await loginAs(studentCredentials);
    const facultyToken = await loginAs(facultyCredentials);
    const studentSocket = createSocket(studentToken);

    await waitForConnection(studentSocket);

    const createResponse = await request(app)
      .post('/api/v1/gpu-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(createRequestPayload());

    const expectedRequestId = createResponse.body.data.request._id;
    const approvalEvent = waitForEvent(studentSocket, 'request:approved');

    const approveResponse = await request(app)
      .patch(`/api/v1/gpu-requests/${expectedRequestId}/approve`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ gpuId: gpu._id.toString() });

    expect(approveResponse.status).toBe(200);

    await expect(approvalEvent).resolves.toMatchObject({
      requestId: expectedRequestId,
      status: 'APPROVED',
      gpuId: gpu._id.toString(),
      timestamp: expect.any(String),
    });
  });

  it('emits request:rejected to the student after rejection persists', async () => {
    const studentToken = await loginAs(studentCredentials);
    const facultyToken = await loginAs(facultyCredentials);
    const studentSocket = createSocket(studentToken);

    await waitForConnection(studentSocket);

    const createResponse = await request(app)
      .post('/api/v1/gpu-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(createRequestPayload());

    const expectedRequestId = createResponse.body.data.request._id;
    const rejectionEvent = waitForEvent(studentSocket, 'request:rejected');

    const rejectResponse = await request(app)
      .patch(`/api/v1/gpu-requests/${expectedRequestId}/reject`)
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(rejectResponse.status).toBe(200);

    await expect(rejectionEvent).resolves.toMatchObject({
      requestId: expectedRequestId,
      status: 'REJECTED',
      gpuId: null,
      timestamp: expect.any(String),
    });
  });
});
