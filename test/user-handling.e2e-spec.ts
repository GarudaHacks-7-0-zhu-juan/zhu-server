import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('User handling (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.KAFKA_BROKERS = 'localhost:9092';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('binds login to a device and manages ring memberships', async () => {
    const suffix = Date.now();
    const phoneSeed = String(suffix).slice(-8);
    const owner = {
      email: `owner-${suffix}@example.com`,
      password: 'password123',
      phoneNumber: `+628${phoneSeed}01`,
      deviceId: `owner-device-${suffix}`,
    };
    const member = {
      email: `member-${suffix}@example.com`,
      password: 'password123',
      phoneNumber: `+628${phoneSeed}02`,
      deviceId: `member-device-${suffix}`,
    };

    const ownerRegistration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(owner)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(member)
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ ...owner, deviceId: 'unregistered-device' })
      .expect(401);

    const memberIdentity = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${ownerRegistration.body.accessToken}`)
      .expect(200);
    const ownerId = memberIdentity.body.sub as string;

    const memberLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(member)
      .expect(200);
    const memberIdentityResponse = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${memberLogin.body.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .put('/api/users/rings/1')
      .set('Authorization', `Bearer ${ownerRegistration.body.accessToken}`)
      .send({ memberIds: [memberIdentityResponse.body.sub] })
      .expect(200)
      .expect(({ body }) => {
        expect(body.ownerId).toBe(ownerId);
        expect(body.ringNumber).toBe(1);
        expect(body.members).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .delete('/api/users/rings/1')
      .set('Authorization', `Bearer ${ownerRegistration.body.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/users/rings')
      .set('Authorization', `Bearer ${ownerRegistration.body.accessToken}`)
      .expect(200)
      .expect([]);
  });
});
