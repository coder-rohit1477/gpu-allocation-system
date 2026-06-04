'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/test-db';

const request = require('supertest');

const app = require('../server/app');

describe('GET /api-docs', () => {
  it('redirects to the canonical Swagger UI URL', async () => {
    const response = await request(app).get('/api-docs');

    expect(response.status).toBe(301);
    expect(response.headers.location).toBe('/api-docs/');
  });

  it('serves the Swagger UI successfully at the canonical URL', async () => {
    const response = await request(app).get('/api-docs/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Swagger UI');
  });

  it('serves Swagger static assets from the docs mount', async () => {
    const response = await request(app).get('/api-docs/swagger-ui.css');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/css');
  });
});
