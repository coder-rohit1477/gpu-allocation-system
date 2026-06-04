'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test-db';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../server/app');
const User = require('../server/models/user/model');
const AuditLog = require('../server/models/audit-log/model');

describe('Auth integration', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    await User.create({
      username: 'studentA',
      password: 'Student@1234',
      role: 'STUDENT',
    });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  it('logs in with valid credentials', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'studentA', password: 'Student@1234' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'success',
      token: expect.any(String),
    });

    const logs = await AuditLog.find({});
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      action: 'USER_LOGIN',
      actorId: expect.anything(),
      metadata: {
        username: 'studentA',
        role: 'STUDENT',
      },
    });
  });

  it('rejects an invalid password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'studentA', password: 'WrongPassword123' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      status: 'fail',
      message: 'Incorrect username or password.',
    });
  });

  it('rejects logout without authentication', async () => {
    const response = await request(app).post('/api/v1/auth/logout');

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      status: 'fail',
      message: 'You are not logged in. Please log in to get access.',
    });
  });

  it('logs logout for authenticated users', async () => {
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'studentA', password: 'Student@1234' });

    const logoutResponse = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${loginResponse.body.token}`);

    expect(logoutResponse.status).toBe(200);

    const logs = await AuditLog.find({}).sort('createdAt');
    expect(logs.map((log) => log.action)).toEqual(['USER_LOGIN', 'USER_LOGOUT']);
  });
});
