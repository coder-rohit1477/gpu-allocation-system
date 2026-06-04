'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test-db';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../server/app');
const User = require('../server/models/user/model');
const GpuRequest = require('../server/models/gpu-request/model');
const GpuResource = require('../server/models/gpu-resource/model');
const AuditLog = require('../server/models/audit-log/model');

describe('GPU request workflow integration', () => {
  let mongoServer;
  let gpu;

  const studentCredentials = {
    username: 'studentA',
    password: 'Student@1234',
  };

  const facultyCredentials = {
    username: 'facultyB',
    password: 'Faculty@1234',
  };

  const loginAs = async (credentials) => {
    const response = await request(app).post('/api/v1/auth/login').send(credentials);
    return response.body.token;
  };

  const getAuditLogs = () => AuditLog.find({}).sort('createdAt');

  const createRequestPayload = () => ({
    requiredVRAM: 8,
    purpose: 'Run model training job',
    startDate: '2030-01-10T00:00:00.000Z',
    endDate: '2030-01-11T00:00:00.000Z',
  });

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
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

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  it('creates a GPU request successfully', async () => {
    const studentToken = await loginAs(studentCredentials);

    const response = await request(app)
      .post('/api/v1/gpu-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(createRequestPayload());

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        request: {
          purpose: 'Run model training job',
          status: 'PENDING',
          requiredVRAM: 8,
        },
      },
    });

    const logs = await getAuditLogs();
    expect(logs.map((log) => log.action)).toEqual(['USER_LOGIN', 'REQUEST_CREATED']);
    expect(logs[1]).toMatchObject({
      action: 'REQUEST_CREATED',
      metadata: {
        purpose: 'Run model training job',
      },
    });
  });

  it('approves a GPU request successfully', async () => {
    const studentToken = await loginAs(studentCredentials);
    const facultyToken = await loginAs(facultyCredentials);

    const createResponse = await request(app)
      .post('/api/v1/gpu-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(createRequestPayload());

    const response = await request(app)
      .patch(`/api/v1/gpu-requests/${createResponse.body.data.request._id}/approve`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ gpuId: gpu._id.toString() });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        request: {
          status: 'APPROVED',
          gpuResourceId: gpu._id.toString(),
        },
      },
    });

    const logs = await getAuditLogs();
    expect(logs.map((log) => log.action)).toEqual([
      'USER_LOGIN',
      'USER_LOGIN',
      'REQUEST_CREATED',
      'REQUEST_APPROVED',
      'GPU_ALLOCATED',
    ]);
    expect(logs[3]).toMatchObject({
      action: 'REQUEST_APPROVED',
      metadata: {
        requestId: createResponse.body.data.request._id,
        gpuId: gpu._id.toString(),
      },
    });
    expect(logs[4]).toMatchObject({
      action: 'GPU_ALLOCATED',
      metadata: {
        requestId: createResponse.body.data.request._id,
        gpuId: gpu._id.toString(),
        allocatedVRAM: 8,
      },
    });
  });

  it('rejects a GPU request successfully', async () => {
    const studentToken = await loginAs(studentCredentials);
    const facultyToken = await loginAs(facultyCredentials);

    const createResponse = await request(app)
      .post('/api/v1/gpu-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(createRequestPayload());

    const response = await request(app)
      .patch(`/api/v1/gpu-requests/${createResponse.body.data.request._id}/reject`)
      .set('Authorization', `Bearer ${facultyToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'success',
      data: {
        request: {
          status: 'REJECTED',
        },
      },
    });

    const logs = await getAuditLogs();
    expect(logs.map((log) => log.action)).toEqual([
      'USER_LOGIN',
      'USER_LOGIN',
      'REQUEST_CREATED',
      'REQUEST_REJECTED',
    ]);
    expect(logs[3]).toMatchObject({
      action: 'REQUEST_REJECTED',
      metadata: {
        requestId: createResponse.body.data.request._id,
      },
    });
  });

  it('rejects approval from an unauthorized user', async () => {
    const studentToken = await loginAs(studentCredentials);

    const createResponse = await request(app)
      .post('/api/v1/gpu-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(createRequestPayload());

    const response = await request(app)
      .patch(`/api/v1/gpu-requests/${createResponse.body.data.request._id}/approve`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ gpuId: gpu._id.toString() });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      status: 'fail',
      message: 'You do not have permission to perform this action.',
    });
  });
});
