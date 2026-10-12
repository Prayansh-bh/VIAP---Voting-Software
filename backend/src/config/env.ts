import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  
  // Security
  JWT_SECRET: z.string().default('kondapi-production-jwt-secret-key-change-in-env-2026'),
  JWT_EXPIRES_IN: z.string().default('1d'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().default('kondapi-secure-cookie-secret-key-2026-production'),
  OTP_SECRET: z.string().default('dev-super-secure-otp-secret-key-at-least-32-chars-long'),
  CORS_ORIGIN: z.string().default('*'),

  // OTP Configuration & Security Policies
  OTP_STATIC_CODE: z.string().default('123456'),
  OTP_EXPIRY_MS: z.coerce.number().default(300000), // 5 minutes
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),
  OTP_RESEND_COOLDOWN_MS: z.coerce.number().default(60000), // 60 seconds
  OTP_RATE_LIMIT_MAX: z.coerce.number().default(5), // 5 requests per window
  OTP_RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes

  // Primary Gateway Configuration (WhatsApp via Baileys is Primary OTP provider)
  SMS_PROVIDER: z.string().default('baileys'),
  MSG91_AUTH_KEY: z.string().optional(),
  MSG91_TEMPLATE_ID: z.string().optional(),
  SMS_SENDER_ID: z.string().default('KNDTDP'),

  // WhatsApp Gateway Configuration (Baileys / Cloud)
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
});

export { envSchema };

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

export const env = parsed.data;
