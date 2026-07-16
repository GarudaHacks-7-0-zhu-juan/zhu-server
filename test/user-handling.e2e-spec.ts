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

  it('manages guardian and guardee invitations', async () => {
    const suffix = Date.now();
    const phoneSeed = String(suffix).slice(-8);
    const guardee = {
      email: `guardee-${suffix}@example.com`,
      password: 'password123',
      phoneNumber: `+628${phoneSeed}01`,
    };
    const guardian = {
      email: `guardian-${suffix}@example.com`,
      password: 'password123',
      phoneNumber: `+628${phoneSeed}02`,
    };

    const guardeeRegistration = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(guardee)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(guardian)
      .expect(201);

    const guardeeIdentity = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${guardeeRegistration.body.accessToken}`)
      .expect(200);
    const guardeeId = guardeeIdentity.body.sub as string;

    const guardianLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(guardian)
      .expect(200);
    const guardianIdentity = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${guardianLogin.body.accessToken}`)
      .expect(200);
    const guardianId = guardianIdentity.body.sub as string;

    await request(app.getHttpServer())
      .post('/api/guardians/requests')
      .set('Authorization', `Bearer ${guardeeRegistration.body.accessToken}`)
      .send({ phoneNumber: guardian.phoneNumber })
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('PENDING');
        expect(body.guardian.email).toBe(guardian.email);
      });

    await request(app.getHttpServer())
      .get('/api/guardees/requests')
      .set('Authorization', `Bearer ${guardianLogin.body.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0].guardee.id).toBe(guardeeId);
        expect(body[0].initiatorRole).toBe('GUARDEE');
      });

    await request(app.getHttpServer())
      .get('/api/guardians/requests')
      .set('Authorization', `Bearer ${guardeeRegistration.body.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0].guardian.email).toBe(guardian.email);
        expect(body[0].initiatorRole).toBe('GUARDEE');
      });

    await request(app.getHttpServer())
      .patch(`/api/guardians/requests/${guardianId}`)
      .set('Authorization', `Bearer ${guardeeRegistration.body.accessToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/guardees/requests/${guardeeId}`)
      .set('Authorization', `Bearer ${guardianLogin.body.accessToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/locations')
      .set('Authorization', `Bearer ${guardeeRegistration.body.accessToken}`)
      .send({ latitude: -6.2088, longitude: 106.8456 })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/guardees/${guardeeId}`)
      .set('Authorization', `Bearer ${guardianLogin.body.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.guardee.id).toBe(guardeeId);
        expect(body.location.latitude).toBe('-6.2088');
      });

    await request(app.getHttpServer())
      .delete(`/api/guardees/${guardeeId}`)
      .set('Authorization', `Bearer ${guardianLogin.body.accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/guardees/requests')
      .set('Authorization', `Bearer ${guardianLogin.body.accessToken}`)
      .send({ phoneNumber: guardee.phoneNumber })
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('PENDING');
        expect(body.guardee.email).toBe(guardee.email);
        expect(body.initiatorRole).toBe('GUARDIAN');
      });

    await request(app.getHttpServer())
      .patch(`/api/guardees/requests/${guardeeId}`)
      .set('Authorization', `Bearer ${guardianLogin.body.accessToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/guardians/requests/${guardianId}`)
      .set('Authorization', `Bearer ${guardeeRegistration.body.accessToken}`)
      .send({ status: 'DECLINED' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/guardians/requests')
      .set('Authorization', `Bearer ${guardeeRegistration.body.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0].status).toBe('DECLINED');
        expect(body[0].initiatorRole).toBe('GUARDIAN');
      });

    await request(app.getHttpServer())
      .post('/api/guardees/requests')
      .set('Authorization', `Bearer ${guardianLogin.body.accessToken}`)
      .send({ phoneNumber: guardee.phoneNumber })
      .expect(201)
      .expect(({ body }) => {
        expect(body.status).toBe('PENDING');
        expect(body.initiatorRole).toBe('GUARDIAN');
      });

    await request(app.getHttpServer())
      .patch(`/api/guardians/requests/${guardianId}`)
      .set('Authorization', `Bearer ${guardeeRegistration.body.accessToken}`)
      .send({ status: 'ACCEPTED' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/guardians')
      .set('Authorization', `Bearer ${guardeeRegistration.body.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toHaveLength(1);
        expect(body[0].guardian.id).toBe(guardianId);
      });

    await request(app.getHttpServer())
      .delete(`/api/guardians/${guardianId}`)
      .set('Authorization', `Bearer ${guardeeRegistration.body.accessToken}`)
      .expect(204);
  });
});
