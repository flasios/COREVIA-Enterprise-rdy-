import express from 'express';
import session from 'express-session';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { registerPlatformRoutes } from './platform';

const TEST_SESSION_SECRET = randomUUID();

function createApp() {
  const app = express();
  app.use(session({
    secret: TEST_SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  }));
  registerPlatformRoutes(app, {} as never);
  return app;
}

describe('apps/api platform route registration', () => {
  it('mounts health routes on both canonical prefixes', async () => {
    const app = createApp();

    const [rootHealth, apiHealth] = await Promise.all([
      request(app).get('/health'),
      request(app).get('/api/health'),
    ]);

    expect(rootHealth.status).toBe(200);
    expect(rootHealth.body.status).toBe('healthy');
    expect(apiHealth.status).toBe(200);
    expect(apiHealth.body.status).toBe('healthy');
  });

  it('mounts the corevia health endpoint and identity auth surface', async () => {
    const app = createApp();

    const [coreviaHealth, csrfToken] = await Promise.all([
      request(app).get('/api/corevia/healthz'),
      request(app).get('/api/auth/csrf-token'),
    ]);

    expect(coreviaHealth.status).toBe(200);
    expect(coreviaHealth.body.status).toBe('healthy');
    expect(csrfToken.status).toBe(200);
    expect(csrfToken.body.success).toBe(true);
  });

  it('mounts privacy routes behind authentication', async () => {
    const app = createApp();
    const response = await request(app).get('/api/privacy/data-request');

    expect(response.status).toBe(401);
  });
});