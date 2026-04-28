import express from 'express';
import request from 'supertest';
import healthRoutes from './health';

describe('apps/api health routes', () => {
  it('responds to the canonical health route', async () => {
    const app = express();
    app.use('/health', healthRoutes);

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body).toHaveProperty('timestamp');
  });
});