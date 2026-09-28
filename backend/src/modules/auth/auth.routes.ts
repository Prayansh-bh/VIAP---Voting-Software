import { FastifyInstance } from 'fastify';
import { validateBody } from '../../common/validation.js';
import { authenticate } from '../../middleware/auth.js';
import {
  requestOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  deviceSessionSchema,
  revokeDeviceSchema,
  demoLoginSchema,
} from './auth.schema.js';
import { AuthController } from './auth.controller.js';

export async function authRoutes(fastify: FastifyInstance) {
  // Fast 1-Click Demo Authentication (Role-based instant test access)
  fastify.post(
    '/demo-login',
    {
      config: {
        rateLimit: {
          max: process.env.NODE_ENV === 'test' ? 100 : 60,
          timeWindow: '1 minute',
        },
      },
      preValidation: [validateBody(demoLoginSchema)],
    },
    AuthController.demoLogin,
  );

  // Silent device-based auto-login (Zomato/Uber/Ola persistent device session)
  fastify.post(
    '/device-session',
    {
      config: {
        rateLimit: {
          max: process.env.NODE_ENV === 'test' ? 100 : 60,
          timeWindow: '1 minute',
        },
      },
      preValidation: [validateBody(deviceSessionSchema)],
    },
    AuthController.deviceSession,
  );

  // Rate limited OTP generation (WhatsApp / SMS via MSG91)
  fastify.post(
    '/request-otp',
    {
      config: {
        rateLimit: {
          max: process.env.NODE_ENV === 'test' ? 100 : 10,
          timeWindow: '1 minute',
        },
      },
      preValidation: [validateBody(requestOtpSchema)],
    },
    AuthController.requestOtp,
  );

  // Verify OTP and authorize device
  fastify.post(
    '/verify-otp',
    {
      config: {
        rateLimit: {
          max: process.env.NODE_ENV === 'test' ? 100 : 20,
          timeWindow: '1 minute',
        },
      },
      preValidation: [validateBody(verifyOtpSchema)],
    },
    AuthController.verifyOtp,
  );

  // Refresh token
  fastify.post(
    '/refresh',
    {
      preValidation: [validateBody(refreshTokenSchema)],
    },
    AuthController.refresh,
  );

  // Logout
  fastify.post(
    '/logout',
    {
      preHandler: [authenticate],
    },
    AuthController.logout,
  );

  // Authenticated user profile
  fastify.get(
    '/me',
    {
      preHandler: [authenticate],
    },
    AuthController.me,
  );

  // List user's authorized devices
  fastify.get(
    '/devices',
    {
      preHandler: [authenticate],
    },
    AuthController.getDevices,
  );

  // Revoke device authorization
  fastify.post(
    '/devices/:deviceId/revoke',
    {
      preHandler: [authenticate],
    },
    AuthController.revokeDevice,
  );
}
