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

describe('GPU allocation overlap behavior', () => {
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

  const createRequest = async (studentToken, startDate, endDate) => {
    return request(app)
      .post('/api/v1/gpu-requests')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        requiredVRAM: 8,
        purpose: 'Overlap behavior check',
        startDate,
        endDate,
      });
  };

  const approveRequest = async (facultyToken, requestId) => {
    return request(app)
      .patch(`/api/v1/gpu-requests/${requestId}/approve`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ gpuId: gpu._id.toString() });
  };

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

  it('rejects approval when the same GPU is already assigned to an overlapping approved request', async () => {
    const studentToken = await loginAs(studentCredentials);
    const facultyToken = await loginAs(facultyCredentials);

    const requestA = await createRequest(studentToken, '2030-01-01T00:00:00.000Z', '2030-01-05T00:00:00.000Z');
    const requestB = await createRequest(studentToken, '2030-01-03T00:00:00.000Z', '2030-01-07T00:00:00.000Z');

    const approveA = await approveRequest(facultyToken, requestA.body.data.request._id);
    const approveB = await approveRequest(facultyToken, requestB.body.data.request._id);

    expect(approveA.status).toBe(200);
    expect(approveB.status).toBe(409);
    expect(approveB.body).toMatchObject({
      status: 'fail',
      message: 'The selected GPU is already assigned to an overlapping approved request.',
    });
  });

  it('also allows the same GPU for non-overlapping approved requests when VRAM remains available', async () => {
    const studentToken = await loginAs(studentCredentials);
    const facultyToken = await loginAs(facultyCredentials);

    const requestA = await createRequest(studentToken, '2030-01-01T00:00:00.000Z', '2030-01-05T00:00:00.000Z');
    const requestB = await createRequest(studentToken, '2030-01-06T00:00:00.000Z', '2030-01-10T00:00:00.000Z');

    const approveA = await approveRequest(facultyToken, requestA.body.data.request._id);
    const approveB = await approveRequest(facultyToken, requestB.body.data.request._id);

    expect(approveA.status).toBe(200);
    expect(approveB.status).toBe(200);
    expect(approveB.body).toMatchObject({
      status: 'success',
      data: {
        request: {
          status: 'APPROVED',
          gpuResourceId: gpu._id.toString(),
        },
      },
    });
  });
});
