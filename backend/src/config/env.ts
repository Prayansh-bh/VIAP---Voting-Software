import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Security
  JWT_SECRET: z.string().default('kondapi-production-jwt-secret-key-change-in-env'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().default('kondapi-secure-cookie-secret-key-2026'),
  OTP_SECRET: z.string().default('dev-super-secure-otp-secret-key-at-least-32-chars-long'),
  CORS_ORIGIN: z.string().default('*'),

  // OTP Configuration & Security Policies
  OTP_STATIC_CODE: z.string().default('123456'),
  OTP_EXPIRY_MS: z.coerce.number().default(300000), // 5 minutes
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_RESEND_COOLDOWN_MS: z.coerce.number().default(60000), // 60 seconds
  OTP_RATE_LIMIT_MAX: z.coerce.number().default(5), // 5 requests per window
  OTP_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes

  // SMS Gateway Configuration (Production: MSG91 ONLY)
  SMS_PROVIDER: z.string().default('msg91'),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  SMS_SENDER_ID: z.string().default('KNDTDP'),

  // WhatsApp Gateway Configuration (Baileys / Cloud / Twilio)
  WHATSAPP_PROVIDER: z.string().default('baileys'),
  WHATSAPP_BAILEYS_AUTH_DIR: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_OTP_TEMPLATE: z.string().default('auth_otp_code'),
  WHATSAPP_LANG: z.string().default('en_US'),

  // Cache & Message Broker (Redis)
  REDIS_URL: z.string().optional(),

  // AI & Analytics
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
}).superRefine((data, ctx) => {
  // Reject non-msg91 SMS providers in all environments
  if (data.SMS_PROVIDER !== 'msg91') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'SMS_PROVIDER must be "msg91". Only MSG91 is supported as the SMS provider.',
      path: ['SMS_PROVIDER'],
    });
  }

  if (data.NODE_ENV === 'production') {
    const defaultSecrets = [
      'kondapi-production-jwt-secret-key-change-in-env',
      'kondapi-secure-cookie-secret-key-2026',
      'dev-super-secure-otp-secret-key-at-least-32-chars-long',
      'secret',
      'jwt-secret',
      'cookie-secret',
      'otp-secret',
      'changeme',
      'password',
      'default',
    ];

    const rawJwt = (data.JWT_SECRET || process.env.JWT_SECRET || '').trim();
    if (!rawJwt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JWT_SECRET must be explicitly provided in environment variables for production.',
        path: ['JWT_SECRET'],
      });
    } else if (defaultSecrets.some((s) => rawJwt.toLowerCase().includes(s))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JWT_SECRET must not use a development or default fallback secret in production.',
        path: ['JWT_SECRET'],
      });
    } else if (rawJwt.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'JWT_SECRET must be at least 32 characters long in production.',
        path: ['JWT_SECRET'],
      });
    }

    const rawCookie = (data.COOKIE_SECRET || process.env.COOKIE_SECRET || '').trim();
    if (!rawCookie) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'COOKIE_SECRET must be explicitly provided in environment variables for production.',
        path: ['COOKIE_SECRET'],
      });
    } else if (defaultSecrets.some((s) => rawCookie.toLowerCase().includes(s))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'COOKIE_SECRET must not use a development or default fallback secret in production.',
        path: ['COOKIE_SECRET'],
      });
    } else if (rawCookie.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'COOKIE_SECRET must be at least 32 characters long in production.',
        path: ['COOKIE_SECRET'],
      });
    }

    // OTP_SECRET validation in production
    const rawOtpSecret = (data.OTP_SECRET || process.env.OTP_SECRET || '').trim();
    if (!rawOtpSecret) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OTP_SECRET must be explicitly provided in environment variables for production.',
        path: ['OTP_SECRET'],
      });
    } else if (defaultSecrets.some((s) => rawOtpSecret.toLowerCase().includes(s))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OTP_SECRET must not use a development or default fallback secret in production.',
        path: ['OTP_SECRET'],
      });
    } else if (rawOtpSecret.length < 32) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'OTP_SECRET must be at least 32 characters long in production.',
        path: ['OTP_SECRET'],
      });
    }

    // CORS Origin validation in production
    const rawCors = (data.CORS_ORIGIN !== undefined ? data.CORS_ORIGIN : (process.env.CORS_ORIGIN || '')).trim();
    if (!rawCors) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CORS_ORIGIN must be explicitly provided in environment variables for production.',
        path: ['CORS_ORIGIN'],
      });
    } else if (rawCors === '*' || rawCors.split(',').some((o) => o.trim() === '*')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CORS_ORIGIN cannot be a wildcard "*" in production when credentials are enabled.',
        path: ['CORS_ORIGIN'],
      });
    }

    const rawMsg91AuthKey = (data.MSG91_AUTH_KEY || process.env.MSG91_AUTH_KEY || process.env.SMS_API_KEY || '').trim();
    if (!rawMsg91AuthKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MSG91_AUTH_KEY must be explicitly provided in environment variables for production.',
        path: ['MSG91_AUTH_KEY'],
      });
    }

    const rawMsg91TemplateId = (data.MSG91_TEMPLATE_ID || process.env.MSG91_TEMPLATE_ID || process.env.SMS_TEMPLATE_ID || '').trim();
    if (!rawMsg91TemplateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'MSG91_TEMPLATE_ID must be explicitly provided in environment variables for production.',
        path: ['MSG91_TEMPLATE_ID'],
      });
    }
  }
});

export { envSchema };

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
